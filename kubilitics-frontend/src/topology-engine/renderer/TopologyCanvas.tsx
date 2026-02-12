/**
 * TopologyCanvas – Crown Jewel Renderer
 * Cytoscape.js + ELK layered layout
 * Enterprise-grade, light background, premium design
 * Features: edge labels, traffic flow, heatmap, minimap, draggable nodes
 */
import {
  useRef, useEffect, useCallback, useState,
  forwardRef, useImperativeHandle,
} from 'react';
import cytoscape, { Core, EventObject, NodeSingular } from 'cytoscape';
import elk from 'cytoscape-elk';
import { getStylesheet, CANVAS_BG, getHeatmapColor } from './styles';
import { applyELKLayout } from './useELKLayout';
import { useHighlightEngine } from '../interaction/useHighlightEngine';
import { useSelectionEngine } from '../interaction/useSelectionEngine';
import { toCytoscapeNodeData } from '../utils/nodeHelpers';
import { toCytoscapeEdgeData } from '../utils/edgeHelpers';
import { applyAbstraction, type FilterOptions } from '../core/abstractionEngine';
import { cn } from '@/lib/utils';
import type {
  TopologyGraph, TopologyNode, TopologyCanvasRef,
  KubernetesKind, HealthStatus, RelationshipType, AbstractionLevel,
  HeatMapMode,
} from '../types/topology.types';

// Register ELK once
let elkRegistered = false;
try {
  if (!elkRegistered) { cytoscape.use(elk); elkRegistered = true; }
} catch { /* already registered */ }

export interface TopologyCanvasProps {
  graph: TopologyGraph;
  selectedResources: Set<KubernetesKind>;
  selectedRelationships: Set<RelationshipType>;
  selectedHealth: Set<HealthStatus | 'pending'>;
  searchQuery: string;
  abstractionLevel: AbstractionLevel;
  namespace?: string;
  centeredNodeId?: string;
  className?: string;
  isPaused?: boolean;
  heatMapMode?: HeatMapMode;
  trafficFlowEnabled?: boolean;
  onNodeSelect?: (node: TopologyNode | null) => void;
  onNodeDoubleClick?: (node: TopologyNode) => void;
}

export const TopologyCanvas = forwardRef<TopologyCanvasRef, TopologyCanvasProps>(({
  graph,
  selectedResources,
  selectedRelationships,
  selectedHealth,
  searchQuery,
  abstractionLevel,
  namespace,
  centeredNodeId,
  className,
  isPaused = false,
  heatMapMode = 'none',
  trafficFlowEnabled = false,
  onNodeSelect,
  onNodeDoubleClick,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const minimapRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const trafficAnimRef = useRef<number | null>(null);

  const highlightEngine = useHighlightEngine({ isPaused });
  const selectionEngine = useSelectionEngine({ onNodeSelect, onNodeDoubleClick });

  // Build filtered Cytoscape elements
  const getFilteredElements = useCallback(() => {
    const filterOptions: FilterOptions = {
      abstractionLevel,
      selectedKinds: selectedResources,
      selectedRelationships,
      selectedHealth,
      searchQuery,
      namespace,
    };
    const filtered = applyAbstraction(graph, filterOptions);
    const elements: cytoscape.ElementDefinition[] = [];

    for (const node of filtered.nodes) {
      elements.push(toCytoscapeNodeData(node));
    }
    for (const edge of filtered.edges) {
      elements.push(toCytoscapeEdgeData(edge));
    }
    return elements;
  }, [graph, selectedResources, selectedRelationships, selectedHealth, searchQuery, abstractionLevel, namespace]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: getStylesheet(),
      wheelSensitivity: 0.3,
      minZoom: 0.05,
      maxZoom: 5.0,
      boxSelectionEnabled: true,
      selectionType: 'single',
      autoungrabify: false,
      layout: { name: 'preset' },
    });
    cyRef.current = cy;

    // Attach interaction engines
    highlightEngine.attachListeners(cy, containerRef.current);
    selectionEngine.attachListeners(cy);

    setIsReady(true);
    return () => {
      if (trafficAnimRef.current) cancelAnimationFrame(trafficAnimRef.current);
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Update elements on data/filter change
  useEffect(() => {
    if (!cyRef.current || !isReady) return;
    const cy = cyRef.current;
    const elements = getFilteredElements();

    cy.batch(() => {
      cy.elements().remove();
      if (elements.length > 0) {
        cy.add(elements);
      }
    });

    if (elements.length === 0) return;

    applyELKLayout(cy).then(() => {
      if (centeredNodeId) {
        const node = cy.getElementById(centeredNodeId);
        if (node.length > 0) {
          cy.center(node);
          node.addClass('current');
        }
      } else {
        cy.fit(undefined, 50);
      }
      updateMinimap();
    });
  }, [graph, selectedResources, selectedRelationships, selectedHealth, searchQuery, abstractionLevel, namespace, isReady, getFilteredElements, centeredNodeId]);

  // Heatmap mode
  useEffect(() => {
    if (!cyRef.current || !isReady) return;
    const cy = cyRef.current;

    cy.batch(() => {
      cy.nodes().removeClass('heatmap-green heatmap-yellow heatmap-orange heatmap-red');

      if (heatMapMode === 'none') return;

      const nodes = cy.nodes();
      let maxVal = 0;
      nodes.forEach(n => {
        const nodeData = n.data('_nodeData') as TopologyNode | undefined;
        if (!nodeData) return;
        const val = heatMapMode === 'cpu'
          ? (nodeData.computed?.cpuUsage ?? 0)
          : (nodeData.computed?.restartCount ?? 0);
        if (val > maxVal) maxVal = val;
      });

      nodes.forEach(n => {
        const nodeData = n.data('_nodeData') as TopologyNode | undefined;
        if (!nodeData) return;
        const val = heatMapMode === 'cpu'
          ? (nodeData.computed?.cpuUsage ?? 0)
          : (nodeData.computed?.restartCount ?? 0);
        const color = getHeatmapColor(val, maxVal);
        if (color === '#22c55e') n.addClass('heatmap-green');
        else if (color === '#eab308') n.addClass('heatmap-yellow');
        else if (color === '#f97316') n.addClass('heatmap-orange');
        else n.addClass('heatmap-red');
      });
    });
  }, [heatMapMode, isReady]);

  // Traffic flow animation
  useEffect(() => {
    if (!cyRef.current || !isReady) return;
    const cy = cyRef.current;

    if (trafficAnimRef.current) {
      cancelAnimationFrame(trafficAnimRef.current);
      trafficAnimRef.current = null;
    }

    if (!trafficFlowEnabled) {
      cy.edges().removeClass('traffic-flow');
      return;
    }

    // Animate traffic on routing/expose edges
    const trafficEdges = cy.edges('[relationshipType="routes"], [relationshipType="exposes"], [relationshipType="selects"]');
    let step = 0;

    function animate() {
      step++;
      const batchSize = Math.ceil(trafficEdges.length / 3);
      cy.batch(() => {
        trafficEdges.removeClass('traffic-flow');
        const offset = step % 3;
        for (let i = offset * batchSize; i < Math.min((offset + 1) * batchSize, trafficEdges.length); i++) {
          trafficEdges[i]?.addClass('traffic-flow');
        }
      });
      trafficAnimRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 600);
      });
    }
    animate();

    return () => {
      if (trafficAnimRef.current) cancelAnimationFrame(trafficAnimRef.current);
    };
  }, [trafficFlowEnabled, isReady]);

  // Minimap rendering
  const updateMinimap = useCallback(() => {
    if (!cyRef.current || !minimapRef.current) return;
    const cy = cyRef.current;
    const canvas = minimapRef.current.querySelector('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, w, h);

    const bb = cy.elements().boundingBox();
    if (bb.w === 0 || bb.h === 0) return;
    const scale = Math.min(w / bb.w, h / bb.h) * 0.85;
    const ox = (w - bb.w * scale) / 2 - bb.x1 * scale;
    const oy = (h - bb.h * scale) / 2 - bb.y1 * scale;

    // Draw edges
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    cy.edges().forEach(e => {
      const sp = e.sourceEndpoint();
      const tp = e.targetEndpoint();
      ctx.beginPath();
      ctx.moveTo(sp.x * scale + ox, sp.y * scale + oy);
      ctx.lineTo(tp.x * scale + ox, tp.y * scale + oy);
      ctx.stroke();
    });

    // Draw nodes
    cy.nodes().forEach(n => {
      const pos = n.position();
      const color = n.data('bgColor') || '#6b7280';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x * scale + ox, pos.y * scale + oy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Viewport rectangle
    const ext = cy.extent();
    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      ext.x1 * scale + ox,
      ext.y1 * scale + oy,
      ext.w * scale,
      ext.h * scale
    );
  }, []);

  // Update minimap on viewport changes
  useEffect(() => {
    if (!cyRef.current || !isReady) return;
    const cy = cyRef.current;
    const handler = () => requestAnimationFrame(updateMinimap);
    cy.on('viewport', handler);
    cy.on('layoutstop', handler);
    return () => {
      cy.off('viewport', handler);
      cy.off('layoutstop', handler);
    };
  }, [isReady, updateMinimap]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
      cyRef.current?.center();
    },
    zoomOut: () => {
      cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
      cyRef.current?.center();
    },
    fitToScreen: () => { cyRef.current?.fit(undefined, 50); },
    resetView: () => {
      cyRef.current?.zoom(1);
      cyRef.current?.center();
    },
    exportAsSVG: () => {
      if (!cyRef.current) return;
      try { return (cyRef.current as any).svg({ full: true, scale: 2 }); } catch { return undefined; }
    },
    exportAsPNG: () => {
      if (!cyRef.current) return;
      return cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    },
    relayout: () => {
      if (cyRef.current) applyELKLayout(cyRef.current);
    },
    getNodeCount: () => cyRef.current?.nodes().length || 0,
    getEdgeCount: () => cyRef.current?.edges().length || 0,
  }));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cyRef.current) return;
      switch (e.key) {
        case 'f': case 'F':
          if (!e.metaKey && !e.ctrlKey) cyRef.current.fit(undefined, 50);
          break;
        case 'r': case 'R':
          if (!e.metaKey && !e.ctrlKey) { cyRef.current.zoom(1); cyRef.current.center(); }
          break;
        case 'Escape':
          onNodeSelect?.(null);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNodeSelect]);

  return (
    <div className={cn('relative w-full h-full rounded-xl overflow-hidden border border-border', className)}
         style={{ background: CANVAS_BG }}>
      <div
        ref={containerRef}
        className="w-full h-full"
        role="application"
        aria-label="Kubernetes topology graph"
        tabIndex={0}
      />

      {/* Minimap */}
      <div
        ref={minimapRef}
        className="absolute bottom-3 right-3 w-[160px] h-[100px] rounded-lg border border-border bg-background/90 backdrop-blur-sm shadow-lg overflow-hidden"
      >
        <canvas width={160} height={100} className="w-full h-full" />
        <div className="absolute top-1 left-1.5 text-[8px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Minimap
        </div>
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/10 text-amber-700 border border-amber-500/20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Updates Paused (Space to Resume)
        </div>
      )}
    </div>
  );
});

TopologyCanvas.displayName = 'TopologyCanvas';
export default TopologyCanvas;
