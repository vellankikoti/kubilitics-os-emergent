/**
 * Topology Engine – Public API
 * Everything topology-related, portable and self-contained.
 */

// ─── Types ────────────────────────────────────────────────────
export type {
  KubernetesKind,
  ResourceStatus,
  HealthStatus,
  AbstractionLevel,
  AbstractionLevelConfig,
  RelationshipType,
  TopologyNode,
  TopologyEdge,
  GraphWarning,
  TopologyGraph,
  TopologyFilters,
  ExportFormat,
  HeatMapMode,
  TopologyViewState,
  HighlightState,
  HighlightContext,
  ExportOptions,
  TopologyCanvasRef,
} from './types/topology.types';

export { ABSTRACTION_LEVELS } from './types/topology.types';

// ─── Core ─────────────────────────────────────────────────────
export { GraphModel } from './core/graphModel';
export { applyAbstraction, getRecommendedAbstraction, type FilterOptions } from './core/abstractionEngine';
export { getConnectedComponent, getUpstreamChain, getDownstreamChain } from './core/graphTraversal';
export { AdjacencyMap } from './core/adjacencyMap';

// ─── Renderer ─────────────────────────────────────────────────
export { TopologyCanvas, type TopologyCanvasProps } from './renderer/TopologyCanvas';
export { applyELKLayout, getCytoscapeELKLayout, useELKLayout } from './renderer/useELKLayout';
export {
  NODE_COLORS, NODE_ICONS,
  getNodeColor, getNodeDataAttributes, getHealthColor, getHeatmapColor,
  getStylesheet, CANVAS_BG, CANVAS_BG_DARK, EXPORT_BG,
} from './renderer/styles';
// D3.js Force-Directed Topology
export { D3TopologyCanvas } from './renderer/D3TopologyCanvas';
export { D3MiniMap } from './renderer/D3MiniMap';
export type { TopologyNode as D3TopologyNode, TopologyEdge as D3TopologyEdge, ResourceType } from './renderer/D3TopologyCanvas';

// D3.js Hierarchical Topology
export { D3HierarchicalTopologyCanvas } from './renderer/D3HierarchicalTopologyCanvas';
export type { HierarchicalNode } from './renderer/D3HierarchicalTopologyCanvas';
export { convertToHierarchicalTree } from './utils/hierarchicalAdapter';

// ─── Interaction ──────────────────────────────────────────────
export { useHighlightEngine } from './interaction/useHighlightEngine';
export { useSelectionEngine } from './interaction/useSelectionEngine';
export { createStateMachine } from './interaction/stateMachine';

// ─── Export ───────────────────────────────────────────────────
export { exportAsSVG, downloadSVG } from './export/exportSvg';
export { exportAsPNG, downloadPNG } from './export/exportPng';
export { downloadPDF } from './export/exportPdf';
export { exportAsJSON, downloadJSON } from './export/exportJson';
export { exportAsCSV, downloadCSV } from './export/exportCsv';
export { generatePosterMetadata, applyPosterLayout } from './export/posterLayout';

// ─── Utils ────────────────────────────────────────────────────
export { toCytoscapeNodeData, KIND_LABELS, getKindColor } from './utils/nodeHelpers';
export { toCytoscapeEdgeData, RELATIONSHIP_CONFIG } from './utils/edgeHelpers';
export { adaptTopologyGraph, validateTopologyGraph } from './utils/topologyAdapter';
export { convertToD3Topology } from './utils/d3Adapter';
