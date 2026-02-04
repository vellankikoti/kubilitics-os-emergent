/**
 * Topology Store
 * Global state for topology visualization
 * Per PRD Part 3: State Management Architecture
 */
import { create } from 'zustand';
import type { TopologyFilters, TopologyNode, TopologyEdge } from '@/types/topology';

interface TopologyState {
  // Selection state
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  // View state
  zoomLevel: number;
  panPosition: { x: number; y: number };
  isPaused: boolean;

  // Display options
  showLabels: boolean;
  showNamespaces: boolean;
  showTrafficFlow: boolean;

  // Filters
  filters: TopologyFilters;

  // Layout
  layoutMode: 'dagre' | 'cola';
  layoutSeed: string | null;

  // Actions
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  setZoomLevel: (level: number) => void;
  setPanPosition: (position: { x: number; y: number }) => void;
  setIsPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setShowLabels: (show: boolean) => void;
  setShowNamespaces: (show: boolean) => void;
  setShowTrafficFlow: (show: boolean) => void;
  setFilters: (filters: TopologyFilters) => void;
  setLayoutMode: (mode: 'dagre' | 'cola') => void;
  setLayoutSeed: (seed: string | null) => void;
  resetView: () => void;
}

export const useTopologyStore = create<TopologyState>((set) => ({
  // Initial state
  selectedNodeId: null,
  hoveredNodeId: null,
  zoomLevel: 1,
  panPosition: { x: 0, y: 0 },
  isPaused: false,
  showLabels: true,
  showNamespaces: true,
  showTrafficFlow: true,
  filters: {},
  layoutMode: 'dagre',
  layoutSeed: null,

  // Actions
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  setZoomLevel: (level) => set({ zoomLevel: level }),
  setPanPosition: (position) => set({ panPosition: position }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowNamespaces: (show) => set({ showNamespaces: show }),
  setShowTrafficFlow: (show) => set({ showTrafficFlow: show }),
  setFilters: (filters) => set({ filters }),
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setLayoutSeed: (seed) => set({ layoutSeed: seed }),
  resetView: () =>
    set({
      selectedNodeId: null,
      hoveredNodeId: null,
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 },
      isPaused: false,
    }),
}));
