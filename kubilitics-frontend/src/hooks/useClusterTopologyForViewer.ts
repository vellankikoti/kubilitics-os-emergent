/**
 * Cluster topology in the same format as Pod/Node detail topology:
 * nodes and edges for TopologyViewer (D3 shape: id, type, name, namespace?, status; from, to, label).
 * Uses backend getTopology when configured, otherwise builds from nodes + pods list API.
 */
import { useMemo } from 'react';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useTopologyFromBackend } from '@/hooks/useTopologyFromBackend';
import { useK8sResourceList } from '@/hooks/useKubernetes';
import type { TopologyNode, TopologyEdge, ResourceType } from '@/components/resources/D3ForceTopology';


function kindToD3Type(kind: string): ResourceType {
  const k = kind.toLowerCase();
  if (k === 'cluster') return 'cluster';
  if (k === 'node') return 'node';
  if (k === 'deployment') return 'deployment';
  if (k === 'pod') return 'pod';
  return 'pod';
}

function mapStatus(status?: string): 'healthy' | 'warning' | 'error' | 'pending' {
  if (!status) return 'healthy';
  const s = String(status).toLowerCase();
  if (s === 'running' || s === 'active' || s === 'ready' || s === 'bound' || s === 'succeeded') return 'healthy';
  if (s === 'pending' || s === 'unknown') return 'pending';
  if (s === 'failed' || s === 'terminating' || s === 'notready') return 'error';
  return 'warning';
}

/** Dashboard card: only Cluster (center) + Nodes connected to it. */
const DASHBOARD_CARD_KINDS = new Set<string>(['Cluster', 'Node']);

function backendGraphToViewer(
  raw: { nodes: Array<{ id: string; kind: string; name: string; namespace?: string; status?: string }>; edges?: Array<{ source: string; target: string; label?: string; relationshipType?: string }> },
  clusterId: string,
  clusterName: string
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const nodeList = (raw.nodes ?? []).filter((n) => DASHBOARD_CARD_KINDS.has(n.kind));
  const rawEdges = raw.edges ?? [];
  const clusterNodeId = `cluster-${clusterId}`;
  const backendClusterId = nodeList.find((n) => n.kind === 'Cluster')?.id ?? null;
  const hasCluster = !!backendClusterId;

  const nodes: TopologyNode[] = [];
  const nodeIds = new Set<string>();

  if (!hasCluster) {
    nodes.push({
      id: clusterNodeId,
      type: 'cluster',
      name: clusterName,
      status: 'healthy',
    });
    nodeIds.add(clusterNodeId);
  }

  for (const n of nodeList) {
    const id = n.kind === 'Cluster' ? clusterNodeId : n.id;
    if (nodeIds.has(id)) continue;
    nodeIds.add(id);
    nodes.push({
      id,
      type: kindToD3Type(n.kind),
      name: n.name,
      namespace: n.namespace ?? undefined,
      status: mapStatus(n.status),
    });
  }

  const mapId = (id: string) => (id === backendClusterId ? clusterNodeId : id);
  const edges: TopologyEdge[] = [];
  // Always add cluster → node edges so cluster is the single root (central node)
  nodeList.filter((n) => n.kind === 'Node').forEach((n) => {
    edges.push({ from: clusterNodeId, to: n.id, label: 'Manages' });
  });
  rawEdges.forEach((e) => {
    const from = mapId(e.source);
    const to = mapId(e.target);
    if (to === clusterNodeId) return; // keep cluster as single root
    if (from === clusterNodeId && nodeIds.has(to)) return; // already added cluster→node
    if (nodeIds.has(from) && nodeIds.has(to))
      edges.push({ from, to, label: e.label ?? e.relationshipType ?? '' });
  });

  return { nodes, edges };
}

/** Dashboard card: only Cluster (center) + Nodes connected to it. */
function listToViewer(
  clusterId: string,
  clusterName: string,
  nodeItems: any[]
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const clusterNodeId = `cluster-${clusterId}`;
  const nodes: TopologyNode[] = [{ id: clusterNodeId, type: 'cluster', name: clusterName, status: 'healthy' as const }];
  const edges: TopologyEdge[] = [];
  const safeNodes = Array.isArray(nodeItems) ? nodeItems : [];

  safeNodes.forEach((node: any) => {
    const nodeName = node?.metadata?.name;
    if (!nodeName) return;
    const nodeId = `node-${nodeName}`;
    const isReady = node?.status?.conditions?.find((c: any) => c?.type === 'Ready')?.status === 'True';
    nodes.push({ id: nodeId, type: 'node', name: nodeName, status: isReady ? 'healthy' : 'error' });
    edges.push({ from: clusterNodeId, to: nodeId, label: 'Manages' });
  });

  return { nodes, edges };
}

export function useClusterTopologyForViewer() {
  const { activeCluster } = useClusterStore();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const clusterId = activeCluster?.id ?? useBackendConfigStore((s) => s.currentClusterId) ?? '';
  const clusterName = activeCluster?.name ?? 'Cluster';

  const topologyFromBackend = useTopologyFromBackend(isBackendConfigured ? clusterId : null);
  const { data: nodesList, isLoading: nodesLoading } = useK8sResourceList('nodes', undefined, { enabled: !!activeCluster });

  const useBackend =
    isBackendConfigured &&
    !!clusterId &&
    !!topologyFromBackend.data?.nodes?.length &&
    !topologyFromBackend.isError;

  const { nodes, edges } = useMemo(() => {
    if (!clusterId) return { nodes: [] as TopologyNode[], edges: [] as TopologyEdge[] };
    if (useBackend && topologyFromBackend.data) {
      return backendGraphToViewer(
        topologyFromBackend.data as Parameters<typeof backendGraphToViewer>[0],
        clusterId,
        clusterName
      );
    }
    const nodeItems = (nodesList as any)?.items ?? [];
    return listToViewer(clusterId, clusterName, nodeItems);
  }, [clusterId, clusterName, useBackend, topologyFromBackend.data, nodesList]);

  const isLoading = useBackend ? topologyFromBackend.isLoading : nodesLoading;

  return {
    nodes,
    edges,
    isLoading: !clusterId ? false : isLoading,
  };
}
