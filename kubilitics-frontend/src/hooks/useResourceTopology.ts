/**
 * Fetches resource-scoped topology from Kubilitics backend
 * (GET /api/v1/clusters/{clusterId}/topology/resource/{kind}/{namespace}/{name}).
 * Returns nodes/edges in D3/TopologyViewer shape (type, from, to).
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { getResourceTopology } from '@/services/backendApiClient';
import type { TopologyNode, TopologyEdge, ResourceType } from '@/components/resources/D3ForceTopology';

type BackendNode = { id: string; kind: string; name: string; namespace?: string; status?: string };
type BackendEdge = { source: string; target: string; label?: string };

const KIND_TO_D3_TYPE: Record<string, ResourceType> = {
  Pod: 'pod',
  Deployment: 'deployment',
  ReplicaSet: 'replicaset',
  StatefulSet: 'statefulset',
  DaemonSet: 'daemonset',
  Job: 'job',
  CronJob: 'cronjob',
  ReplicationController: 'replicaset',
  Service: 'service',
  Node: 'node',
  ConfigMap: 'configmap',
  Secret: 'secret',
  PersistentVolumeClaim: 'pvc',
  PersistentVolume: 'pv',
  StorageClass: 'storageclass',
  VolumeAttachment: 'pv',
  ServiceAccount: 'serviceaccount',
  Ingress: 'ingress',
  IngressClass: 'ingressclass',
  Endpoints: 'endpoint',
  EndpointSlice: 'endpointslice',
  HorizontalPodAutoscaler: 'hpa',
  PodDisruptionBudget: 'pdb',
  NetworkPolicy: 'networkpolicy',
};

function kindToD3Type(kind: string): ResourceType {
  return KIND_TO_D3_TYPE[kind] ?? 'pod';
}

function mapStatus(status?: string): 'healthy' | 'warning' | 'error' | 'pending' {
  if (!status) return 'healthy';
  const s = status.toLowerCase();
  if (s === 'running' || s === 'active' || s === 'ready' || s === 'bound' || s === 'succeeded') return 'healthy';
  if (s === 'pending' || s === 'unknown') return 'pending';
  if (s === 'failed' || s === 'terminating') return 'error';
  return 'warning';
}

function backendGraphToD3(nodes: BackendNode[], edges: BackendEdge[]): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const d3Nodes: TopologyNode[] = nodes.map((n) => ({
    id: n.id,
    type: kindToD3Type(n.kind),
    name: n.name,
    namespace: n.namespace ?? undefined,
    status: mapStatus(n.status),
  }));
  const d3Edges: TopologyEdge[] = edges.map((e) => ({
    from: e.source,
    to: e.target,
    label: e.label,
  }));
  return { nodes: d3Nodes, edges: d3Edges };
}

export function useResourceTopology(kind: string, namespace: string | undefined, name: string | undefined) {
  const stored = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(stored);
  const activeCluster = useClusterStore((s) => s.activeCluster);
  const currentClusterId = useBackendConfigStore((s) => s.currentClusterId);
  const clusters = useClusterStore((s) => s.clusters);
  const clusterId = activeCluster?.id ?? currentClusterId ?? clusters?.[0]?.id;
  const isConfigured = useBackendConfigStore((s) => s.isBackendConfigured());

  const isEnabled = isConfigured && !!clusterId && !!kind && !!name;

  const query = useQuery({
    queryKey: ['backend', 'resourceTopology', backendBaseUrl, clusterId, kind, namespace ?? '', name],
    queryFn: () =>
      getResourceTopology(backendBaseUrl!, clusterId!, kind, namespace ?? '', name!),
    enabled: isEnabled,
    staleTime: 30_000,
  });

  const { nodes, edges } = useMemo(() => {
    if (!query.data?.nodes?.length) return { nodes: [], edges: [] };
    return backendGraphToD3(
      query.data.nodes as BackendNode[],
      (query.data.edges ?? []) as BackendEdge[]
    );
  }, [query.data]);

  return {
    nodes,
    edges,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    /** True when the topology request will run (backend configured + cluster selected + kind + name). */
    isEnabled,
  };
}
