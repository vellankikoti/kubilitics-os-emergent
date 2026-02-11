/**
 * Namespace Topology Hook
 * Builds topology graph for a specific namespace, showing all resources within that namespace
 * and their relationships, plus cluster-scoped resources that relate to them
 */
import { useMemo } from 'react';
import { useClusterTopologyGraph } from './useClusterTopologyGraph';
import { transformTopologyGraph } from '@/utils/topologyDataTransformer';
import { useClusterStore } from '@/stores/clusterStore';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';
import type { TopologyGraph } from '@/types/topology';

interface NamespaceTopologyResult {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Builds namespace-scoped topology graph
 * Shows the namespace node at the center with all resources within it
 * @param namespace The namespace name to build topology for
 */
export function useNamespaceTopology(namespace: string | undefined): NamespaceTopologyResult {
  const { activeCluster } = useClusterStore();
  
  // Use cluster topology graph filtered by namespace
  const clusterTopology = useClusterTopologyGraph(namespace);

  // Transform the cluster topology to TopologyGraph format, then to D3ForceTopology format
  const { nodes, edges } = useMemo(() => {
    if (!namespace || clusterTopology.nodes.length === 0) {
      // Return namespace node only if no other resources
      if (namespace) {
        return {
          nodes: [{
            id: `Namespace/${namespace}`,
            type: 'namespace' as const,
            name: namespace,
            namespace: undefined,
            status: 'healthy' as const,
            isCurrent: true,
          }],
          edges: [],
        };
      }
      return { nodes: [], edges: [] };
    }

    // Convert cluster topology nodes/edges to TopologyGraph format
    const topologyGraph: TopologyGraph = {
      schemaVersion: '1.0',
      nodes: clusterTopology.nodes,
      edges: clusterTopology.edges,
      metadata: {
        clusterId: activeCluster?.id || '',
        generatedAt: new Date().toISOString(),
        layoutSeed: `namespace-${namespace}-${Date.now()}`,
        isComplete: true,
        warnings: [],
      },
    };

    // Transform to D3ForceTopology format
    const transformed = transformTopologyGraph(topologyGraph, undefined, activeCluster?.name);

    // Filter to only show:
    // 1. The selected namespace node (only)
    // 2. Resources within that namespace
    // 3. Cluster-scoped resources (nodes, storageclasses, pvs, ingressclasses)
    // 4. Exclude cluster node and other namespace nodes
    const namespaceNodeId = `Namespace/${namespace}`;
    const filteredNodes = transformed.nodes.filter(node => {
      // Include the selected namespace node
      if (node.type === 'namespace' && node.name === namespace) {
        return true;
      }
      
      // Exclude other namespace nodes
      if (node.type === 'namespace' && node.name !== namespace) {
        return false;
      }
      
      // Exclude cluster node (not needed for namespace view)
      if (node.type === 'cluster') {
        return false;
      }
      
      // Include cluster-scoped resources (nodes, storageclasses, pvs, ingressclasses)
      if (!node.namespace && ['node', 'storageclass', 'pv', 'ingressclass'].includes(node.type)) {
        return true;
      }
      
      // Include namespace-scoped resources only if they're in the selected namespace
      if (node.namespace === namespace) {
        return true;
      }
      
      // Exclude everything else
      return false;
    });

    // Mark namespace node as current for layout centering
    const transformedNodes = filteredNodes.map(node => {
      if (node.id === namespaceNodeId || (node.type === 'namespace' && node.name === namespace)) {
        return {
          ...node,
          isCurrent: true,
        };
      }
      return node;
    });

    // If namespace node doesn't exist, add it
    if (!transformedNodes.find(n => n.type === 'namespace' && n.name === namespace)) {
      transformedNodes.unshift({
        id: namespaceNodeId,
        type: 'namespace',
        name: namespace,
        namespace: undefined,
        status: 'healthy',
        isCurrent: true,
      });
    }

    // Filter edges to only include connections between visible nodes
    const visibleNodeIds = new Set(transformedNodes.map(n => n.id));
    const filteredEdges = transformed.edges.filter(edge => {
      return visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to);
    });

    return {
      nodes: transformedNodes,
      edges: filteredEdges,
    };
  }, [namespace, clusterTopology.nodes, clusterTopology.edges, activeCluster]);

  return {
    nodes,
    edges,
    isLoading: clusterTopology.isLoading,
    error: clusterTopology.error,
  };
}
