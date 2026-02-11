/**
 * Topology Data Transformer
 * Converts TopologyGraph (backend format) to TopologyViewer format (D3ForceTopology)
 * Enriches with metrics and computes visual properties
 */
import type { TopologyGraph, TopologyNode as BackendNode, TopologyEdge as BackendEdge } from '@/types/topology';
import type { TopologyNode, TopologyEdge, ResourceType } from '@/components/resources/D3ForceTopology';

// Map KubernetesKind to ResourceType (lowercase)
const KIND_TO_TYPE_MAP: Record<string, ResourceType> = {
  'Cluster': 'cluster',
  'Pod': 'pod',
  'Deployment': 'deployment',
  'ReplicaSet': 'replicaset',
  'StatefulSet': 'statefulset',
  'DaemonSet': 'daemonset',
  'Service': 'service',
  'Ingress': 'ingress',
  'ConfigMap': 'configmap',
  'Secret': 'secret',
  'Job': 'job',
  'CronJob': 'cronjob',
  'PersistentVolume': 'pv',
  'PersistentVolumeClaim': 'pvc',
  'StorageClass': 'storageclass',
  'Node': 'node',
  'Namespace': 'namespace',
  'ServiceAccount': 'serviceaccount',
  'Role': 'role',
  'ClusterRole': 'clusterrole',
  'RoleBinding': 'rolebinding',
  'ClusterRoleBinding': 'clusterrolebinding',
  'NetworkPolicy': 'networkpolicy',
  'HorizontalPodAutoscaler': 'hpa',
  'Endpoints': 'endpoint',
  'EndpointSlice': 'endpointslice',
};

// Map health status
const HEALTH_STATUS_MAP: Record<string, 'healthy' | 'warning' | 'error' | 'pending'> = {
  'healthy': 'healthy',
  'warning': 'warning',
  'critical': 'error',
  'unknown': 'pending',
};

export interface MetricsData {
  cpu?: number; // CPU usage in millicores
  memory?: number; // Memory usage in Mi
  traffic?: number; // Traffic percentage 0-100
}

export interface NodeMetrics {
  [nodeId: string]: MetricsData;
}

/**
 * Check if graph is cluster-centric (has cluster node)
 */
export function isClusterCentricGraph(graph: TopologyGraph): boolean {
  return graph.nodes.some(node => node.kind === 'Cluster');
}

/**
 * Transform backend TopologyGraph to TopologyViewer format
 * Ensures cluster node exists and is marked as center
 */
export function transformTopologyGraph(
  graph: TopologyGraph,
  metrics?: NodeMetrics,
  clusterName?: string
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  // Check if cluster node exists
  const hasClusterNode = graph.nodes.some(n => n.kind === 'Cluster');

  // If no cluster node exists and we have a cluster name, add it
  const nodesToTransform = hasClusterNode
    ? graph.nodes
    : [
      ...graph.nodes,
      {
        id: `Cluster/${clusterName || 'cluster'}`,
        kind: 'Cluster' as const,
        name: clusterName || 'cluster',
        namespace: '',
        apiVersion: 'v1',
        status: 'Ready' as const,
        metadata: { labels: {}, annotations: {}, createdAt: '', uid: '' },
        computed: { health: 'healthy' as const },
      }
    ];

  const nodes: TopologyNode[] = nodesToTransform.map((node) => {
    const resourceType = KIND_TO_TYPE_MAP[node.kind] || 'pod';
    const nodeMetrics = metrics?.[node.id];

    // Determine status
    let status: 'healthy' | 'warning' | 'error' | 'pending' = 'healthy';
    if (node.computed?.health) {
      status = HEALTH_STATUS_MAP[node.computed.health] || 'healthy';
    } else if (node.status === 'Failed' || node.status === 'NotReady') {
      status = 'error';
    } else if (node.status === 'Pending' || node.status === 'Terminating') {
      status = 'pending';
    } else if (node.status === 'Running' || node.status === 'Ready') {
      status = 'healthy';
    }

    // Check replica status for workloads
    if (node.computed?.replicas) {
      const { desired, ready } = node.computed.replicas;
      if (ready < desired) {
        status = ready > 0 ? 'warning' : 'error';
      }
    }

    const transformedNode = {
      id: node.id,
      type: resourceType,
      name: node.name,
      namespace: node.namespace || undefined,
      status,
      traffic: nodeMetrics?.traffic || node.traffic,
      // Mark cluster node as current/center for layout
      isCurrent: resourceType === 'cluster',
      // Store original node data for metrics/insights
      _original: node,
      _metrics: nodeMetrics,
    } as TopologyNode & { _original: BackendNode; _metrics?: MetricsData };

    return transformedNode;
  });

  const edges: TopologyEdge[] = graph.edges.map((edge) => {
    const sourceMetrics = metrics?.[edge.source];
    const targetMetrics = metrics?.[edge.target];

    // Calculate traffic based on relationship type and metrics
    let traffic: number | undefined;
    if (edge.relationshipType === 'routes' || edge.relationshipType === 'selects') {
      traffic = sourceMetrics?.traffic || targetMetrics?.traffic || edge.traffic;
    }

    return {
      from: edge.source,
      to: edge.target,
      label: edge.label,
      traffic,
      _original: edge,
    } as TopologyEdge & { _original: BackendEdge };
  });

  // Ensure cluster node exists for hierarchy
  const clusterNode = nodes.find(n => n.type === 'cluster');
  if (clusterNode) {
    const clusterNodeId = clusterNode.id;
    const nodeIds = nodes.filter(n => n.type === 'node').map(n => n.id);
    const namespaceIds = nodes.filter(n => n.type === 'namespace').map(n => n.id);

    // Add edges: cluster → nodes (manages)
    nodeIds.forEach(nodeId => {
      if (!edges.some(e => (e.from === clusterNodeId && e.to === nodeId) || (e.from === nodeId && e.to === clusterNodeId))) {
        edges.push({
          from: clusterNodeId,
          to: nodeId,
          label: 'manages',
          _original: {
            id: `edge-${clusterNodeId}-${nodeId}-manages`,
            source: clusterNodeId,
            target: nodeId,
            relationshipType: 'manages',
            label: 'manages',
            metadata: { derivation: 'inferred', confidence: 1 },
          } as BackendEdge,
        } as TopologyEdge & { _original: BackendEdge });
      }
    });

    // Add edges: cluster → namespaces (contains)
    namespaceIds.forEach(nsId => {
      if (!edges.some(e => (e.from === clusterNodeId && e.to === nsId) || (e.from === nsId && e.to === clusterNodeId))) {
        edges.push({
          from: clusterNodeId,
          to: nsId,
          label: 'contains',
          _original: {
            id: `edge-${clusterNodeId}-${nsId}-contains`,
            source: clusterNodeId,
            target: nsId,
            relationshipType: 'contains',
            label: 'contains',
            metadata: { derivation: 'inferred', confidence: 1 },
          } as BackendEdge,
        } as TopologyEdge & { _original: BackendEdge });
      }
    });
  }

  return { nodes, edges };
}

/**
 * Compute visual properties for nodes based on metrics
 */
export function computeNodeVisualProperties(
  node: TopologyNode & { _metrics?: MetricsData; _original?: BackendNode },
  baseRadius: number
): {
  radius: number;
  opacity: number;
  borderWidth: number;
} {
  const metrics = node._metrics;
  const original = node._original;

  let radius = baseRadius;
  let opacity = 1.0;
  let borderWidth = 2;

  // Scale radius based on CPU/memory utilization
  if (metrics?.cpu || metrics?.memory) {
    const cpuUtil = metrics.cpu ? Math.min(metrics.cpu / 1000, 1) : 0; // Normalize to 0-1 (assuming 1000m = 1 core max)
    const memUtil = metrics.memory ? Math.min(metrics.memory / 1000, 1) : 0; // Normalize to 0-1 (assuming 1000Mi max)
    const avgUtil = (cpuUtil + memUtil) / 2;
    radius = baseRadius * (1 + avgUtil * 0.3); // Scale up to 30% larger
  }

  // Adjust opacity based on health/status
  if (node.status === 'error') {
    opacity = 0.9;
    borderWidth = 3;
  } else if (node.status === 'warning') {
    opacity = 0.95;
    borderWidth = 2.5;
  } else if (node.status === 'pending') {
    opacity = 0.7;
  }

  // Scale based on replica count for workloads
  if (original?.computed?.replicas) {
    const { desired } = original.computed.replicas;
    if (desired > 1) {
      radius = baseRadius * (1 + Math.min(desired / 10, 0.5)); // Scale up based on replicas
    }
  }

  return { radius, opacity, borderWidth };
}

/**
 * Filter nodes and edges based on selected resources and health
 */
export function filterTopologyData(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: {
    selectedResources?: Set<string>;
    selectedHealth?: Set<string>;
    searchQuery?: string;
    namespace?: string; // Filter by specific namespace
  }
): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  let filteredNodes = nodes;

  // Filter by namespace FIRST - this is critical for namespace-specific views
  if (options.namespace && options.namespace !== 'all') {
    filteredNodes = filteredNodes.filter((node) => {
      // Exclude cluster node (not needed for namespace-filtered view)
      if (node.type === 'cluster') {
        return false;
      }
      
      // Include only the selected namespace node (exclude all other namespace nodes)
      if (node.type === 'namespace') {
        return node.name === options.namespace;
      }
      
      // Exclude cluster-scoped Node resources in namespace view - they create edge clutter
      // (edges from pods to nodes span across the graph). Only include namespace-scoped resources.
      if (node.type === 'node') {
        return false;
      }
      // Include cluster-scoped PVs/StorageClasses only if referenced by namespace PVCs (handled by edges)
      if (!node.namespace && ['storageclass', 'pv', 'ingressclass'].includes(node.type)) {
        return true;
      }
      
      // Include namespace-scoped resources only if they're in the selected namespace
      if (node.namespace === options.namespace) {
        return true;
      }
      
      // Exclude everything else
      return false;
    });
    
    // Mark the namespace node as current for layout centering
    filteredNodes = filteredNodes.map((node) => {
      if (node.type === 'namespace' && node.name === options.namespace) {
        return {
          ...node,
          isCurrent: true,
        };
      }
      return node;
    });
    
    // If namespace node doesn't exist, create it and add edges to all resources in that namespace
    const namespaceNodeExists = filteredNodes.some(n => n.type === 'namespace' && n.name === options.namespace);
    const namespaceNodeId = `Namespace/${options.namespace}`;
    if (!namespaceNodeExists && options.namespace) {
      filteredNodes.unshift({
        id: namespaceNodeId,
        type: 'namespace',
        name: options.namespace,
        namespace: undefined,
        status: 'healthy',
        isCurrent: true,
      });
      
      // Create edges from namespace to all resources in that namespace
      // This ensures the namespace is connected to its resources
      filteredNodes.forEach((node) => {
        if (node.namespace === options.namespace && node.id !== namespaceNodeId) {
          // Edge will be added below after filtering
        }
      });
    }
  }

  // Filter by resource type
  if (options.selectedResources && options.selectedResources.size > 0) {
    filteredNodes = filteredNodes.filter((node) => {
      const original = (node as any)._original;
      const kind = original?.kind || '';
      // Also check node.type (lowercase) for compatibility
      const type = node.type || '';
      return options.selectedResources!.has(kind) || options.selectedResources!.has(type);
    });
  }

  // Filter by health status
  if (options.selectedHealth && options.selectedHealth.size > 0) {
    filteredNodes = filteredNodes.filter((node) => {
      const original = (node as any)._original;
      const health = original?.computed?.health || node.status || 'unknown';
      // Map status to health if needed
      const healthStatus = typeof health === 'string' ? health.toLowerCase() : 'unknown';
      return options.selectedHealth!.has(health) || options.selectedHealth!.has(healthStatus);
    });
  }

  // Filter by search query
  if (options.searchQuery) {
    const query = options.searchQuery.toLowerCase();
    filteredNodes = filteredNodes.filter((node) => {
      return (
        node.name.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query) ||
        (node.namespace && node.namespace.toLowerCase().includes(query))
      );
    });
  }

  // Filter edges to only include connections between visible nodes
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
  let filteredEdges = edges.filter((edge) => {
    return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
  });

  // If namespace filtering is active, ensure namespace node has edges to all its resources
  if (options.namespace && options.namespace !== 'all') {
    const namespaceNodeId = `Namespace/${options.namespace}`;
    const namespaceNode = filteredNodes.find(n => n.id === namespaceNodeId || (n.type === 'namespace' && n.name === options.namespace));
    
    if (namespaceNode) {
      const nsId = namespaceNode.id;
      const existingEdgeIds = new Set(filteredEdges.map(e => `${e.from}-${e.to}`));
      
      // Add edges from namespace to all resources in that namespace
      filteredNodes.forEach((node) => {
        if (node.namespace === options.namespace && node.id !== nsId) {
          const edgeKey = `${nsId}-${node.id}`;
          if (!existingEdgeIds.has(edgeKey)) {
            // Check if edge already exists in original edges (might have different direction)
            const reverseEdgeKey = `${node.id}-${nsId}`;
            if (!existingEdgeIds.has(reverseEdgeKey)) {
              filteredEdges.push({
                from: nsId,
                to: node.id,
                label: 'contains',
              });
            }
          }
        }
      });
    }
  }

  return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Group nodes by namespace for hierarchical layout
 */
export function groupNodesByNamespace(nodes: TopologyNode[]): Map<string, TopologyNode[]> {
  const groups = new Map<string, TopologyNode[]>();

  nodes.forEach((node) => {
    const namespace = node.namespace || 'default';
    if (!groups.has(namespace)) {
      groups.set(namespace, []);
    }
    groups.get(namespace)!.push(node);
  });

  return groups;
}

/**
 * Calculate cluster health summary
 */
export function calculateClusterHealth(nodes: TopologyNode[]): {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  pending: number;
  healthScore: number; // 0-100
} {
  const counts = {
    total: nodes.length,
    healthy: 0,
    warning: 0,
    error: 0,
    pending: 0,
  };

  nodes.forEach((node) => {
    if (node.status === 'healthy') counts.healthy++;
    else if (node.status === 'warning') counts.warning++;
    else if (node.status === 'error') counts.error++;
    else if (node.status === 'pending') counts.pending++;
  });

  // Calculate health score: healthy = 100%, warning = 50%, error = 0%, pending = 25%
  const healthScore =
    counts.total > 0
      ? Math.round(
        ((counts.healthy * 100 + counts.warning * 50 + counts.pending * 25) /
          counts.total)
      )
      : 100;

  return { ...counts, healthScore };
}
