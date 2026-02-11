/**
 * Cluster Layout Engine
 * Multiple layout algorithms for cluster topology visualization
 */
import { useMemo } from 'react';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';
import type { LayoutOptions } from '@/components/resources/TopologyViewer';

export type LayoutMode = 'hierarchical' | 'force-directed' | 'namespace-grouped' | 'application-grouped' | 'health-clustered';

export interface LayoutConfig {
  mode: LayoutMode;
  options?: LayoutOptions;
}

/**
 * Cluster hierarchy spacing configuration (Apple-grade spacing)
 */
export const CLUSTER_HIERARCHY_SPACING: Record<number, number> = {
  0: 0,      // Level 0 (cluster) - no spacing before
  1: 120,    // Level 0-1 gap: Cluster to Nodes
  2: 100,    // Level 1-2 gap: Nodes to Namespaces
  3: 80,     // Level 2-3 gap: Namespaces to Workloads
  4: 60,     // Level 3-4 gap: Workloads to ReplicaSets
  5: 50,     // Level 4-5 gap: ReplicaSets to Pods
  6: 40,     // Level 5-6 gap: Pods to Supporting
};

/**
 * Calculate optimal layout configuration based on graph characteristics
 */
export function calculateLayoutConfig(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  mode: LayoutMode = 'hierarchical'
): LayoutConfig {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const namespaceCount = new Set(nodes.map(n => n.namespace).filter(Boolean)).size;

  // Determine best layout based on graph size and characteristics
  let optimalMode: LayoutMode = mode;

  if (mode === 'hierarchical' && nodeCount > 200) {
    // Switch to force-directed for very large graphs
    optimalMode = 'force-directed';
  }

  if (mode === 'namespace-grouped' && namespaceCount < 2) {
    // Not enough namespaces for grouping
    optimalMode = 'hierarchical';
  }

  const config: LayoutConfig = {
    mode: optimalMode,
  };

  // Configure layout options based on mode
  switch (optimalMode) {
    case 'hierarchical':
      config.options = {
        verticalSpacing: nodeCount > 100 ? 40 : 60,
        horizontalSpacing: nodeCount > 100 ? 30 : 50,
        level1GridCols: nodeCount > 50 ? Math.ceil(Math.sqrt(nodeCount / 5)) : undefined,
      };
      break;

    case 'namespace-grouped':
      config.options = {
        verticalSpacing: 80,
        horizontalSpacing: 100,
        level1GridCols: Math.ceil(Math.sqrt(namespaceCount)),
      };
      break;

    case 'force-directed':
      // Force-directed layouts are handled by D3ForceTopology
      config.options = {
        verticalSpacing: 50,
        horizontalSpacing: 50,
      };
      break;

    default:
      config.options = {
        verticalSpacing: 60,
        horizontalSpacing: 50,
      };
  }

  return config;
}

/**
 * Group nodes by namespace for namespace-grouped layout
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
 * Group nodes by application labels (if available)
 */
export function groupNodesByApplication(nodes: TopologyNode[]): Map<string, TopologyNode[]> {
  const groups = new Map<string, TopologyNode[]>();
  
  nodes.forEach((node) => {
    const original = (node as any)._original;
    const labels = original?.metadata?.labels || {};
    
    // Try common app label patterns
    const appName = labels['app'] || labels['app.kubernetes.io/name'] || labels['name'] || 'default';
    
    if (!groups.has(appName)) {
      groups.set(appName, []);
    }
    groups.get(appName)!.push(node);
  });

  return groups;
}

/**
 * Group nodes by health status for health-clustered layout
 */
export function groupNodesByHealth(nodes: TopologyNode[]): Map<string, TopologyNode[]> {
  const groups = new Map<string, TopologyNode[]>();
  
  nodes.forEach((node) => {
    const status = node.status || 'unknown';
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(node);
  });

  return groups;
}

/**
 * Calculate layout statistics
 */
export function calculateLayoutStats(nodes: TopologyNode[], edges: TopologyEdge[]): {
  nodeCount: number;
  edgeCount: number;
  namespaceCount: number;
  avgConnectionsPerNode: number;
  maxConnections: number;
  isolatedNodes: number;
} {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const namespaceCount = new Set(nodes.map(n => n.namespace).filter(Boolean)).size;

  // Calculate connections per node
  const connections = new Map<string, number>();
  edges.forEach((edge) => {
    connections.set(edge.from, (connections.get(edge.from) || 0) + 1);
    connections.set(edge.to, (connections.get(edge.to) || 0) + 1);
  });

  const connectionCounts = Array.from(connections.values());
  const avgConnectionsPerNode = connectionCounts.length > 0
    ? connectionCounts.reduce((a, b) => a + b, 0) / connectionCounts.length
    : 0;
  const maxConnections = connectionCounts.length > 0 ? Math.max(...connectionCounts) : 0;
  const isolatedNodes = nodeCount - connections.size;

  return {
    nodeCount,
    edgeCount,
    namespaceCount,
    avgConnectionsPerNode,
    maxConnections,
    isolatedNodes,
  };
}
