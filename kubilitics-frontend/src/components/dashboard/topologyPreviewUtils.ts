import type { TopologyGraph, TopologyNode, TopologyEdge, KubernetesKind } from '@/types/topology';

const PREVIEW_KINDS: Set<KubernetesKind> = new Set([
  'Node',
  'Namespace',
  'Deployment',
  'Service',
  'Pod',
  'ReplicaSet',
]);

/**
 * Filters topology graph to core kinds for dashboard preview (smaller, faster).
 */
export function filterTopologyForPreview(graph: TopologyGraph): TopologyGraph {
  const nodeIdSet = new Set<string>();
  const nodes: TopologyNode[] = [];
  for (const node of graph.nodes) {
    if (PREVIEW_KINDS.has(node.kind as KubernetesKind)) {
      nodes.push(node);
      nodeIdSet.add(node.id);
    }
  }
  const edges: TopologyEdge[] = graph.edges.filter(
    (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
  );
  return {
    ...graph,
    nodes,
    edges,
  };
}

export const DASHBOARD_TOPOLOGY_KINDS: KubernetesKind[] = Array.from(PREVIEW_KINDS);
