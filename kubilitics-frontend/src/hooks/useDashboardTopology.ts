/**
 * Dashboard topology: prefer backend topology when available; fallback to list-based cluster topology.
 * When backend is used: filter to Cluster / Node / Pod, inject Cluster node if missing, support expand/collapse by node.
 */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useTopologyFromBackend } from '@/hooks/useTopologyFromBackend';
import { useClusterTopology } from '@/hooks/useClusterTopology';
import type { TopologyGraph, TopologyNode, TopologyEdge } from '@/types/topology';

const DASHBOARD_KINDS = new Set<string>(['Cluster', 'Node', 'Pod']);
const DASHBOARD_RELATIONSHIPS = new Set<string>(['owns', 'schedules', 'references']);

function ensureNodeShape(node: Partial<TopologyNode> & { id: string; kind: string; name: string }): TopologyNode {
  return {
    id: node.id,
    kind: node.kind as TopologyNode['kind'],
    name: node.name,
    namespace: node.namespace ?? '',
    apiVersion: node.apiVersion ?? 'v1',
    status: (node.status as TopologyNode['status']) ?? 'Unknown',
    metadata: node.metadata ?? { labels: {}, annotations: {}, createdAt: '', uid: '' },
    computed: node.computed ?? { health: (node as any).computed?.health ?? 'healthy' },
    ...node,
  } as TopologyNode;
}

/**
 * Build dashboard graph from backend topology: cluster at center, nodes, pods (for expanded nodes only).
 */
function buildDashboardGraphFromBackend(
  raw: TopologyGraph | undefined,
  clusterId: string,
  clusterName: string,
  expandedNodes: Set<string>
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  if (!raw?.nodes?.length) return { nodes: [], edges: [] };

  const nodeList = raw.nodes.filter((n) => DASHBOARD_KINDS.has(n.kind));
  const hasCluster = nodeList.some((n) => n.kind === 'Cluster');
  const nodeIds = new Set(nodeList.map((n) => n.id));
  const edges = (raw.edges ?? []).filter(
    (e) =>
      nodeIds.has(e.source) &&
      nodeIds.has(e.target) &&
      DASHBOARD_RELATIONSHIPS.has(e.relationshipType)
  );

  const clusterNodeId = `cluster-${clusterId}`;
  const nodes: TopologyNode[] = [];
  const nodeIdToName = new Map<string, string>();

  if (!hasCluster) {
    nodes.push(
      ensureNodeShape({
        id: clusterNodeId,
        kind: 'Cluster' as any,
        name: clusterName,
        namespace: '',
        status: 'healthy',
        computed: { health: 'healthy' },
      })
    );
  }

  const podIdsByNode = new Map<string, Set<string>>();
  for (const e of edges) {
    if (e.relationshipType === 'schedules' || e.relationshipType === 'references') {
      const nodeId = e.source;
      const podId = e.target;
      if (!podIdsByNode.has(nodeId)) podIdsByNode.set(nodeId, new Set());
      podIdsByNode.get(nodeId)!.add(podId);
    }
      if (e.relationshipType === 'owns' && e.source === clusterNodeId) {
        nodeIdToName.set(e.target, e.target);
      }
  }

  const visiblePodIds = new Set<string>();
  expandedNodes.forEach((nodeId) => {
    podIdsByNode.get(nodeId)?.forEach((podId) => visiblePodIds.add(podId));
  });

  for (const n of nodeList) {
    if (n.kind === 'Cluster') {
      nodes.push(ensureNodeShape({ ...n, id: clusterNodeId, name: clusterName }));
      continue;
    }
    if (n.kind === 'Node') {
      nodes.push(ensureNodeShape(n));
      continue;
    }
    if (n.kind === 'Pod' && visiblePodIds.has(n.id)) {
      nodes.push(ensureNodeShape(n));
    }
  }

  const visibleIds = new Set(nodes.map((n) => n.id));
  const dashboardEdges: TopologyEdge[] = [];
  if (!hasCluster) {
    nodeList
      .filter((n) => n.kind === 'Node')
      .forEach((n) => {
        dashboardEdges.push({
          id: `edge-${clusterNodeId}-${n.id}`,
          source: clusterNodeId,
          target: n.id,
          relationshipType: 'owns',
          label: 'Manages',
          metadata: {
            derivation: 'ownerReference',
            confidence: 1,
            sourceField: '',
          },
        });
      });
  }
  edges.forEach((e) => {
    if (visibleIds.has(e.source) && visibleIds.has(e.target)) dashboardEdges.push(e);
  });

  return { nodes, edges: dashboardEdges };
}

export function useDashboardTopology() {
  const { activeCluster } = useClusterStore();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const currentClusterId = useBackendConfigStore((s) => s.currentClusterId);
  const clusterId = activeCluster?.id ?? currentClusterId ?? '';

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const hasAutoExpanded = useRef(false);

  const topologyFromBackend = useTopologyFromBackend(isBackendConfigured ? clusterId : null);
  const listBased = useClusterTopology();

  const backendData = topologyFromBackend.data;
  const useBackend =
    isBackendConfigured &&
    !!clusterId &&
    !!backendData?.nodes?.length &&
    !topologyFromBackend.isError;

  const effectiveExpanded = useBackend ? expandedNodes : listBased.expandedNodes;

  const { nodes, edges } = useMemo(() => {
    if (useBackend && backendData) {
      return buildDashboardGraphFromBackend(
        backendData,
        clusterId,
        activeCluster?.name ?? 'Cluster',
        expandedNodes
      );
    }
    return { nodes: listBased.nodes, edges: listBased.edges };
  }, [useBackend, backendData, clusterId, activeCluster?.name, expandedNodes, listBased.nodes, listBased.edges]);

  const toggleNodeExpansion = (nodeId: string) => {
    if (useBackend) {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
    } else {
      listBased.toggleNodeExpansion(nodeId);
    }
  };

  useEffect(() => {
    if (!useBackend || !backendData?.nodes?.length) return;
    if (hasAutoExpanded.current) return;
    const firstNode = backendData.nodes.find((n: any) => n.kind === 'Node');
    if (firstNode?.id) {
      hasAutoExpanded.current = true;
      setExpandedNodes(new Set([firstNode.id]));
    }
  }, [useBackend, backendData?.nodes]);

  const isLoading = useBackend ? topologyFromBackend.isLoading : listBased.isLoading;

  return {
    nodes,
    edges,
    isLoading,
    expandedNodes: effectiveExpanded,
    toggleNodeExpansion,
  };
}
