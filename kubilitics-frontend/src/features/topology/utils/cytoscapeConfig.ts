/**
 * Cytoscape.js Configuration
 * Per PRD Part 3: Cytoscape.js Integration
 */
import cytoscape, { Core } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import cola from 'cytoscape-cola';

// Register layout extensions
cytoscape.use(dagre);
cytoscape.use(cola);

/**
 * Create a configured Cytoscape instance
 */
export function createCytoscapeInstance(
  container: HTMLElement,
  options: Partial<cytoscape.CytoscapeOptions> = {}
): Core {
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

  return cy;
}

/**
 * Cytoscape stylesheet - defines visual appearance of all elements
 */
function getStylesheet(): cytoscape.StylesheetStyle[] {
  return [
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
        'text-max-width': '120px',
        'text-wrap': 'ellipsis',
        'min-zoomed-font-size': 8,
        'width': 40,
        'height': 40,
        'border-width': 2,
        'border-color': '#e5e5e5',
        'background-color': '#ffffff',
        'transition-property': 'background-color, border-color, width, height',
        'transition-duration': 200,
        'transition-timing-function': 'ease-out',
      } as any,
    },

    // Pod nodes
    {
      selector: 'node[kind="Pod"]',
      style: {
        'shape': 'ellipse',
        'background-color': 'data(statusColor)',
        'border-color': 'data(statusBorderColor)',
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
    },

    // ReplicaSet nodes
    {
      selector: 'node[kind="ReplicaSet"]',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#818cf8',
        'border-color': '#6366f1',
        'width': 45,
        'height': 45,
      } as any,
    },

    // Job nodes
    {
      selector: 'node[kind="Job"]',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#f59e0b',
        'border-color': '#d97706',
        'width': 45,
        'height': 45,
      } as any,
    },

    // CronJob nodes
    {
      selector: 'node[kind="CronJob"]',
      style: {
        'shape': 'round-rectangle',
        'background-color': '#fbbf24',
        'border-color': '#f59e0b',
        'width': 45,
        'height': 45,
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
      } as any,
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
        'padding': '20px',
        'text-valign': 'top',
        'text-halign': 'center',
        'font-weight': 600,
      } as any,
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
      } as any,
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
      } as any,
    },

    // NetworkPolicy nodes
    {
      selector: 'node[kind="NetworkPolicy"]',
      style: {
        'shape': 'pentagon',
        'background-color': '#f43f5e',
        'border-color': '#e11d48',
        'width': 40,
        'height': 40,
      } as any,
    },

    // Selected state
    {
      selector: 'node:selected',
      style: {
        'border-width': 3,
        'border-color': '#06b6d4',
        'z-index': 999,
      } as any,
    },

    // Hover state
    {
      selector: 'node:active',
      style: {
        'overlay-color': '#06b6d4',
        'overlay-padding': 4,
        'overlay-opacity': 0.1,
      } as any,
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
        'text-background-padding': '2px',
        'transition-property': 'line-color, target-arrow-color, width',
        'transition-duration': 200,
      } as any,
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

    // Network flow edges (cyan)
    {
      selector: 'edge[relationshipType="exposes"], edge[relationshipType="routes"]',
      style: {
        'line-color': '#06b6d4',
        'target-arrow-color': '#06b6d4',
        'line-style': 'solid',
        'width': 2,
      },
    },

    // Config edges
    {
      selector: 'edge[relationshipType="configures"]',
      style: {
        'line-color': '#14b8a6',
        'target-arrow-color': '#14b8a6',
        'line-style': 'dashed',
        'width': 1.5,
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
}

/**
 * Get status color based on health
 */
export function getStatusColor(health: string): string {
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

/**
 * Get status border color based on health
 */
export function getStatusBorderColor(health: string): string {
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
