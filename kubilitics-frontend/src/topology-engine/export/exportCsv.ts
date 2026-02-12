/**
 * Export – CSV format
 * Resource summary table
 */
import type { TopologyGraph } from '../types/topology.types';

export function exportAsCSV(graph: TopologyGraph): string {
  const header = 'ID,Kind,Name,Namespace,Status,Health,API Version\n';
  const rows = graph.nodes.map(n =>
    `"${n.id}","${n.kind}","${n.name}","${n.namespace || ''}","${n.status}","${n.computed.health}","${n.apiVersion}"`
  ).join('\n');
  return header + rows;
}

export function downloadCSV(graph: TopologyGraph, filename = 'topology.csv') {
  const data = exportAsCSV(graph);
  const blob = new Blob([data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
