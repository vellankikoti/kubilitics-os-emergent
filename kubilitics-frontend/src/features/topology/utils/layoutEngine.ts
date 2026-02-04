/**
 * Deterministic Layout Engine
 * Per PRD Part 3: Deterministic Layout System
 * CRITICAL: Same seed MUST produce same layout every time
 */
import { Core } from 'cytoscape';
import seedrandom from 'seedrandom';

interface LayoutConfig {
  name: 'dagre' | 'cola' | 'preset';
  seed: string;
  options: Record<string, unknown>;
}

/**
 * Apply deterministic layout to the graph
 */
export function applyLayout(cy: Core, seed: string): Promise<void> {
  return new Promise((resolve) => {
    // Create seeded random number generator
    const rng = seedrandom(seed);

    // Configure layout based on graph size
    const nodeCount = cy.nodes().length;
    const layoutConfig = getLayoutConfig(nodeCount, rng);

    // Run layout
    const layout = cy.layout(layoutConfig.options as any);

    layout.on('layoutstop', () => {
      // Round positions to ensure determinism
      cy.nodes().forEach((node) => {
        const pos = node.position();
        node.position({
          x: Math.round(pos.x * 100) / 100,
          y: Math.round(pos.y * 100) / 100,
        });
      });

      resolve();
    });

    layout.run();
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
      randomize: false,
    },
  };
}

/**
 * Apply namespace grouping layout
 */
export function applyNamespaceGrouping(cy: Core): void {
  // Get unique namespaces
  const namespaces = new Set<string>();
  cy.nodes().forEach((node) => {
    const ns = node.data('namespace');
    if (ns && ns !== 'cluster') namespaces.add(ns);
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
      if (node.id() !== nsNodeId && !node.isChild()) {
        node.move({ parent: nsNodeId });
      }
    });
  });
}

/**
 * Generate a deterministic seed from graph content
 */
export function generateLayoutSeed(nodes: { id: string }[], edges: { source: string; target: string }[]): string {
  const nodeHash = hashString(nodes.map((n) => n.id).sort().join('|'));
  const edgeHash = hashString(edges.map((e) => `${e.source}->${e.target}`).sort().join('|'));
  return `${nodeHash}-${edgeHash}`;
}

/**
 * Simple hash function for deterministic seeding
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
