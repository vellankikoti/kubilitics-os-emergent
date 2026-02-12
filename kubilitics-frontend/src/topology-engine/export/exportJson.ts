/**
 * Export – JSON format
 * Full topology graph as structured JSON
 */
import type { TopologyGraph } from '../types/topology.types';

export function exportAsJSON(graph: TopologyGraph): string {
  return JSON.stringify(graph, null, 2);
}

export function downloadJSON(graph: TopologyGraph, filename = 'topology.json') {
  const data = exportAsJSON(graph);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
