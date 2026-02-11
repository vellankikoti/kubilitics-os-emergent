/**
 * Topology Metrics Hook
 * Fetches and aggregates metrics for topology nodes
 * Provides real-time metrics updates for visual encoding
 */
import { useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { getPodMetrics, getNodeMetrics, getDeploymentMetrics } from '@/services/backendApiClient';
import type { TopologyNode } from '@/components/resources/D3ForceTopology';
import type { NodeMetrics, MetricsData } from '@/utils/topologyDataTransformer';

interface PodMetricsResponse {
  name: string;
  namespace: string;
  CPU: string;
  Memory: string;
  containers: Array<{ name: string; CPU: string; Memory: string }>;
}

interface NodeMetricsResponse {
  name: string;
  CPU: string;
  Memory: string;
}

interface DeploymentMetricsResponse {
  deploymentName: string;
  namespace: string;
  podCount: number;
  totalCPU: string;
  totalMemory: string;
  pods: Array<{ name: string; namespace: string; CPU: string; Memory: string }>;
}

/**
 * Parse CPU string (e.g., "100m", "1.5") to millicores
 */
function parseCPU(cpuStr: string): number {
  if (!cpuStr) return 0;
  if (cpuStr.endsWith('m')) {
    return parseFloat(cpuStr.slice(0, -1));
  }
  return parseFloat(cpuStr) * 1000;
}

/**
 * Parse Memory string (e.g., "100Mi", "1Gi") to MiB
 */
function parseMemory(memStr: string): number {
  if (!memStr) return 0;
  const num = parseFloat(memStr);
  if (memStr.endsWith('Gi')) {
    return num * 1024;
  }
  if (memStr.endsWith('Mi')) {
    return num;
  }
  if (memStr.endsWith('Ki')) {
    return num / 1024;
  }
  // Assume bytes, convert to MiB
  return num / (1024 * 1024);
}

/**
 * Fetch metrics for topology nodes
 */
export function useTopologyMetrics(
  nodes: TopologyNode[],
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
): {
  metrics: NodeMetrics;
  isLoading: boolean;
  error: Error | null;
} {
  const { activeCluster } = useClusterStore();
  const storedUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedUrl);
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const clusterId = activeCluster?.id;

  const enabled = (options?.enabled !== false) && isBackendConfigured && !!clusterId;

  // Group nodes by type for efficient fetching
  const podNodes = useMemo(
    () => nodes.filter((n) => n.type === 'pod' && n.namespace),
    [nodes]
  );
  const nodeNodes = useMemo(
    () => nodes.filter((n) => n.type === 'node'),
    [nodes]
  );
  const deploymentNodes = useMemo(
    () => nodes.filter((n) => n.type === 'deployment' && n.namespace),
    [nodes]
  );

  // Fetch pod metrics
  const podMetricsQueries = useQueries({
    queries: podNodes.map((node) => ({
      queryKey: ['topology-metrics', 'pod', clusterId, node.namespace, node.name],
      queryFn: () =>
        getPodMetrics(backendBaseUrl, clusterId!, node.namespace!, node.name),
      enabled: enabled && !!node.namespace,
      staleTime: 15_000,
      refetchInterval: options?.refetchInterval ?? 30_000,
    })),
  });

  // Fetch node metrics
  const nodeMetricsQueries = useQueries({
    queries: nodeNodes.map((node) => ({
      queryKey: ['topology-metrics', 'node', clusterId, node.name],
      queryFn: () => getNodeMetrics(backendBaseUrl, clusterId!, node.name),
      enabled: enabled,
      staleTime: 15_000,
      refetchInterval: options?.refetchInterval ?? 30_000,
    })),
  });

  // Fetch deployment metrics
  const deploymentMetricsQueries = useQueries({
    queries: deploymentNodes.map((node) => ({
      queryKey: ['topology-metrics', 'deployment', clusterId, node.namespace, node.name],
      queryFn: () =>
        getDeploymentMetrics(backendBaseUrl, clusterId!, node.namespace!, node.name),
      enabled: enabled && !!node.namespace,
      staleTime: 15_000,
      refetchInterval: options?.refetchInterval ?? 30_000,
    })),
  });

  // Aggregate metrics
  const metrics = useMemo<NodeMetrics>(() => {
    const result: NodeMetrics = {};

    // Process pod metrics
    podMetricsQueries.forEach((query, index) => {
      const node = podNodes[index];
      if (!node || !query.data) return;

      const data = query.data as PodMetricsResponse;
      result[node.id] = {
        cpu: parseCPU(data.CPU),
        memory: parseMemory(data.Memory),
      };
    });

    // Process node metrics
    nodeMetricsQueries.forEach((query, index) => {
      const node = nodeNodes[index];
      if (!node || !query.data) return;

      const data = query.data as NodeMetricsResponse;
      result[node.id] = {
        cpu: parseCPU(data.CPU),
        memory: parseMemory(data.Memory),
      };
    });

    // Process deployment metrics (aggregate pod metrics)
    deploymentMetricsQueries.forEach((query, index) => {
      const node = deploymentNodes[index];
      if (!node || !query.data) return;

      const data = query.data as DeploymentMetricsResponse;
      result[node.id] = {
        cpu: parseCPU(data.totalCPU),
        memory: parseMemory(data.totalMemory),
        // Traffic could be calculated from service metrics if available
      };
    });

    return result;
  }, [podMetricsQueries, nodeMetricsQueries, deploymentMetricsQueries, podNodes, nodeNodes, deploymentNodes]);

  const isLoading =
    podMetricsQueries.some((q) => q.isLoading) ||
    nodeMetricsQueries.some((q) => q.isLoading) ||
    deploymentMetricsQueries.some((q) => q.isLoading);

  const error =
    podMetricsQueries.find((q) => q.error)?.error ||
    nodeMetricsQueries.find((q) => q.error)?.error ||
    deploymentMetricsQueries.find((q) => q.error)?.error ||
    null;

  return { metrics, isLoading, error: error as Error | null };
}

/**
 * Calculate traffic percentage for edges based on service metrics
 * This is a placeholder - actual traffic data would come from service mesh or monitoring
 */
export function calculateTrafficMetrics(
  nodes: TopologyNode[],
  edges: Array<{ from: string; to: string; label?: string }>
): NodeMetrics {
  const trafficMetrics: NodeMetrics = {};

  // Simple heuristic: services have higher traffic
  nodes.forEach((node) => {
    if (node.type === 'service') {
      trafficMetrics[node.id] = {
        ...trafficMetrics[node.id],
        traffic: 80, // High traffic for services
      };
    } else if (node.type === 'ingress') {
      trafficMetrics[node.id] = {
        ...trafficMetrics[node.id],
        traffic: 100, // Highest traffic for ingress
      };
    }
  });

  return trafficMetrics;
}
