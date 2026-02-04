/**
 * CytoscapeCanvas Component
 * Production-grade topology rendering with Cytoscape.js
 * Per PRD Part 3: Topology Rendering Engine
 */
import { useRef, useEffect, useCallback, useState, type FC } from 'react';
import cytoscape, { Core, NodeSingular, EventObject } from 'cytoscape';
import { createCytoscapeInstance, getStatusColor, getStatusBorderColor } from '../utils/cytoscapeConfig';
import { applyLayout, generateLayoutSeed } from '../utils/layoutEngine';
import { useTopologyStore } from '@/stores/topologyStore';
import { cn } from '@/lib/utils';
import type { TopologyGraph, TopologyNode, TopologyEdge } from '@/types/topology';

interface CytoscapeCanvasProps {
  /** Graph data */
  graph: TopologyGraph;
  /** Node to center on initially */
  centeredNodeId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Callback when node is selected */
  onNodeSelect?: (node: TopologyNode | null) => void;
  /** Callback when edge is selected */
  onEdgeSelect?: (edge: TopologyEdge | null) => void;
  /** Callback when node is double-clicked */
  onNodeDoubleClick?: (node: TopologyNode) => void;
}

export const CytoscapeCanvas: FC<CytoscapeCanvasProps> = ({
  graph,
  centeredNodeId,
  className,
  onNodeSelect,
  onEdgeSelect,
  onNodeDoubleClick,
}) => {
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
    layoutMode,
    layoutSeed,
    setLayoutSeed,
  } = useTopologyStore();

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    const cy = createCytoscapeInstance(containerRef.current);
    cyRef.current = cy;

    // Set up event listeners
    cy.on('tap', 'node', handleNodeClick);
    cy.on('tap', 'edge', handleEdgeClick);
    cy.on('tap', handleBackgroundClick);
    cy.on('mouseover', 'node', handleNodeHover);
    cy.on('mouseout', 'node', handleNodeUnhover);
    cy.on('zoom', handleZoom);
    cy.on('dblclick', 'node', handleNodeDblClick);

    setIsReady(true);

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Update graph data
  useEffect(() => {
    if (!cyRef.current || !isReady) return;

    const cy = cyRef.current;

    // Convert graph to Cytoscape format
    const elements = graphToCytoscapeElements(graph);

    // Batch update for performance
    cy.batch(() => {
      // Clear existing elements
      cy.elements().remove();

      // Add all elements
      cy.add(elements);
    });

    // Generate or use existing seed
    const seed = layoutSeed || generateLayoutSeed(graph.nodes, graph.edges);
    if (!layoutSeed) {
      setLayoutSeed(seed);
    }

    // Apply layout
    applyLayout(cy, seed).then(() => {
      // Center on specified node if provided
      if (centeredNodeId) {
        const node = cy.getElementById(centeredNodeId);
        if (node.length > 0) {
          cy.center(node);
        }
      } else {
        cy.fit(undefined, 50);
      }
    });
  }, [graph, isReady, centeredNodeId]);

  // Handle selection state
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;

    // Clear previous selection
    cy.elements().removeClass('selected');

    // Apply new selection
    if (selectedNodeId) {
      const node = cy.getElementById(selectedNodeId);
      if (node.length > 0) {
        node.addClass('selected');
      }
    }
  }, [selectedNodeId]);

  // Handle hover state (blast radius visualization)
  useEffect(() => {
    if (!cyRef.current) return;

    const cy = cyRef.current;

    // Clear previous hover effects
    cy.elements().removeClass('faded highlighted');

    // Apply blast radius visualization
    if (hoveredNodeId && !isPaused) {
      const hoveredNode = cy.getElementById(hoveredNodeId);
      if (hoveredNode.length > 0) {
        // Get connected elements (blast radius)
        const connected = hoveredNode.closedNeighborhood();

        // Fade unconnected elements
        cy.elements().not(connected).addClass('faded');

        // Highlight connected elements
        connected.addClass('highlighted');
      }
    }
  }, [hoveredNodeId, isPaused]);

  // Event handlers
  const handleNodeClick = useCallback(
    (event: EventObject) => {
      const node = event.target as NodeSingular;
      const nodeData = node.data();

      setSelectedNodeId(node.id());
      
      if (onNodeSelect) {
        onNodeSelect(nodeData as TopologyNode);
      }
    },
    [setSelectedNodeId, onNodeSelect]
  );

  const handleEdgeClick = useCallback(
    (event: EventObject) => {
      const edge = event.target;
      const edgeData = edge.data() as TopologyEdge;
      if (onEdgeSelect) {
        onEdgeSelect(edgeData);
      }
    },
    [onEdgeSelect]
  );

  const handleBackgroundClick = useCallback(
    (event: EventObject) => {
      if (event.target === cyRef.current) {
        setSelectedNodeId(null);
        if (onNodeSelect) {
          onNodeSelect(null);
        }
      }
    },
    [setSelectedNodeId, onNodeSelect]
  );

  const handleNodeHover = useCallback(
    (event: EventObject) => {
      const node = event.target as NodeSingular;
      setHoveredNodeId(node.id());
    },
    [setHoveredNodeId]
  );

  const handleNodeUnhover = useCallback(() => {
    setHoveredNodeId(null);
  }, [setHoveredNodeId]);

  const handleZoom = useCallback(() => {
    if (cyRef.current) {
      setZoomLevel(cyRef.current.zoom());
    }
  }, [setZoomLevel]);

  const handleNodeDblClick = useCallback(
    (event: EventObject) => {
      const node = event.target as NodeSingular;
      const nodeData = node.data() as TopologyNode;
      if (onNodeDoubleClick) {
        onNodeDoubleClick(nodeData);
      }
    },
    [onNodeDoubleClick]
  );

  // Exposed methods
  const zoomIn = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() * 1.2);
    cyRef.current?.center();
  }, []);

  const zoomOut = useCallback(() => {
    cyRef.current?.zoom(cyRef.current.zoom() / 1.2);
    cyRef.current?.center();
  }, []);

  const resetZoom = useCallback(() => {
    cyRef.current?.zoom(1);
    cyRef.current?.center();
  }, []);

  const fitToScreen = useCallback(() => {
    cyRef.current?.fit(undefined, 50);
  }, []);

  // Export graph as image
  const exportAsImage = useCallback(
    (format: 'png' | 'jpg' | 'svg' = 'png'): string | undefined => {
      if (!cyRef.current) return;

      if (format === 'svg') {
        return (cyRef.current as any).svg({
          full: true,
          scale: 2,
        });
      }

      return cyRef.current.png({
        full: true,
        scale: 2,
        bg: '#ffffff',
      });
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!cyRef.current) return;

      switch (e.key) {
        case 'f':
        case 'F':
          if (!e.metaKey && !e.ctrlKey) {
            fitToScreen();
          }
          break;
        case ' ':
          e.preventDefault();
          useTopologyStore.getState().togglePaused();
          break;
        case 'r':
        case 'R':
          if (!e.metaKey && !e.ctrlKey) {
            resetZoom();
          }
          break;
        case 'Escape':
          setSelectedNodeId(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitToScreen, resetZoom, setSelectedNodeId]);

  return (
    <div className={cn('relative w-full h-full bg-muted/30 rounded-lg overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="w-full h-full"
        role="application"
        aria-label="Kubernetes topology graph"
        tabIndex={0}
      />
      
      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-warning/10 text-warning border border-warning/20 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          Updates Paused (Press Space to Resume)
        </div>
      )}
    </div>
  );
};

/**
 * Convert TopologyGraph to Cytoscape elements
 */
function graphToCytoscapeElements(graph: TopologyGraph): cytoscape.ElementDefinition[] {
  const elements: cytoscape.ElementDefinition[] = [];

  // Add nodes
  graph.nodes.forEach((node) => {
    elements.push({
      data: {
        id: node.id,
        label: node.name,
        kind: node.kind,
        namespace: node.namespace,
        name: node.name,
        status: node.status,
        health: node.computed.health,
        statusColor: getStatusColor(node.computed.health),
        statusBorderColor: getStatusBorderColor(node.computed.health),
        traffic: node.traffic,
        ...node,
      },
    });
  });

  // Add edges
  graph.edges.forEach((edge) => {
    elements.push({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        relationshipType: edge.relationshipType,
        traffic: edge.traffic,
        ...edge,
      },
    });
  });

  return elements;
}

export default CytoscapeCanvas;
