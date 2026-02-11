/**
 * Enhanced Topology Canvas Component
 * Production-grade topology rendering with Cytoscape.js
 * Features: Hierarchical layout, compound nodes, resource filtering
 */
import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle, type FC } from 'react';
import cytoscape, { Core, NodeSingular, EventObject, StylesheetStyle } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';
import { useTopologyStore } from '@/stores/topologyStore';
import { cn } from '@/lib/utils';
import type { TopologyGraph, TopologyNode, TopologyEdge, KubernetesKind, HealthStatus, RelationshipType } from '@/types/topology';

// Register layout extensions
if (!cytoscape.prototype.hasOwnProperty('dagre')) {
  cytoscape.use(dagre);
}
if (!cytoscape.prototype.hasOwnProperty('cola')) {
  cytoscape.use(cola);
}

export interface TopologyCanvasRef {
  zoomIn: () => void;
  zoomOut: () => void;
  fitToScreen: () => void;
  resetView: () => void;
  exportAsImage: (format: 'png' | 'svg') => string | undefined;
  relayout: (direction: 'TB' | 'LR') => void;
}

interface TopologyCanvasProps {
  graph: TopologyGraph;
  selectedResources: Set<KubernetesKind>;
  selectedRelationships: Set<RelationshipType>;
  selectedHealth: Set<HealthStatus | 'pending'>;
  searchQuery: string;
  layoutDirection: 'TB' | 'LR';
  centeredNodeId?: string;
  className?: string;
  onNodeSelect?: (node: TopologyNode | null) => void;
  onNodeDoubleClick?: (node: TopologyNode) => void;
}

// Resource type styling configuration
const resourceStyles: Record<string, { shape: string; color: string; borderColor: string; width: number; height: number }> = {
  Namespace: { shape: 'round-rectangle', color: '#a855f7', borderColor: '#9333ea', width: 100, height: 50 },
  Node: { shape: 'round-rectangle', color: '#f97316', borderColor: '#ea580c', width: 90, height: 40 },
  Deployment: { shape: 'round-rectangle', color: '#22c55e', borderColor: '#16a34a', width: 80, height: 40 },
  ReplicaSet: { shape: 'round-rectangle', color: '#10b981', borderColor: '#059669', width: 75, height: 38 },
  StatefulSet: { shape: 'round-rectangle', color: '#14b8a6', borderColor: '#0d9488', width: 80, height: 40 },
  DaemonSet: { shape: 'round-rectangle', color: '#06b6d4', borderColor: '#0891b2', width: 80, height: 40 },
  Pod: { shape: 'ellipse', color: '#3b82f6', borderColor: '#2563eb', width: 45, height: 45 },
  Service: { shape: 'diamond', color: '#22c55e', borderColor: '#16a34a', width: 50, height: 50 },
  ConfigMap: { shape: 'round-rectangle', color: '#f59e0b', borderColor: '#d97706', width: 70, height: 35 },
  Secret: { shape: 'round-rectangle', color: '#f97316', borderColor: '#ea580c', width: 70, height: 35 },
  Job: { shape: 'round-rectangle', color: '#eab308', borderColor: '#ca8a04', width: 70, height: 35 },
  CronJob: { shape: 'round-rectangle', color: '#fbbf24', borderColor: '#f59e0b', width: 70, height: 35 },
  PersistentVolumeClaim: { shape: 'round-rectangle', color: '#6366f1', borderColor: '#4f46e5', width: 70, height: 35 },
  PersistentVolume: { shape: 'round-rectangle', color: '#8b5cf6', borderColor: '#7c3aed', width: 70, height: 35 },
  StorageClass: { shape: 'round-rectangle', color: '#a855f7', borderColor: '#9333ea', width: 80, height: 35 },
  Ingress: { shape: 'round-rectangle', color: '#ef4444', borderColor: '#dc2626', width: 80, height: 35 },
  ServiceAccount: { shape: 'ellipse', color: '#ec4899', borderColor: '#db2777', width: 40, height: 40 },
  Role: { shape: 'round-rectangle', color: '#f43f5e', borderColor: '#e11d48', width: 60, height: 35 },
  ClusterRole: { shape: 'round-rectangle', color: '#f43f5e', borderColor: '#e11d48', width: 70, height: 35 },
  NetworkPolicy: { shape: 'pentagon', color: '#f43f5e', borderColor: '#e11d48', width: 45, height: 45 },
  HorizontalPodAutoscaler: { shape: 'round-rectangle', color: '#0ea5e9', borderColor: '#0284c7', width: 80, height: 35 },
  Endpoints: { shape: 'hexagon', color: '#64748b', borderColor: '#475569', width: 45, height: 45 },
  EndpointSlice: { shape: 'hexagon', color: '#64748b', borderColor: '#475569', width: 45, height: 45 },
  Cluster: { shape: 'ellipse', color: '#3b82f6', borderColor: '#2563eb', width: 80, height: 80 },
};

const getResourceStyle = (kind: string) => {
  return resourceStyles[kind] || { shape: 'round-rectangle', color: '#6b7280', borderColor: '#4b5563', width: 60, height: 35 };
};

const getHealthColor = (health: string) => {
  switch (health) {
    case 'healthy': return { bg: '#22c55e', border: '#16a34a' };
    case 'warning': return { bg: '#f59e0b', border: '#d97706' };
    case 'critical': return { bg: '#ef4444', border: '#dc2626' };
    default: return { bg: '#6b7280', border: '#4b5563' };
  }
};

export const TopologyCanvas = forwardRef<TopologyCanvasRef, TopologyCanvasProps>(({
  graph,
  selectedResources,
  selectedRelationships,
  selectedHealth,
  searchQuery,
  layoutDirection,
  centeredNodeId,
  className,
  onNodeSelect,
  onNodeDoubleClick,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    selectedNodeId,
    setSelectedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    setZoomLevel,
    isPaused,
  } = useTopologyStore();

  // Build stylesheet
  const getStylesheet = useCallback((): StylesheetStyle[] => {
    const styles: StylesheetStyle[] = [
      // Base node style
      {
        selector: 'node',
        style: {
          'label': 'data(displayLabel)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': 11,
          'font-family': 'Inter, system-ui, sans-serif',
          'font-weight': 500,
          'color': '#ffffff',
          'text-outline-color': 'data(bgColor)',
          'text-outline-width': 2,
          'text-max-width': '90px',
          'text-wrap': 'ellipsis',
          'min-zoomed-font-size': 8,
          'width': 'data(width)',
          'height': 'data(height)',
          'shape': 'data(shape)',
          'background-color': 'data(bgColor)',
          'border-width': 2,
          'border-color': 'data(borderColor)',
          'transition-property': 'background-color, border-color, opacity',
          'transition-duration': 200,
        } as any,
      },
      // Compound/parent nodes (groups)
      {
        selector: 'node.compound',
        style: {
          'background-opacity': 0.15,
          'border-style': 'dashed',
          'border-width': 2,
          'padding': '30px',
          'text-valign': 'top',
          'text-halign': 'center',
          'text-margin-y': 15,
          'font-size': 13,
          'font-weight': 600,
          'color': 'data(borderColor)',
          'text-outline-width': 0,
        } as any,
      },
      // Selected node
      {
        selector: 'node:selected',
        style: {
          'border-width': 4,
          'border-color': '#0ea5e9',
          'z-index': 999,
        } as any,
      },
      // Hovered node
      {
        selector: 'node:active',
        style: {
          'overlay-color': '#0ea5e9',
          'overlay-padding': 6,
          'overlay-opacity': 0.15,
        } as any,
      },
      // Faded nodes (blast radius)
      {
        selector: 'node.faded',
        style: {
          'opacity': 0.25,
        },
      },
      // Highlighted nodes (blast radius)
      {
        selector: 'node.highlighted',
        style: {
          'border-width': 3,
          'z-index': 100,
        },
      },
      // Hidden nodes
      {
        selector: 'node.hidden',
        style: {
          'display': 'none',
        },
      },
      // Base edge style
      {
        selector: 'edge',
        style: {
          'width': 1.5,
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.8,
          'curve-style': 'bezier',
          'opacity': 0.7,
          'transition-property': 'line-color, opacity, width',
          'transition-duration': 200,
        } as any,
      },
      // Ownership edges
      {
        selector: 'edge[relationshipType="owns"]',
        style: {
          'line-color': '#64748b',
          'target-arrow-color': '#64748b',
          'line-style': 'solid',
          'width': 2,
        },
      },
      // Selector edges
      {
        selector: 'edge[relationshipType="selects"]',
        style: {
          'line-color': '#94a3b8',
          'target-arrow-color': '#94a3b8',
          'line-style': 'dashed',
        },
      },
      // Traffic/routing edges
      {
        selector: 'edge[relationshipType="routes"], edge[relationshipType="exposes"]',
        style: {
          'line-color': '#22c55e',
          'target-arrow-color': '#22c55e',
          'width': 2,
        },
      },
      // Storage edges
      {
        selector: 'edge[relationshipType="mounts"], edge[relationshipType="stores"]',
        style: {
          'line-color': '#8b5cf6',
          'target-arrow-color': '#8b5cf6',
          'line-style': 'dotted',
        },
      },
      // Config edges
      {
        selector: 'edge[relationshipType="configures"]',
        style: {
          'line-color': '#f59e0b',
          'target-arrow-color': '#f59e0b',
          'line-style': 'dashed',
        },
      },
      // Schedule edges
      {
        selector: 'edge[relationshipType="schedules"]',
        style: {
          'line-color': '#f97316',
          'target-arrow-color': '#f97316',
        },
      },
      // Faded edges
      {
        selector: 'edge.faded',
        style: {
          'opacity': 0.15,
        },
      },
      // Highlighted edges
      {
        selector: 'edge.highlighted',
        style: {
          'width': 3,
          'opacity': 1,
          'z-index': 100,
        },
      },
      // Hidden edges
      {
        selector: 'edge.hidden',
        style: {
          'display': 'none',
        },
      },
    ];
    return styles;
  }, []);

  // Convert graph to Cytoscape elements with filtering
  const getFilteredElements = useCallback(() => {
    const elements: cytoscape.ElementDefinition[] = [];
    const visibleNodeIds = new Set<string>();
    const searchLower = searchQuery.toLowerCase();

    // Filter and add nodes
    graph.nodes.forEach((node) => {
      // Filter by resource type
      if (!selectedResources.has(node.kind)) return;

      // Filter by health
      const healthMatch = selectedHealth.has(node.computed.health as HealthStatus);
      if (!healthMatch && selectedHealth.size > 0) return;

      // Filter by search
      if (searchQuery && !node.name.toLowerCase().includes(searchLower) &&
        !node.kind.toLowerCase().includes(searchLower) &&
        !node.namespace?.toLowerCase().includes(searchLower)) {
        return;
      }

      const style = getResourceStyle(node.kind);
      const isCompound = node.kind === 'Namespace' || node.kind === 'Node';

      visibleNodeIds.add(node.id);

      // Create display label with kind prefix
      const kindPrefix = node.kind === 'Pod' ? '' : `${node.kind.toUpperCase()} • `;
      const displayLabel = node.kind === 'Namespace' ? `${node.name}\nNamespace` :
        node.kind === 'Node' ? `NODE • ${node.name}` : node.name;

      elements.push({
        data: {
          id: node.id,
          label: node.name,
          displayLabel,
          kind: node.kind,
          namespace: node.namespace,
          name: node.name,
          status: node.status,
          health: node.computed.health,
          bgColor: node.kind === 'Pod' ? getHealthColor(node.computed.health).bg : style.color,
          borderColor: node.kind === 'Pod' ? getHealthColor(node.computed.health).border : style.borderColor,
          width: style.width,
          height: style.height,
          shape: style.shape,
          ...node,
        },
        classes: isCompound ? 'compound' : undefined,
      });
    });

    // Filter and add edges
    graph.edges.forEach((edge) => {
      // Only add edges between visible nodes
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return;

      // Filter by relationship type
      if (!selectedRelationships.has(edge.relationshipType)) return;

      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          relationshipType: edge.relationshipType,
          ...edge,
        },
      });
    });

    return elements;
  }, [graph, selectedResources, selectedRelationships, selectedHealth, searchQuery]);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = cytoscape({
      container: containerRef.current,
      style: getStylesheet(),
      wheelSensitivity: 0.3,
      minZoom: 0.1,
      maxZoom: 5.0,
      boxSelectionEnabled: true,
      selectionType: 'single',
      layout: { name: 'preset' },
    });

    cyRef.current = cy;

    // Event listeners
    cy.on('tap', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      const nodeData = node.data();
      setSelectedNodeId(node.id());
      if (onNodeSelect) {
        onNodeSelect(nodeData as TopologyNode);
      }
    });

    cy.on('tap', (event: EventObject) => {
      if (event.target === cy) {
        setSelectedNodeId(null);
        if (onNodeSelect) onNodeSelect(null);
      }
    });

    cy.on('mouseover', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      setHoveredNodeId(node.id());
    });

    cy.on('mouseout', 'node', () => {
      setHoveredNodeId(null);
    });

    cy.on('zoom', () => {
      if (cyRef.current) {
        setZoomLevel(cyRef.current.zoom());
      }
    });

    cy.on('dblclick', 'node', (event: EventObject) => {
      const node = event.target as NodeSingular;
      const nodeData = node.data() as TopologyNode;
      if (onNodeDoubleClick) {
        onNodeDoubleClick(nodeData);
      }
    });

    setIsReady(true);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Update elements when graph or filters change
  useEffect(() => {
    if (!cyRef.current || !isReady) return;

    const cy = cyRef.current;
    const elements = getFilteredElements();

    cy.batch(() => {
      cy.elements().remove();
      cy.add(elements);
    });

    // Apply layout
    const layoutOptions: any = {
      name: 'dagre',
      rankDir: layoutDirection,
      nodeSep: 60,
      edgeSep: 30,
      rankSep: 80,
      padding: 50,
      animate: true,
      animationDuration: 500,
      fit: true,
    };

    cy.layout(layoutOptions).run();
  }, [graph, selectedResources, selectedRelationships, selectedHealth, searchQuery, layoutDirection, isReady, getFilteredElements]);

  // Handle hover/blast radius
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    cy.elements().removeClass('faded highlighted');

    if (hoveredNodeId && !isPaused) {
      const hoveredNode = cy.getElementById(hoveredNodeId);
      if (hoveredNode.length > 0) {
        const connected = hoveredNode.closedNeighborhood();
        cy.elements().not(connected).addClass('faded');
        connected.addClass('highlighted');
      }
    }
  }, [hoveredNodeId, isPaused]);

  // Handle selection
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;
    cy.elements().removeClass('selected');

    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.length > 0) {
        node.addClass('selected');
      }
    }
  }, [selectedNodeId]);

  // Handle centered node (for search navigation)
  useEffect(() => {
    if (!cyRef.current || !centeredNodeId || !isReady) return;

    const cy = cyRef.current;
    const node = cy.getElementById(centeredNodeId);
    if (node.length > 0) {
      // Center and zoom to the node
      cy.animate({
        center: { eles: node },
        zoom: Math.min(cy.zoom() * 1.5, 2.0),
      }, {
        duration: 500,
        easing: 'ease-out',
      });
      // Highlight the node
      node.addClass('selected');
      setSelectedNodeId(centeredNodeId);
      if (onNodeSelect) {
        const nodeData = node.data() as TopologyNode;
        onNodeSelect(nodeData);
      }
    }
  }, [centeredNodeId, isReady, onNodeSelect]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      cyRef.current?.zoom(cyRef.current.zoom() * 1.3);
      cyRef.current?.center();
    },
    zoomOut: () => {
      cyRef.current?.zoom(cyRef.current.zoom() / 1.3);
      cyRef.current?.center();
    },
    fitToScreen: () => {
      cyRef.current?.fit(undefined, 50);
    },
    resetView: () => {
      cyRef.current?.zoom(1);
      cyRef.current?.center();
    },
    exportAsImage: (format: 'png' | 'svg') => {
      if (!cyRef.current) return;
      if (format === 'svg') {
        return (cyRef.current as any).svg({ full: true, scale: 2 });
      }
      return cyRef.current.png({ full: true, scale: 2, bg: '#ffffff' });
    },
    relayout: (direction: 'TB' | 'LR') => {
      if (!cyRef.current) return;
      const layoutOptions: any = {
        name: 'dagre',
        rankDir: direction,
        nodeSep: 60,
        edgeSep: 30,
        rankSep: 80,
        padding: 50,
        animate: true,
        animationDuration: 500,
        fit: true,
      };
      cyRef.current.layout(layoutOptions).run();
    },
  }));

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cyRef.current) return;

      switch (e.key) {
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            cyRef.current.fit(undefined, 50);
          }
          break;
        case ' ':
          e.preventDefault();
          useTopologyStore.getState().togglePaused();
          break;
        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) {
            cyRef.current.zoom(1);
            cyRef.current.center();
          }
          break;
        case 'Escape':
          setSelectedNodeId(null);
          if (onNodeSelect) onNodeSelect(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedNodeId, onNodeSelect]);

  return (
    <div className={cn('relative w-full h-full bg-slate-50 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-border', className)}>
      <div
        ref={containerRef}
        className="w-full h-full"
        role="application"
        aria-label="Kubernetes topology graph"
        tabIndex={0}
      />

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/10 text-amber-600 border border-amber-500/20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          Updates Paused (Press Space to Resume)
        </div>
      )}
    </div>
  );
});

TopologyCanvas.displayName = 'TopologyCanvas';

export default TopologyCanvas;
