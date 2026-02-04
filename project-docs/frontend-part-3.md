# Kubilitics Frontend Engineering Blueprint — Part 3

## Topology Rendering, State Management & Real-Time Systems

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** AUTHORITATIVE — Single Source of Truth

---

## Table of Contents

1. [Topology Rendering Engine](#1-topology-rendering-engine)
2. [Cytoscape.js Integration](#2-cytoscapejs-integration)
3. [Deterministic Layout System](#3-deterministic-layout-system)
4. [Node & Edge Rendering](#4-node--edge-rendering)
5. [State Management Architecture](#5-state-management-architecture)
6. [Real-Time Update System](#6-real-time-update-system)
7. [Export System](#7-export-system)
8. [Error Handling & Guardrails](#8-error-handling--guardrails)
9. [Performance Optimization](#9-performance-optimization)

---

## 1. Topology Rendering Engine

### 1.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TOPOLOGY RENDERING PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Graph      │    │   Layout     │    │   Render     │                   │
│  │   Model      │───►│   Engine     │───►│   Engine     │                   │
│  │   (Data)     │    │ (Positions)  │    │ (Cytoscape)  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         │                   │                   ▼                            │
│         │                   │          ┌──────────────┐                      │
│         │                   │          │   Canvas     │                      │
│         │                   │          │   (WebGL)    │                      │
│         │                   │          └──────────────┘                      │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────────────────────────────────────────────┐                   │
│  │                   VALIDATION LAYER                    │                   │
│  │  • Completeness check (no missing relationships)      │                   │
│  │  • Determinism check (same input = same output)       │                   │
│  │  • Parity check (UI == Export)                        │                   │
│  └──────────────────────────────────────────────────────┘                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Graph Model Types

```typescript
// src/types/topology.ts

/**
 * Canonical graph node representing a Kubernetes resource
 */
export interface TopologyNode {
  /** Unique identifier: `${kind}/${namespace}/${name}` or `${kind}/${name}` for cluster-scoped */
  id: string;

  /** Kubernetes resource kind */
  kind: KubernetesKind;

  /** Resource namespace (empty for cluster-scoped) */
  namespace: string;

  /** Resource name */
  name: string;

  /** API version */
  apiVersion: string;

  /** Current status for visual encoding */
  status: ResourceStatus;

  /** Additional metadata for rendering */
  metadata: {
    /** Labels for filtering */
    labels: Record<string, string>;
    /** Annotations */
    annotations: Record<string, string>;
    /** Creation timestamp */
    createdAt: string;
    /** UID */
    uid: string;
  };

  /** Computed properties */
  computed: {
    /** Health indicator */
    health: 'healthy' | 'warning' | 'critical' | 'unknown';
    /** Restart count (for pods) */
    restartCount?: number;
    /** Replica counts (for controllers) */
    replicas?: {
      desired: number;
      ready: number;
      available: number;
    };
  };
}

/**
 * Canonical graph edge representing a relationship
 */
export interface TopologyEdge {
  /** Unique identifier */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Relationship type */
  relationshipType: RelationshipType;

  /** Human-readable label */
  label: string;

  /** Relationship metadata */
  metadata: {
    /** How this relationship was discovered */
    derivation: 'ownerReference' | 'labelSelector' | 'fieldReference' | 'volumeMount' | 'envReference' | 'rbacBinding' | 'admission' | 'helm' | 'gitops';
    /** Confidence level (1.0 = certain) */
    confidence: number;
    /** Source field in Kubernetes API */
    sourceField: string;
  };
}

/**
 * Relationship types
 */
export type RelationshipType =
  | 'owns'              // OwnerReference
  | 'selects'           // Label selector (Service → Pod)
  | 'mounts'            // Volume mount
  | 'references'        // Field reference (pod.spec.nodeName)
  | 'configures'        // ConfigMap/Secret injection
  | 'permits'           // RBAC permission
  | 'validates'         // Admission webhook
  | 'mutates'           // Mutating webhook
  | 'exposes'           // Service exposure
  | 'routes'            // Ingress routing
  | 'stores'            // PVC → PV binding
  | 'schedules'         // Node scheduling
  | 'limits'            // ResourceQuota/LimitRange
  | 'manages'           // Helm/GitOps management
  | 'contains';         // Namespace containment

/**
 * Complete topology graph
 */
export interface TopologyGraph {
  /** Schema version for compatibility */
  schemaVersion: string;

  /** Graph nodes */
  nodes: TopologyNode[];

  /** Graph edges */
  edges: TopologyEdge[];

  /** Graph metadata */
  metadata: {
    /** Cluster ID */
    clusterId: string;
    /** Generation timestamp */
    generatedAt: string;
    /** Layout seed for determinism */
    layoutSeed: string;
    /** Whether graph is complete (all relationships discovered) */
    isComplete: boolean;
    /** Any warnings during graph construction */
    warnings: GraphWarning[];
  };
}

/**
 * Graph warning (non-fatal issues)
 */
export interface GraphWarning {
  code: string;
  message: string;
  affectedNodes: string[];
}
```

---

## 2. Cytoscape.js Integration

### 2.1 Cytoscape Instance Configuration

```typescript
// src/features/topology/utils/cytoscapeConfig.ts
import cytoscape, { Core, NodeSingular, EdgeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';
import popper from 'cytoscape-popper';

// Register extensions
cytoscape.use(dagre);
cytoscape.use(cola);
cytoscape.use(popper);

/**
 * Create a configured Cytoscape instance
 */
export const createCytoscapeInstance = (
  container: HTMLElement,
  options: CytoscapeOptions = {}
): Core => {
  const cy = cytoscape({
    container,

    // Rendering options
    style: getStylesheet(),
    wheelSensitivity: 0.3,
    minZoom: 0.1,
    maxZoom: 5.0,
    boxSelectionEnabled: true,
    selectionType: 'single',
    autoungrabify: false,
    autounselectify: false,

    // Performance options
    textureOnViewport: true,
    hideEdgesOnViewport: false,
    hideLabelsOnViewport: false,
    pixelRatio: 'auto',

    // Layout will be applied separately
    layout: { name: 'preset' },

    ...options,
  });

  // Set up event handlers
  setupEventHandlers(cy);

  return cy;
};

/**
 * Cytoscape stylesheet - defines visual appearance of all elements
 */
const getStylesheet = (): cytoscape.Stylesheet[] => [
  // === NODE STYLES ===

  // Base node style
  {
    selector: 'node',
    style: {
      'label': 'data(label)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 8,
      'font-size': 12,
      'font-family': 'Inter, system-ui, sans-serif',
      'color': '#525252',
      'text-max-width': 120,
      'text-wrap': 'ellipsis',
      'min-zoomed-font-size': 8,
      'width': 40,
      'height': 40,
      'border-width': 2,
      'border-color': '#e5e5e5',
      'background-color': '#ffffff',
      'transition-property': 'background-color, border-color, width, height',
      'transition-duration': '200ms',
      'transition-timing-function': 'ease-out',
    },
  },

  // Pod nodes
  {
    selector: 'node[kind="Pod"]',
    style: {
      'shape': 'ellipse',
      'background-color': 'data(statusColor)',
      'border-color': 'data(statusBorderColor)',
    },
  },

  // Deployment nodes
  {
    selector: 'node[kind="Deployment"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#6366f1',
      'border-color': '#4f46e5',
      'width': 50,
      'height': 50,
    },
  },

  // StatefulSet nodes
  {
    selector: 'node[kind="StatefulSet"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#8b5cf6',
      'border-color': '#7c3aed',
      'width': 50,
      'height': 50,
    },
  },

  // DaemonSet nodes
  {
    selector: 'node[kind="DaemonSet"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#3b82f6',
      'border-color': '#2563eb',
      'width': 50,
      'height': 50,
    },
  },

  // Service nodes (diamond)
  {
    selector: 'node[kind="Service"]',
    style: {
      'shape': 'diamond',
      'background-color': '#8b5cf6',
      'border-color': '#7c3aed',
      'width': 45,
      'height': 45,
    },
  },

  // Ingress nodes
  {
    selector: 'node[kind="Ingress"]',
    style: {
      'shape': 'star',
      'background-color': '#eab308',
      'border-color': '#ca8a04',
      'width': 45,
      'height': 45,
    },
  },

  // ConfigMap nodes
  {
    selector: 'node[kind="ConfigMap"]',
    style: {
      'shape': 'rectangle',
      'background-color': '#14b8a6',
      'border-color': '#0d9488',
      'width': 35,
      'height': 35,
    },
  },

  // Secret nodes
  {
    selector: 'node[kind="Secret"]',
    style: {
      'shape': 'rectangle',
      'background-color': '#f97316',
      'border-color': '#ea580c',
      'width': 35,
      'height': 35,
    },
  },

  // PersistentVolumeClaim nodes
  {
    selector: 'node[kind="PersistentVolumeClaim"]',
    style: {
      'shape': 'barrel',
      'background-color': '#64748b',
      'border-color': '#475569',
      'width': 40,
      'height': 45,
    },
  },

  // PersistentVolume nodes
  {
    selector: 'node[kind="PersistentVolume"]',
    style: {
      'shape': 'barrel',
      'background-color': '#475569',
      'border-color': '#334155',
      'width': 45,
      'height': 50,
    },
  },

  // Node (Kubernetes node)
  {
    selector: 'node[kind="Node"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#0ea5e9',
      'border-color': '#0284c7',
      'width': 60,
      'height': 40,
    },
  },

  // Namespace (compound parent)
  {
    selector: 'node[kind="Namespace"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#faf5ff',
      'background-opacity': 0.5,
      'border-color': '#a855f7',
      'border-width': 2,
      'border-style': 'dashed',
      'padding': 20,
      'text-valign': 'top',
      'text-halign': 'center',
      'font-weight': 600,
    },
  },

  // ServiceAccount nodes
  {
    selector: 'node[kind="ServiceAccount"]',
    style: {
      'shape': 'ellipse',
      'background-color': '#ec4899',
      'border-color': '#db2777',
      'width': 35,
      'height': 35,
    },
  },

  // Role/ClusterRole nodes
  {
    selector: 'node[kind="Role"], node[kind="ClusterRole"]',
    style: {
      'shape': 'round-rectangle',
      'background-color': '#f43f5e',
      'border-color': '#e11d48',
      'width': 40,
      'height': 35,
    },
  },

  // Selected state
  {
    selector: 'node:selected',
    style: {
      'border-width': 3,
      'border-color': '#06b6d4',
      'box-shadow': '0 0 0 4px rgba(6, 182, 212, 0.3)',
      'z-index': 999,
    },
  },

  // Hover state
  {
    selector: 'node:active',
    style: {
      'overlay-color': '#06b6d4',
      'overlay-padding': 4,
      'overlay-opacity': 0.1,
    },
  },

  // Faded state (blast radius)
  {
    selector: 'node.faded',
    style: {
      'opacity': 0.3,
    },
  },

  // Highlighted state (blast radius)
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 3,
      'z-index': 100,
    },
  },

  // === EDGE STYLES ===

  // Base edge style
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#d1d5db',
      'target-arrow-color': '#d1d5db',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 1,
      'label': 'data(label)',
      'font-size': 10,
      'text-rotation': 'autorotate',
      'text-margin-y': -10,
      'color': '#9ca3af',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.9,
      'text-background-padding': 2,
      'transition-property': 'line-color, target-arrow-color, width',
      'transition-duration': '200ms',
    },
  },

  // OwnerReference edges (solid)
  {
    selector: 'edge[relationshipType="owns"]',
    style: {
      'line-color': '#6b7280',
      'target-arrow-color': '#6b7280',
      'line-style': 'solid',
      'width': 2,
    },
  },

  // Label selector edges (dashed)
  {
    selector: 'edge[relationshipType="selects"]',
    style: {
      'line-color': '#9ca3af',
      'target-arrow-color': '#9ca3af',
      'line-style': 'dashed',
      'width': 1.5,
    },
  },

  // Volume mount edges (dotted)
  {
    selector: 'edge[relationshipType="mounts"], edge[relationshipType="stores"]',
    style: {
      'line-color': '#64748b',
      'target-arrow-color': '#64748b',
      'line-style': 'dotted',
      'width': 1.5,
    },
  },

  // RBAC edges (red dashed)
  {
    selector: 'edge[relationshipType="permits"]',
    style: {
      'line-color': '#f43f5e',
      'target-arrow-color': '#f43f5e',
      'line-style': 'dashed',
      'width': 1,
    },
  },

  // Network flow edges (animated)
  {
    selector: 'edge[relationshipType="exposes"], edge[relationshipType="routes"]',
    style: {
      'line-color': '#06b6d4',
      'target-arrow-color': '#06b6d4',
      'line-style': 'solid',
      'width': 2,
    },
  },

  // Selected edge
  {
    selector: 'edge:selected',
    style: {
      'width': 3,
      'line-color': '#06b6d4',
      'target-arrow-color': '#06b6d4',
      'z-index': 999,
    },
  },

  // Faded edge
  {
    selector: 'edge.faded',
    style: {
      'opacity': 0.2,
    },
  },

  // Highlighted edge (blast radius path)
  {
    selector: 'edge.highlighted',
    style: {
      'width': 3,
      'line-color': '#f43f5e',
      'target-arrow-color': '#f43f5e',
      'z-index': 100,
    },
  },
];
```

### 2.2 Topology Canvas Component

```typescript
// src/features/topology/components/TopologyCanvas.tsx
import {
  type FC,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { Core, NodeSingular, EventObject } from 'cytoscape';
import { createCytoscapeInstance } from '../utils/cytoscapeConfig';
import { applyLayout } from '../utils/layoutEngine';
import { useTopologyStore } from '@/stores/topologyStore';
import { useUIStore } from '@/stores/uiStore';
import { AriaAnnouncer } from '@/utils/aria';
import { cn } from '@/utils/cn';
import type { TopologyGraph, TopologyNode, TopologyEdge } from '@/types/topology';

interface TopologyCanvasProps {
  /** Graph data */
  graph: TopologyGraph;
  /** Node to center on initially */
  centeredNodeId?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether updates are paused */
  isPaused?: boolean;
  /** Callback when node is selected */
  onNodeSelect?: (node: TopologyNode | null) => void;
  /** Callback when edge is selected */
  onEdgeSelect?: (edge: TopologyEdge | null) => void;
}

export const TopologyCanvas: FC<TopologyCanvasProps> = ({
  graph,
  centeredNodeId,
  className,
  isPaused = false,
  onNodeSelect,
  onEdgeSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [isReady, setIsReady] = useState(false);

  const {
    selectedNodeId,
    setSelectedNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    zoomLevel,
    setZoomLevel,
  } = useTopologyStore();

  const { setDetailPanel } = useUIStore();

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
    cy.on('pan', handlePan);

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
      // Remove elements that no longer exist
      const currentIds = new Set(elements.map((el) => el.data.id));
      cy.elements().forEach((el) => {
        if (!currentIds.has(el.id())) {
          el.remove();
        }
      });

      // Add/update elements
      elements.forEach((element) => {
        const existing = cy.getElementById(element.data.id);
        if (existing.length === 0) {
          cy.add(element);
        } else {
          // Update data
          existing.data(element.data);
        }
      });
    });

    // Apply layout
    applyLayout(cy, graph.metadata.layoutSeed);

    // Center on specified node
    if (centeredNodeId) {
      const node = cy.getElementById(centeredNodeId);
      if (node.length > 0) {
        cy.center(node);
      }
    }
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
    if (hoveredNodeId) {
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
  }, [hoveredNodeId]);

  // Event handlers
  const handleNodeClick = useCallback(
    (event: EventObject) => {
      const node = event.target as NodeSingular;
      const nodeData = node.data() as TopologyNode;

      setSelectedNodeId(node.id());
      onNodeSelect?.(nodeData);

      // Open detail panel
      setDetailPanel({
        type: 'resource',
        data: {
          kind: nodeData.kind,
          namespace: nodeData.namespace,
          name: nodeData.name,
        },
      });

      // Announce for screen readers
      AriaAnnouncer.getInstance().announce(
        `Selected ${nodeData.kind} ${nodeData.name}`
      );
    },
    [setSelectedNodeId, onNodeSelect, setDetailPanel]
  );

  const handleEdgeClick = useCallback(
    (event: EventObject) => {
      const edge = event.target;
      const edgeData = edge.data() as TopologyEdge;
      onEdgeSelect?.(edgeData);
    },
    [onEdgeSelect]
  );

  const handleBackgroundClick = useCallback(
    (event: EventObject) => {
      if (event.target === cyRef.current) {
        setSelectedNodeId(null);
        onNodeSelect?.(null);
        setDetailPanel(null);
      }
    },
    [setSelectedNodeId, onNodeSelect, setDetailPanel]
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

  const handlePan = useCallback(() => {
    // Update pan state if needed
  }, []);

  // Exposed methods for controls
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
        return cyRef.current.svg({
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

  // Pause indicator
  const PauseOverlay = useMemo(
    () =>
      isPaused ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
          Updates Paused (Press Space to Resume)
        </div>
      ) : null,
    [isPaused]
  );

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div
        ref={containerRef}
        className="w-full h-full"
        role="application"
        aria-label="Kubernetes topology graph"
        tabIndex={0}
      />
      {PauseOverlay}
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
        // Parent for compound nodes
        parent: node.namespace ? `Namespace/${node.namespace}` : undefined,
        // All original data
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
        ...edge,
      },
    });
  });

  return elements;
}

function getStatusColor(health: string): string {
  switch (health) {
    case 'healthy':
      return '#22c55e';
    case 'warning':
      return '#f59e0b';
    case 'critical':
      return '#f43f5e';
    default:
      return '#6b7280';
  }
}

function getStatusBorderColor(health: string): string {
  switch (health) {
    case 'healthy':
      return '#16a34a';
    case 'warning':
      return '#d97706';
    case 'critical':
      return '#e11d48';
    default:
      return '#525252';
  }
}
```

---

## 3. Deterministic Layout System

### 3.1 Layout Engine

```typescript
// src/features/topology/utils/layoutEngine.ts
import { Core } from 'cytoscape';
import seedrandom from 'seedrandom';

/**
 * Layout configuration
 */
interface LayoutConfig {
  name: 'dagre' | 'cola' | 'preset';
  seed: string;
  options: Record<string, unknown>;
}

/**
 * Apply deterministic layout to the graph
 *
 * CRITICAL: Same seed MUST produce same layout every time
 * This is a PRD non-negotiable requirement
 */
export function applyLayout(cy: Core, seed: string): void {
  // Create seeded random number generator
  const rng = seedrandom(seed);

  // Configure layout based on graph size
  const nodeCount = cy.nodes().length;
  const layoutConfig = getLayoutConfig(nodeCount, rng);

  // Run layout
  const layout = cy.layout(layoutConfig.options);

  // Store positions for determinism verification
  const positionsBeforeLayout = capturePositions(cy);

  layout.run();

  // Wait for layout to complete
  layout.promiseOn('layoutstop').then(() => {
    // Round positions to ensure determinism
    cy.nodes().forEach((node) => {
      const pos = node.position();
      node.position({
        x: Math.round(pos.x * 100) / 100,
        y: Math.round(pos.y * 100) / 100,
      });
    });

    // Validate determinism in development
    if (process.env.NODE_ENV === 'development') {
      validateLayoutDeterminism(cy, seed);
    }
  });
}

/**
 * Get layout configuration based on graph size
 */
function getLayoutConfig(nodeCount: number, rng: () => number): LayoutConfig {
  // Use dagre for small/medium graphs (hierarchical layout)
  if (nodeCount <= 100) {
    return {
      name: 'dagre',
      seed: rng().toString(),
      options: {
        name: 'dagre',
        rankDir: 'TB', // Top to bottom
        align: 'UL',
        ranker: 'network-simplex',
        nodeSep: 50,
        edgeSep: 10,
        rankSep: 100,
        padding: 30,
        animate: true,
        animationDuration: 300,
        animationEasing: 'ease-out',
        // Use seeded random for any random decisions
        randomize: () => rng(),
      },
    };
  }

  // Use cola for larger graphs (force-directed with constraints)
  return {
    name: 'cola',
    seed: rng().toString(),
    options: {
      name: 'cola',
      animate: true,
      animationDuration: 300,
      maxSimulationTime: 4000,
      ungrabifyWhileSimulating: false,
      fit: true,
      padding: 30,
      nodeSpacing: 50,
      edgeLength: 150,
      // Deterministic initial positions
      randomize: false,
      // Custom position function using seed
      position: (node: { id: () => string }) => {
        const hash = hashCode(node.id() + rng().toString());
        return {
          x: (hash % 1000) - 500,
          y: ((hash * 31) % 1000) - 500,
        };
      },
    },
  };
}

/**
 * Capture current node positions
 */
function capturePositions(cy: Core): Map<string, { x: number; y: number }> {
  const positions = new Map();
  cy.nodes().forEach((node) => {
    positions.set(node.id(), { ...node.position() });
  });
  return positions;
}

/**
 * Validate that layout is deterministic
 */
function validateLayoutDeterminism(cy: Core, seed: string): void {
  // Store current positions
  const positions1 = capturePositions(cy);

  // Re-run layout with same seed
  const rng = seedrandom(seed);
  const layoutConfig = getLayoutConfig(cy.nodes().length, rng);
  const layout = cy.layout(layoutConfig.options);
  layout.run();

  layout.promiseOn('layoutstop').then(() => {
    const positions2 = capturePositions(cy);

    // Compare positions
    let isDeterministic = true;
    positions1.forEach((pos1, nodeId) => {
      const pos2 = positions2.get(nodeId);
      if (!pos2 || Math.abs(pos1.x - pos2.x) > 0.01 || Math.abs(pos1.y - pos2.y) > 0.01) {
        isDeterministic = false;
        console.warn(`Layout non-determinism detected for node ${nodeId}`);
      }
    });

    if (!isDeterministic) {
      console.error('CRITICAL: Layout determinism violation detected!');
      // In production, this would trigger an error report
    }
  });
}

/**
 * Simple hash function for deterministic positioning
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Namespace grouping layout
 * Organizes nodes into namespace boundaries
 */
export function applyNamespaceGrouping(cy: Core): void {
  // Get unique namespaces
  const namespaces = new Set<string>();
  cy.nodes().forEach((node) => {
    const ns = node.data('namespace');
    if (ns) namespaces.add(ns);
  });

  // Create compound parent nodes for namespaces
  namespaces.forEach((ns) => {
    const nsNodeId = `Namespace/${ns}`;
    if (cy.getElementById(nsNodeId).length === 0) {
      cy.add({
        data: {
          id: nsNodeId,
          label: ns,
          kind: 'Namespace',
          namespace: ns,
          name: ns,
        },
      });
    }

    // Set parent for all nodes in this namespace
    cy.nodes(`[namespace="${ns}"]`).forEach((node) => {
      if (node.id() !== nsNodeId) {
        node.move({ parent: nsNodeId });
      }
    });
  });
}
```

### 3.2 Layout Seed Generation (Backend Provides, Frontend Consumes)

```typescript
// src/features/topology/utils/layoutSeed.ts

/**
 * Layout seed is generated by the backend and must be:
 * 1. Deterministic based on graph content
 * 2. Stable across minor changes
 * 3. Shared between all consumers (UI, Export, AI, MCP)
 *
 * Frontend receives this seed from the backend and uses it
 * to ensure identical layouts everywhere.
 */

export interface LayoutSeedInfo {
  /** The seed value */
  seed: string;
  /** How the seed was derived */
  derivation: {
    /** Hash of node IDs */
    nodeHash: string;
    /** Hash of edge definitions */
    edgeHash: string;
    /** Timestamp of first graph generation */
    firstSeenAt: string;
  };
}

/**
 * Validate that a layout seed matches the current graph
 */
export function validateLayoutSeed(
  graph: TopologyGraph,
  seedInfo: LayoutSeedInfo
): boolean {
  const currentNodeHash = computeNodeHash(graph.nodes);
  const currentEdgeHash = computeEdgeHash(graph.edges);

  // Seed should match if node set is the same
  // (Minor edge changes are tolerated)
  return currentNodeHash === seedInfo.derivation.nodeHash;
}

function computeNodeHash(nodes: TopologyNode[]): string {
  const sortedIds = nodes.map((n) => n.id).sort();
  return hashString(sortedIds.join('|'));
}

function computeEdgeHash(edges: TopologyEdge[]): string {
  const sortedKeys = edges
    .map((e) => `${e.source}->${e.target}:${e.relationshipType}`)
    .sort();
  return hashString(sortedKeys.join('|'));
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
```

---

## 4. Node & Edge Rendering

### 4.1 Status Color Mapping

```typescript
// src/features/topology/utils/nodeStyles.ts

/**
 * Pod status to color mapping
 */
export const podStatusColors: Record<string, { bg: string; border: string }> = {
  Running: { bg: '#22c55e', border: '#16a34a' },
  Pending: { bg: '#f59e0b', border: '#d97706' },
  Failed: { bg: '#f43f5e', border: '#e11d48' },
  Succeeded: { bg: '#3b82f6', border: '#2563eb' },
  Unknown: { bg: '#6b7280', border: '#525252' },
  Terminating: { bg: '#ef4444', border: '#dc2626' },
};

/**
 * Resource kind to shape mapping
 */
export const kindShapeMap: Record<string, string> = {
  Pod: 'ellipse',
  Deployment: 'round-rectangle',
  StatefulSet: 'round-rectangle',
  DaemonSet: 'round-rectangle',
  ReplicaSet: 'round-rectangle',
  Job: 'round-rectangle',
  CronJob: 'round-rectangle',
  Service: 'diamond',
  Ingress: 'star',
  ConfigMap: 'rectangle',
  Secret: 'rectangle',
  PersistentVolume: 'barrel',
  PersistentVolumeClaim: 'barrel',
  StorageClass: 'hexagon',
  Node: 'round-rectangle',
  Namespace: 'round-rectangle',
  ServiceAccount: 'ellipse',
  Role: 'round-rectangle',
  ClusterRole: 'round-rectangle',
  RoleBinding: 'round-rectangle',
  ClusterRoleBinding: 'round-rectangle',
  NetworkPolicy: 'pentagon',
  ResourceQuota: 'round-rectangle',
  LimitRange: 'round-rectangle',
};

/**
 * Resource kind to color mapping
 */
export const kindColorMap: Record<string, { bg: string; border: string }> = {
  Pod: { bg: '#22c55e', border: '#16a34a' }, // Will be overridden by status
  Deployment: { bg: '#6366f1', border: '#4f46e5' },
  StatefulSet: { bg: '#8b5cf6', border: '#7c3aed' },
  DaemonSet: { bg: '#3b82f6', border: '#2563eb' },
  ReplicaSet: { bg: '#818cf8', border: '#6366f1' },
  Job: { bg: '#f59e0b', border: '#d97706' },
  CronJob: { bg: '#fbbf24', border: '#f59e0b' },
  Service: { bg: '#8b5cf6', border: '#7c3aed' },
  Ingress: { bg: '#eab308', border: '#ca8a04' },
  ConfigMap: { bg: '#14b8a6', border: '#0d9488' },
  Secret: { bg: '#f97316', border: '#ea580c' },
  PersistentVolume: { bg: '#475569', border: '#334155' },
  PersistentVolumeClaim: { bg: '#64748b', border: '#475569' },
  StorageClass: { bg: '#94a3b8', border: '#64748b' },
  Node: { bg: '#0ea5e9', border: '#0284c7' },
  Namespace: { bg: '#a855f7', border: '#9333ea' },
  ServiceAccount: { bg: '#ec4899', border: '#db2777' },
  Role: { bg: '#f43f5e', border: '#e11d48' },
  ClusterRole: { bg: '#be123c', border: '#9f1239' },
  RoleBinding: { bg: '#fb7185', border: '#f43f5e' },
  ClusterRoleBinding: { bg: '#e11d48', border: '#be123c' },
  NetworkPolicy: { bg: '#f43f5e', border: '#e11d48' },
  ResourceQuota: { bg: '#06b6d4', border: '#0891b2' },
  LimitRange: { bg: '#22d3ee', border: '#06b6d4' },
};
```

### 4.2 Edge Style Definitions

```typescript
// src/features/topology/utils/edgeStyles.ts

/**
 * Relationship type to edge style mapping
 */
export const relationshipEdgeStyles: Record<RelationshipType, EdgeStyle> = {
  owns: {
    lineStyle: 'solid',
    lineColor: '#6b7280',
    width: 2,
    arrowShape: 'triangle',
    label: 'owns',
  },
  selects: {
    lineStyle: 'dashed',
    lineColor: '#9ca3af',
    width: 1.5,
    arrowShape: 'vee',
    label: 'selects',
  },
  mounts: {
    lineStyle: 'dotted',
    lineColor: '#64748b',
    width: 1.5,
    arrowShape: 'none',
    label: 'mounts',
  },
  references: {
    lineStyle: 'dashed',
    lineColor: '#a3a3a3',
    width: 1,
    arrowShape: 'vee',
    label: 'refs',
  },
  configures: {
    lineStyle: 'dashed',
    lineColor: '#14b8a6',
    width: 1.5,
    arrowShape: 'vee',
    label: 'configures',
  },
  permits: {
    lineStyle: 'dashed',
    lineColor: '#f43f5e',
    width: 1,
    arrowShape: 'vee',
    label: 'permits',
  },
  validates: {
    lineStyle: 'dotted',
    lineColor: '#f59e0b',
    width: 1,
    arrowShape: 'triangle',
    label: 'validates',
  },
  mutates: {
    lineStyle: 'dotted',
    lineColor: '#8b5cf6',
    width: 1,
    arrowShape: 'triangle',
    label: 'mutates',
  },
  exposes: {
    lineStyle: 'solid',
    lineColor: '#06b6d4',
    width: 2,
    arrowShape: 'triangle',
    label: 'exposes',
    animated: true,
  },
  routes: {
    lineStyle: 'solid',
    lineColor: '#eab308',
    width: 2,
    arrowShape: 'triangle',
    label: 'routes',
  },
  stores: {
    lineStyle: 'solid',
    lineColor: '#64748b',
    width: 2,
    arrowShape: 'triangle',
    label: 'bound',
  },
  schedules: {
    lineStyle: 'dashed',
    lineColor: '#0ea5e9',
    width: 1,
    arrowShape: 'vee',
    label: 'scheduled',
  },
  limits: {
    lineStyle: 'dotted',
    lineColor: '#06b6d4',
    width: 1,
    arrowShape: 'none',
    label: 'limits',
  },
  manages: {
    lineStyle: 'dashed',
    lineColor: '#a855f7',
    width: 1.5,
    arrowShape: 'vee',
    label: 'manages',
  },
  contains: {
    lineStyle: 'solid',
    lineColor: '#d1d5db',
    width: 1,
    arrowShape: 'none',
    label: '',
  },
};

interface EdgeStyle {
  lineStyle: 'solid' | 'dashed' | 'dotted';
  lineColor: string;
  width: number;
  arrowShape: 'triangle' | 'vee' | 'none';
  label: string;
  animated?: boolean;
}
```

---

## 5. State Management Architecture

### 5.1 Store Structure

```typescript
// src/stores/index.ts

/**
 * Kubilitics uses Zustand for state management with the following stores:
 *
 * 1. clusterStore - Cluster connection state
 * 2. topologyStore - Topology visualization state
 * 3. uiStore - UI state (panels, modals, theme)
 * 4. searchStore - Search state and history
 * 5. settingsStore - User preferences
 * 6. collaborationStore - Real-time collaboration state
 */
```

### 5.2 Cluster Store

```typescript
// src/stores/clusterStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface Cluster {
  id: string;
  name: string;
  context: string;
  server: string;
  status: 'connected' | 'disconnected' | 'error';
  lastConnected?: string;
  error?: string;
}

interface ClusterState {
  // State
  clusters: Cluster[];
  currentClusterId: string | null;
  isRefreshing: boolean;
  connectionError: string | null;

  // Computed
  currentCluster: Cluster | null;

  // Actions
  setClusters: (clusters: Cluster[]) => void;
  addCluster: (cluster: Cluster) => void;
  removeCluster: (clusterId: string) => void;
  setCurrentCluster: (clusterId: string) => void;
  refreshClusters: () => Promise<void>;
  setConnectionError: (error: string | null) => void;
}

export const useClusterStore = create<ClusterState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      clusters: [],
      currentClusterId: null,
      isRefreshing: false,
      connectionError: null,

      // Computed
      get currentCluster() {
        const { clusters, currentClusterId } = get();
        return clusters.find((c) => c.id === currentClusterId) ?? null;
      },

      // Actions
      setClusters: (clusters) =>
        set((state) => {
          state.clusters = clusters;
        }),

      addCluster: (cluster) =>
        set((state) => {
          state.clusters.push(cluster);
        }),

      removeCluster: (clusterId) =>
        set((state) => {
          state.clusters = state.clusters.filter((c) => c.id !== clusterId);
          if (state.currentClusterId === clusterId) {
            state.currentClusterId = state.clusters[0]?.id ?? null;
          }
        }),

      setCurrentCluster: (clusterId) =>
        set((state) => {
          state.currentClusterId = clusterId;
          state.connectionError = null;
        }),

      refreshClusters: async () => {
        set((state) => {
          state.isRefreshing = true;
        });

        try {
          const clusters = await clusterService.discoverClusters();
          set((state) => {
            state.clusters = clusters;
            state.isRefreshing = false;
          });
        } catch (error) {
          set((state) => {
            state.isRefreshing = false;
            state.connectionError = error.message;
          });
        }
      },

      setConnectionError: (error) =>
        set((state) => {
          state.connectionError = error;
        }),
    })),
    {
      name: 'kubilitics-clusters',
      partialize: (state) => ({
        clusters: state.clusters,
        currentClusterId: state.currentClusterId,
      }),
    }
  )
);
```

### 5.3 Topology Store

```typescript
// src/stores/topologyStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { TopologyGraph, TopologyNode, TopologyEdge } from '@/types/topology';

interface TopologyFilters {
  namespaces: string[];
  kinds: string[];
  statuses: string[];
  labels: Record<string, string>;
  searchQuery: string;
}

interface TopologyState {
  // Graph data
  graph: TopologyGraph | null;
  isLoading: boolean;
  error: string | null;

  // Selection
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  hoveredNodeId: string | null;
  multiSelectedNodeIds: Set<string>;

  // View state
  zoomLevel: number;
  panPosition: { x: number; y: number };
  isPaused: boolean;
  viewMode: 'full' | 'focused';
  focusedNodeId: string | null;

  // Filters (dim, not remove)
  filters: TopologyFilters;
  isFilterActive: boolean;

  // Actions
  setGraph: (graph: TopologyGraph) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  setHoveredNodeId: (nodeId: string | null) => void;
  toggleMultiSelect: (nodeId: string) => void;
  clearMultiSelect: () => void;
  setZoomLevel: (level: number) => void;
  setPanPosition: (position: { x: number; y: number }) => void;
  togglePause: () => void;
  setViewMode: (mode: 'full' | 'focused', nodeId?: string) => void;
  setFilters: (filters: Partial<TopologyFilters>) => void;
  clearFilters: () => void;

  // Computed
  getSelectedNode: () => TopologyNode | null;
  getFilteredGraph: () => TopologyGraph | null;
  getBlastRadius: (nodeId: string) => { nodes: string[]; edges: string[] };
}

const defaultFilters: TopologyFilters = {
  namespaces: [],
  kinds: [],
  statuses: [],
  labels: {},
  searchQuery: '',
};

export const useTopologyStore = create<TopologyState>()(
  immer((set, get) => ({
    // Initial state
    graph: null,
    isLoading: false,
    error: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    hoveredNodeId: null,
    multiSelectedNodeIds: new Set(),
    zoomLevel: 1,
    panPosition: { x: 0, y: 0 },
    isPaused: false,
    viewMode: 'full',
    focusedNodeId: null,
    filters: defaultFilters,
    isFilterActive: false,

    // Actions
    setGraph: (graph) =>
      set((state) => {
        state.graph = graph;
        state.error = null;
      }),

    setLoading: (isLoading) =>
      set((state) => {
        state.isLoading = isLoading;
      }),

    setError: (error) =>
      set((state) => {
        state.error = error;
        state.isLoading = false;
      }),

    setSelectedNodeId: (nodeId) =>
      set((state) => {
        state.selectedNodeId = nodeId;
        state.selectedEdgeId = null;
      }),

    setSelectedEdgeId: (edgeId) =>
      set((state) => {
        state.selectedEdgeId = edgeId;
        state.selectedNodeId = null;
      }),

    setHoveredNodeId: (nodeId) =>
      set((state) => {
        state.hoveredNodeId = nodeId;
      }),

    toggleMultiSelect: (nodeId) =>
      set((state) => {
        if (state.multiSelectedNodeIds.has(nodeId)) {
          state.multiSelectedNodeIds.delete(nodeId);
        } else {
          state.multiSelectedNodeIds.add(nodeId);
        }
      }),

    clearMultiSelect: () =>
      set((state) => {
        state.multiSelectedNodeIds.clear();
      }),

    setZoomLevel: (level) =>
      set((state) => {
        state.zoomLevel = Math.max(0.1, Math.min(5, level));
      }),

    setPanPosition: (position) =>
      set((state) => {
        state.panPosition = position;
      }),

    togglePause: () =>
      set((state) => {
        state.isPaused = !state.isPaused;
      }),

    setViewMode: (mode, nodeId) =>
      set((state) => {
        state.viewMode = mode;
        state.focusedNodeId = mode === 'focused' ? nodeId ?? null : null;
      }),

    setFilters: (filters) =>
      set((state) => {
        state.filters = { ...state.filters, ...filters };
        state.isFilterActive = Object.values(state.filters).some(
          (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.length > 0 : Object.keys(v).length > 0)
        );
      }),

    clearFilters: () =>
      set((state) => {
        state.filters = defaultFilters;
        state.isFilterActive = false;
      }),

    // Computed
    getSelectedNode: () => {
      const { graph, selectedNodeId } = get();
      if (!graph || !selectedNodeId) return null;
      return graph.nodes.find((n) => n.id === selectedNodeId) ?? null;
    },

    getFilteredGraph: () => {
      const { graph, filters, isFilterActive } = get();
      if (!graph || !isFilterActive) return graph;

      // Note: Filters DIM nodes, they don't remove them (per PRD)
      // This returns a graph with dimmed flags set
      return {
        ...graph,
        nodes: graph.nodes.map((node) => ({
          ...node,
          isDimmed: !matchesFilters(node, filters),
        })),
        edges: graph.edges.map((edge) => ({
          ...edge,
          isDimmed: !edgeMatchesFilters(edge, graph.nodes, filters),
        })),
      };
    },

    getBlastRadius: (nodeId) => {
      const { graph } = get();
      if (!graph) return { nodes: [], edges: [] };

      const affectedNodes = new Set<string>([nodeId]);
      const affectedEdges = new Set<string>();

      // BFS to find all connected nodes
      const queue = [nodeId];
      while (queue.length > 0) {
        const current = queue.shift()!;

        // Find edges connected to current node
        graph.edges.forEach((edge) => {
          if (edge.source === current || edge.target === current) {
            affectedEdges.add(edge.id);

            const otherNode = edge.source === current ? edge.target : edge.source;
            if (!affectedNodes.has(otherNode)) {
              affectedNodes.add(otherNode);
              queue.push(otherNode);
            }
          }
        });
      }

      return {
        nodes: Array.from(affectedNodes),
        edges: Array.from(affectedEdges),
      };
    },
  }))
);

function matchesFilters(node: TopologyNode, filters: TopologyFilters): boolean {
  // Namespace filter
  if (filters.namespaces.length > 0 && !filters.namespaces.includes(node.namespace)) {
    return false;
  }

  // Kind filter
  if (filters.kinds.length > 0 && !filters.kinds.includes(node.kind)) {
    return false;
  }

  // Status filter
  if (filters.statuses.length > 0 && !filters.statuses.includes(node.computed.health)) {
    return false;
  }

  // Label filter
  for (const [key, value] of Object.entries(filters.labels)) {
    if (node.metadata.labels[key] !== value) {
      return false;
    }
  }

  // Search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    if (
      !node.name.toLowerCase().includes(query) &&
      !node.kind.toLowerCase().includes(query) &&
      !node.namespace.toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  return true;
}

function edgeMatchesFilters(
  edge: TopologyEdge,
  nodes: TopologyNode[],
  filters: TopologyFilters
): boolean {
  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  if (!sourceNode || !targetNode) return false;

  return matchesFilters(sourceNode, filters) || matchesFilters(targetNode, filters);
}
```

### 5.4 UI Store

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

type Theme = 'light' | 'dark' | 'system';
type DetailPanelContent = {
  type: 'resource' | 'pod-preview' | 'search-result';
  data: unknown;
} | null;

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Detail Panel
  detailPanelOpen: boolean;
  detailPanelContent: DetailPanelContent;
  setDetailPanel: (content: DetailPanelContent) => void;
  closeDetailPanel: () => void;

  // Modals
  activeModal: string | null;
  modalData: unknown;
  openModal: (modalId: string, data?: unknown) => void;
  closeModal: () => void;

  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Search
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;

  // Notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Experience mode
  experienceMode: 'beginner' | 'expert';
  setExperienceMode: (mode: 'beginner' | 'expert') => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    immer((set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => {
          state.sidebarCollapsed = !state.sidebarCollapsed;
        }),
      setSidebarCollapsed: (collapsed) =>
        set((state) => {
          state.sidebarCollapsed = collapsed;
        }),

      // Detail Panel
      detailPanelOpen: false,
      detailPanelContent: null,
      setDetailPanel: (content) =>
        set((state) => {
          state.detailPanelContent = content;
          state.detailPanelOpen = content !== null;
        }),
      closeDetailPanel: () =>
        set((state) => {
          state.detailPanelOpen = false;
          state.detailPanelContent = null;
        }),

      // Modals
      activeModal: null,
      modalData: null,
      openModal: (modalId, data) =>
        set((state) => {
          state.activeModal = modalId;
          state.modalData = data;
        }),
      closeModal: () =>
        set((state) => {
          state.activeModal = null;
          state.modalData = null;
        }),

      // Theme
      theme: 'system',
      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      // Search
      isSearchOpen: false,
      openSearch: () =>
        set((state) => {
          state.isSearchOpen = true;
        }),
      closeSearch: () =>
        set((state) => {
          state.isSearchOpen = false;
        }),

      // Toasts
      toasts: [],
      addToast: (toast) =>
        set((state) => {
          const id = crypto.randomUUID();
          state.toasts.push({ ...toast, id });

          // Auto-remove after duration
          if (toast.duration !== 0) {
            setTimeout(() => {
              set((s) => {
                s.toasts = s.toasts.filter((t) => t.id !== id);
              });
            }, toast.duration ?? 5000);
          }
        }),
      removeToast: (id) =>
        set((state) => {
          state.toasts = state.toasts.filter((t) => t.id !== id);
        }),

      // Experience mode
      experienceMode: 'beginner',
      setExperienceMode: (mode) =>
        set((state) => {
          state.experienceMode = mode;
        }),
    })),
    {
      name: 'kubilitics-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        experienceMode: state.experienceMode,
      }),
    }
  )
);
```

---

## 6. Real-Time Update System

### 6.1 WebSocket Client

```typescript
// src/services/websocket/client.ts
import { useEffect, useRef, useCallback } from 'react';
import { useClusterStore } from '@/stores/clusterStore';
import { useTopologyStore } from '@/stores/topologyStore';

interface WebSocketMessage {
  type: 'topology_update' | 'resource_update' | 'event' | 'ping' | 'error';
  payload: unknown;
  timestamp: string;
}

interface TopologyUpdate {
  type: 'node_added' | 'node_removed' | 'node_updated' | 'edge_added' | 'edge_removed';
  data: TopologyNode | TopologyEdge;
}

class KubiliticsWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(private baseUrl: string) {}

  connect(clusterId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const url = `${this.baseUrl}/ws/cluster/${clusterId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      this.startPingInterval();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.stopPingInterval();
      this.attemptReconnect(clusterId);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnected');
      this.ws = null;
    }
  }

  subscribe(type: string, handler: (data: unknown) => void): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }

    // Handle specific message types
    switch (message.type) {
      case 'ping':
        this.send({ type: 'pong', payload: null, timestamp: new Date().toISOString() });
        break;
      case 'error':
        console.error('Server error:', message.payload);
        break;
    }
  }

  private attemptReconnect(clusterId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(clusterId);
    }, delay);
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping', payload: null, timestamp: new Date().toISOString() });
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Singleton instance
export const websocketClient = new KubiliticsWebSocket(
  process.env.VITE_WS_URL ?? 'ws://localhost:8080'
);

/**
 * React hook for WebSocket connection
 */
export function useWebSocket() {
  const { currentCluster } = useClusterStore();
  const { setGraph, isPaused } = useTopologyStore();

  useEffect(() => {
    if (!currentCluster) return;

    websocketClient.connect(currentCluster.id);

    // Subscribe to topology updates
    const unsubscribe = websocketClient.subscribe('topology_update', (data) => {
      if (!isPaused) {
        // Apply incremental update
        const update = data as TopologyUpdate;
        applyTopologyUpdate(update);
      }
    });

    return () => {
      unsubscribe();
      websocketClient.disconnect();
    };
  }, [currentCluster?.id, isPaused]);
}

function applyTopologyUpdate(update: TopologyUpdate): void {
  const { graph, setGraph } = useTopologyStore.getState();
  if (!graph) return;

  switch (update.type) {
    case 'node_added':
      setGraph({
        ...graph,
        nodes: [...graph.nodes, update.data as TopologyNode],
      });
      break;
    case 'node_removed':
      setGraph({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== (update.data as TopologyNode).id),
      });
      break;
    case 'node_updated':
      setGraph({
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === (update.data as TopologyNode).id ? (update.data as TopologyNode) : n
        ),
      });
      break;
    case 'edge_added':
      setGraph({
        ...graph,
        edges: [...graph.edges, update.data as TopologyEdge],
      });
      break;
    case 'edge_removed':
      setGraph({
        ...graph,
        edges: graph.edges.filter((e) => e.id !== (update.data as TopologyEdge).id),
      });
      break;
  }
}
```

---

## 7. Export System

### 7.1 Export Service

```typescript
// src/features/topology/utils/exportService.ts
import { Core } from 'cytoscape';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  scale: number;
  background: string;
  includeMetadata: boolean;
}

/**
 * Export topology as image
 *
 * CRITICAL: Export MUST be WYSIWYG identical to UI
 * This is a PRD non-negotiable requirement
 */
export async function exportTopology(
  cy: Core,
  options: ExportOptions
): Promise<Blob | string> {
  const { format, scale, background, includeMetadata } = options;

  // Validate that current view matches what will be exported
  validateExportParity(cy);

  switch (format) {
    case 'png':
      return exportAsPng(cy, scale, background);
    case 'svg':
      return exportAsSvg(cy, scale, background);
    case 'pdf':
      return exportAsPdf(cy, scale, background, includeMetadata);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

async function exportAsPng(cy: Core, scale: number, background: string): Promise<Blob> {
  const dataUrl = cy.png({
    full: true,
    scale,
    bg: background,
    maxWidth: 8000,
    maxHeight: 8000,
  });

  // Convert data URL to Blob
  const response = await fetch(dataUrl);
  return response.blob();
}

function exportAsSvg(cy: Core, scale: number, background: string): string {
  return cy.svg({
    full: true,
    scale,
    bg: background,
  });
}

async function exportAsPdf(
  cy: Core,
  scale: number,
  background: string,
  includeMetadata: boolean
): Promise<Blob> {
  // First, export as PNG
  const pngDataUrl = cy.png({
    full: true,
    scale,
    bg: background,
  });

  // Get image dimensions
  const img = new Image();
  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = pngDataUrl;
  });

  // Create PDF
  const orientation = img.width > img.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [img.width, img.height],
  });

  // Add image
  pdf.addImage(pngDataUrl, 'PNG', 0, 0, img.width, img.height);

  // Add metadata page if requested
  if (includeMetadata) {
    pdf.addPage();
    addMetadataPage(pdf, cy);
  }

  return pdf.output('blob');
}

function addMetadataPage(pdf: jsPDF, cy: Core): void {
  const nodeCount = cy.nodes().length;
  const edgeCount = cy.edges().length;
  const timestamp = new Date().toISOString();

  pdf.setFontSize(24);
  pdf.text('Kubilitics Topology Export', 40, 60);

  pdf.setFontSize(12);
  pdf.text(`Generated: ${timestamp}`, 40, 100);
  pdf.text(`Nodes: ${nodeCount}`, 40, 120);
  pdf.text(`Edges: ${edgeCount}`, 40, 140);

  // Add legend
  pdf.setFontSize(16);
  pdf.text('Legend', 40, 180);

  // ... add legend items
}

/**
 * Validate that export will match UI display
 * Throws error if parity cannot be guaranteed
 */
function validateExportParity(cy: Core): void {
  // Check for hidden elements
  const hiddenNodes = cy.nodes().filter((n) => n.hidden());
  if (hiddenNodes.length > 0) {
    throw new Error(
      `Export parity violation: ${hiddenNodes.length} nodes are hidden in UI but would appear in export`
    );
  }

  // Check for elements outside viewport that would appear in full export
  // (This is expected behavior, just noting it)

  // Check for animations in progress
  if (cy.animated()) {
    throw new Error('Export parity violation: Animation in progress');
  }

  // Check zoom level consistency
  const zoomLevel = cy.zoom();
  if (zoomLevel < 0.1 || zoomLevel > 5) {
    console.warn(`Unusual zoom level for export: ${zoomLevel}`);
  }
}

/**
 * Download exported file
 */
export function downloadExport(data: Blob | string, filename: string): void {
  let blob: Blob;

  if (typeof data === 'string') {
    blob = new Blob([data], { type: 'image/svg+xml' });
  } else {
    blob = data;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## 8. Error Handling & Guardrails

### 8.1 Forbidden UI States

```typescript
// src/utils/invariants.ts

/**
 * Forbidden UI states per PRD
 * These states must NEVER occur
 */
export const FORBIDDEN_STATES = {
  // Topology
  SKELETON_GRAPH: 'Topology must never show skeleton/placeholder graph',
  MISSING_LABELS: 'Topology nodes must always have labels',
  SIMPLIFIED_EXPORT: 'Export must be identical to UI view',
  HIDDEN_RELATIONSHIPS: 'Relationships must never be hidden, only dimmed',
  PARTIAL_GRAPH: 'Graph must show complete closure or explicit error',

  // Pod Detail
  MISSING_TOPOLOGY_TAB: 'Pod detail must always have Topology tab',
  TRUNCATED_LOGS: 'Logs must never be silently truncated',
  HIDDEN_EVENTS: 'Events must never be filtered by default',

  // Actions
  UNCONFIRMED_DELETE: 'Delete actions must always require confirmation',
  UNPREVIEWABLE_EDIT: 'YAML edits must show diff before apply',
};

/**
 * Invariant check - throws if condition is false
 */
export function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}

/**
 * Check topology graph validity
 */
export function validateTopologyGraph(graph: TopologyGraph): void {
  // Must have nodes
  invariant(graph.nodes.length > 0, 'Graph must have at least one node');

  // All nodes must have IDs
  graph.nodes.forEach((node) => {
    invariant(!!node.id, 'All nodes must have IDs');
    invariant(!!node.name, 'All nodes must have names (labels)');
  });

  // All edges must reference existing nodes
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  graph.edges.forEach((edge) => {
    invariant(nodeIds.has(edge.source), `Edge source ${edge.source} not found`);
    invariant(nodeIds.has(edge.target), `Edge target ${edge.target} not found`);
  });

  // Graph must be marked complete or have warnings
  if (!graph.metadata.isComplete && graph.metadata.warnings.length === 0) {
    throw new Error('Incomplete graph without warnings is forbidden');
  }
}
```

### 8.2 Error Boundary

```typescript
// src/components/feedback/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Error caught by boundary:', error, errorInfo);
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service
    reportError(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-neutral-500 mb-4 max-w-md">
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <Button onClick={this.handleReset} leftIcon={<RefreshCw size={16} />}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

function reportError(error: Error, errorInfo: ErrorInfo): void {
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // Sentry, DataDog, etc.
  }
}
```

---

## 9. Performance Optimization

### 9.1 React Query Configuration

```typescript
// src/services/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 5000, // 5 seconds for most data
      // Cache time - how long to keep unused data
      gcTime: 10 * 60 * 1000, // 10 minutes
      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus
      refetchOnWindowFocus: true,
      // Refetch on reconnect
      refetchOnReconnect: true,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});
```

### 9.2 Virtualization for Large Lists

```typescript
// src/components/common/VirtualizedList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, type ReactNode } from 'react';

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 9.3 Topology Performance Thresholds

```typescript
// src/features/topology/utils/performance.ts

/**
 * Performance thresholds per PRD
 */
export const PERFORMANCE_THRESHOLDS = {
  // Graph limits
  MAX_NODES: 10000,
  MAX_EDGES: 50000,

  // Render times
  INITIAL_RENDER_MAX_MS: 2000,
  INCREMENTAL_UPDATE_MAX_MS: 200,
  EXPORT_MAX_MS: 3000,

  // Warnings
  WARN_NODES: 5000,
  WARN_EDGES: 25000,
};

/**
 * Check if graph exceeds performance limits
 */
export function checkGraphPerformance(
  nodeCount: number,
  edgeCount: number
): PerformanceWarning | null {
  if (nodeCount > PERFORMANCE_THRESHOLDS.MAX_NODES) {
    return {
      level: 'error',
      message: `Graph exceeds maximum node limit (${nodeCount} > ${PERFORMANCE_THRESHOLDS.MAX_NODES})`,
    };
  }

  if (edgeCount > PERFORMANCE_THRESHOLDS.MAX_EDGES) {
    return {
      level: 'error',
      message: `Graph exceeds maximum edge limit (${edgeCount} > ${PERFORMANCE_THRESHOLDS.MAX_EDGES})`,
    };
  }

  if (nodeCount > PERFORMANCE_THRESHOLDS.WARN_NODES) {
    return {
      level: 'warning',
      message: `Large graph (${nodeCount} nodes) may affect performance`,
    };
  }

  return null;
}

interface PerformanceWarning {
  level: 'warning' | 'error';
  message: string;
}
```

---

## End of Frontend Engineering Blueprint

This concludes the Frontend Engineering Blueprint. Refer to:
- `backend-part-1.md` through `backend-part-3.md` for backend specifications
- `e2e-tests.md` for testing specifications
