# Kubilitics Frontend Engineering Blueprint
## Part 1: Architecture & Core Screens

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Target Platforms:** Desktop (Tauri), Mobile (Tauri iOS/Android), Web (Browser)
**Status:** Build-Ready Specification

---

## Table of Contents

1. [Frontend Architecture Overview](#1-frontend-architecture-overview)
2. [Technology Stack & Dependencies](#2-technology-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [State Management Architecture](#4-state-management-architecture)
5. [Routing & Navigation](#5-routing--navigation)
6. [Core Screen: Application Shell](#6-core-screen-application-shell)
7. [Core Screen: Cluster Dashboard](#7-core-screen-cluster-dashboard)
8. [Core Screen: Topology View](#8-core-screen-topology-view)
9. [Core Screen: Universal Search](#9-core-screen-universal-search)
10. [Component Library Foundation](#10-component-library-foundation)

---

## 1. Frontend Architecture Overview

### 1.1 Architectural Principles

The Kubilitics frontend is built on **four foundational principles**:

1. **Platform-First Design**: Single React codebase, platform-specific adaptations via Tauri bridges
2. **Topology as System of Record**: All UI views consume from the canonical topology graph
3. **Progressive Disclosure**: Layer complexity from beginner to expert modes
4. **Zero-Config Onboarding**: Auto-detection, sensible defaults, immediate value

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    KUBILITICS FRONTEND                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              PRESENTATION LAYER                        │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐     │    │
│  │  │ Desktop  │  │  Mobile  │  │      Web         │     │    │
│  │  │ (Tauri)  │  │ (Tauri)  │  │   (Browser)      │     │    │
│  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘     │    │
│  │       └─────────────┴──────────────────┘               │    │
│  │                      │                                  │    │
│  │         ┌────────────▼────────────────┐                │    │
│  │         │   React Application Core   │                │    │
│  │         │   • React 18 + TypeScript  │                │    │
│  │         │   • Vite Build System      │                │    │
│  │         │   • Hot Module Replacement │                │    │
│  │         └────────────┬────────────────┘                │    │
│  └──────────────────────┼─────────────────────────────────┘    │
│                         │                                      │
│  ┌──────────────────────▼─────────────────────────────────┐    │
│  │              APPLICATION LAYER                          │    │
│  │  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │    │
│  │  │   Screens    │  │ Components │  │  Layouts      │  │    │
│  │  │   (Pages)    │  │   (UI)     │  │  (Structure)  │  │    │
│  │  └──────────────┘  └────────────┘  └───────────────┘  │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                      │
│  ┌──────────────────────▼─────────────────────────────────┐    │
│  │              STATE MANAGEMENT                           │    │
│  │  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │    │
│  │  │   Zustand    │  │  TanStack  │  │  WebSocket    │  │    │
│  │  │   (Global)   │  │   Query    │  │   (Real-time) │  │    │
│  │  │              │  │  (Server)  │  │               │  │    │
│  │  └──────────────┘  └────────────┘  └───────────────┘  │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                      │
│  ┌──────────────────────▼─────────────────────────────────┐    │
│  │              SERVICES LAYER                             │    │
│  │  ┌──────────────┐  ┌────────────┐  ┌───────────────┐  │    │
│  │  │   API        │  │  Topology  │  │  i18n         │  │    │
│  │  │   Client     │  │  Service   │  │  Service      │  │    │
│  │  └──────────────┘  └────────────┘  └───────────────┘  │    │
│  └──────────────────────┬─────────────────────────────────┘    │
│                         │                                      │
│  ┌──────────────────────▼─────────────────────────────────┐    │
│  │              PLATFORM BRIDGE                            │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │   Tauri IPC (Desktop/Mobile)                     │  │    │
│  │  │   • File System Access                           │  │    │
│  │  │   • Native Menus                                 │  │    │
│  │  │   • System Notifications                         │  │    │
│  │  │   • Biometric Auth (Mobile)                      │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                                                         │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │   HTTP/WebSocket Client (Web/All)                │  │    │
│  │  │   • RESTful API Calls                            │  │    │
│  │  │   • GraphQL (Future)                             │  │    │
│  │  │   • WebSocket Streams                            │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (HTTP/WS)
                              ▼
                    ┌──────────────────┐
                    │  Go Backend      │
                    │  (Sidecar/Server)│
                    └──────────────────┘
```

### 1.3 Platform-Specific Considerations

#### Desktop (Tauri)
- **Window Management**: Custom title bar, native menus (macOS menu bar, Windows/Linux menu)
- **File System**: Direct access to kubeconfig files via Tauri's `fs` plugin
- **Updates**: Auto-update via Tauri updater
- **Keyboard Shortcuts**: System-level shortcuts (Cmd+K, Cmd+W, etc.)
- **Bundle Size**: Target 2-5MB (Rust runtime + compressed assets)

#### Mobile (Tauri iOS/Android)
- **Navigation**: Bottom tab bar (iOS), Material bottom nav (Android)
- **Touch Gestures**: Pinch-to-zoom, swipe gestures, long-press context menus
- **Biometric Auth**: FaceID/TouchID (iOS), Fingerprint (Android) via Tauri plugin
- **Offline Mode**: SQLite cache, queued actions
- **Push Notifications**: APNs (iOS), FCM (Android)
- **Adaptive Layouts**: Portrait-first, landscape support for topology

#### Web (Browser)
- **No File System**: kubeconfig upload or paste YAML
- **No Native Menus**: In-app menu system
- **URL Routing**: Full deep-linking support
- **PWA Support**: Service worker for offline caching
- **Responsive**: 320px (mobile) to 4K displays

---

## 2. Technology Stack & Dependencies

### 2.1 Core Framework

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.3.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.0"
  }
}
```

**Rationale**: React 18 for Concurrent Rendering, Suspense boundaries, automatic batching. TypeScript for type safety.

### 2.2 Routing

```json
{
  "dependencies": {
    "react-router-dom": "^6.21.0"
  }
}
```

**Routes Structure**:
```typescript
// routes.tsx
const routes = [
  { path: '/', element: <Dashboard /> },
  { path: '/clusters', element: <ClusterList /> },
  { path: '/clusters/:clusterId', element: <ClusterDetail /> },
  { path: '/topology', element: <TopologyView /> },
  { path: '/pods', element: <PodList /> },
  { path: '/pods/:namespace/:name', element: <PodDetail /> },
  { path: '/deployments', element: <DeploymentList /> },
  { path: '/deployments/:namespace/:name', element: <DeploymentDetail /> },
  // ... 50+ resource types
  { path: '/settings', element: <Settings /> },
  { path: '*', element: <NotFound /> }
];
```

### 2.3 State Management

```json
{
  "dependencies": {
    "zustand": "^4.4.7",
    "@tanstack/react-query": "^5.17.0"
  }
}
```

**Zustand Stores**:
- `useAppStore`: UI state, theme, language, sidebar
- `useKubernetesConfigStore`: Cluster connections, contexts
- `useTopologyStore`: Topology graph state, filters, layout
- `useUserPreferencesStore`: User settings, achievements, onboarding state

**TanStack Query**: Server state (API calls, caching, invalidation)

### 2.4 UI Components

```json
{
  "dependencies": {
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "tailwindcss": "^3.4.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

**Component Library**: Custom components built on Radix UI primitives + TailwindCSS

### 2.5 Topology & Visualization

```json
{
  "dependencies": {
    "cytoscape": "^3.28.1",
    "cytoscape-cola": "^2.5.1",
    "cytoscape-dagre": "^2.5.0",
    "cytoscape-fcose": "^2.2.0",
    "@visx/visx": "^3.10.0",
    "recharts": "^2.10.3"
  }
}
```

**Cytoscape.js**: Main topology engine (10K+ nodes support)
**Layout Algorithms**: Cola (force-directed), Dagre (hierarchical), fCoSE (compound graphs)
**Visx/Recharts**: Charts and metrics visualization

### 2.6 Code Editor & YAML

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.6.0",
    "js-yaml": "^4.1.0",
    "diff": "^5.1.0"
  }
}
```

**Monaco Editor**: VSCode editor for YAML editing with syntax highlighting, validation
**js-yaml**: YAML parsing and serialization
**diff**: YAML diff viewer for history comparison

### 2.7 Internationalization

```json
{
  "dependencies": {
    "i18next": "^23.7.11",
    "react-i18next": "^14.0.0",
    "i18next-browser-languagedetector": "^7.2.0"
  }
}
```

**Languages**: 20+ languages with ICU message format support

### 2.8 Animations

```json
{
  "dependencies": {
    "framer-motion": "^10.18.0"
  }
}
```

**Motion**: Page transitions, topology animations, micro-interactions

### 2.9 Utilities

```json
{
  "dependencies": {
    "date-fns": "^3.0.6",
    "lodash-es": "^4.17.21",
    "sonner": "^1.3.1",
    "lucide-react": "^0.303.0"
  }
}
```

### 2.10 Tauri Dependencies

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0-beta.11",
    "@tauri-apps/plugin-fs": "^2.0.0-beta.5",
    "@tauri-apps/plugin-shell": "^2.0.0-beta.5",
    "@tauri-apps/plugin-notification": "^2.0.0-beta.5",
    "@tauri-apps/plugin-biometric": "^2.0.0-beta.3"
  }
}
```

---

## 3. Project Structure

```
kubilitics-frontend/
├── src/
│   ├── app/                          # Application root
│   │   ├── App.tsx                   # Main app component
│   │   ├── routes.tsx                # Route definitions
│   │   └── providers.tsx             # Context providers
│   │
│   ├── screens/                      # Page-level components
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── ClusterHealthCard.tsx
│   │   │   ├── RecentEventsCard.tsx
│   │   │   └── QuickActionsCard.tsx
│   │   │
│   │   ├── Topology/
│   │   │   ├── TopologyView.tsx
│   │   │   ├── TopologyControls.tsx
│   │   │   ├── TopologyCanvas.tsx
│   │   │   ├── TopologyLegend.tsx
│   │   │   └── NodeDetailPanel.tsx
│   │   │
│   │   ├── Resources/                # Resource type screens
│   │   │   ├── Pods/
│   │   │   │   ├── PodList.tsx
│   │   │   │   ├── PodDetail.tsx
│   │   │   │   └── PodListItem.tsx
│   │   │   ├── Deployments/
│   │   │   ├── Services/
│   │   │   ├── ConfigMaps/
│   │   │   ├── Secrets/
│   │   │   └── ... (50+ types)
│   │   │
│   │   ├── Search/
│   │   │   ├── UniversalSearch.tsx
│   │   │   ├── SearchResults.tsx
│   │   │   └── SearchFilters.tsx
│   │   │
│   │   ├── Settings/
│   │   │   ├── Settings.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ClusterSettings.tsx
│   │   │   ├── AppearanceSettings.tsx
│   │   │   └── AdvancedSettings.tsx
│   │   │
│   │   └── Onboarding/
│   │       ├── Welcome.tsx
│   │       ├── ClusterConnection.tsx
│   │       └── InteractiveTutorial.tsx
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Base UI primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── ... (40+ components)
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── MobileNavigation.tsx
│   │   │
│   │   ├── resources/                # Resource-specific components
│   │   │   ├── ResourceHeader.tsx
│   │   │   ├── ResourceStatusCards.tsx
│   │   │   ├── ResourceTabs.tsx
│   │   │   ├── ContainersSection.tsx
│   │   │   ├── EventsSection.tsx
│   │   │   ├── LogViewer.tsx
│   │   │   ├── TerminalViewer.tsx
│   │   │   ├── YamlViewer.tsx
│   │   │   └── MetricsDashboard.tsx
│   │   │
│   │   ├── topology/                 # Topology-specific
│   │   │   ├── TopologyCanvas.tsx
│   │   │   ├── TopologyNode.tsx
│   │   │   ├── TopologyEdge.tsx
│   │   │   ├── TopologyMinimap.tsx
│   │   │   └── TopologyExport.tsx
│   │   │
│   │   └── common/                   # Common components
│   │       ├── EmptyState.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── SearchBar.tsx
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── appStore.ts
│   │   ├── kubernetesConfigStore.ts
│   │   ├── topologyStore.ts
│   │   └── userPreferencesStore.ts
│   │
│   ├── services/                     # Business logic services
│   │   ├── api/
│   │   │   ├── client.ts            # HTTP client config
│   │   │   ├── kubernetes.ts        # K8s API calls
│   │   │   ├── topology.ts          # Topology API
│   │   │   └── websocket.ts         # WebSocket client
│   │   │
│   │   ├── topology/
│   │   │   ├── graphEngine.ts       # Graph processing
│   │   │   ├── layoutEngine.ts      # Layout algorithms
│   │   │   └── relationshipParser.ts
│   │   │
│   │   └── platform/
│   │       ├── tauri.ts             # Tauri bridge
│   │       ├── filesystem.ts        # File operations
│   │       └── notifications.ts     # System notifications
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useKubernetes.ts
│   │   ├── useResourceDetail.ts
│   │   ├── usePodTopology.ts
│   │   ├── useWebSocket.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   └── useI18n.ts
│   │
│   ├── lib/                          # Utility functions
│   │   ├── utils.ts                 # General utilities
│   │   ├── cn.ts                    # Class name merger
│   │   ├── formatters.ts            # Date/number formatting
│   │   └── validators.ts            # Input validation
│   │
│   ├── types/                        # TypeScript types
│   │   ├── kubernetes.ts            # K8s resource types
│   │   ├── topology.ts              # Topology types
│   │   ├── api.ts                   # API response types
│   │   └── ui.ts                    # UI component types
│   │
│   ├── i18n/                         # Translations
│   │   ├── en/
│   │   │   ├── common.json
│   │   │   ├── dashboard.json
│   │   │   ├── resources.json
│   │   │   └── errors.json
│   │   ├── zh-CN/
│   │   ├── ja/
│   │   └── ... (20+ languages)
│   │
│   ├── styles/                       # Global styles
│   │   ├── globals.css
│   │   ├── themes.css
│   │   └── typography.css
│   │
│   └── main.tsx                      # Application entry point
│
├── public/                           # Static assets
│   ├── icons/
│   ├── images/
│   └── fonts/
│
├── src-tauri/                        # Tauri backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands.rs
│   │   └── menu.rs
│   └── Cargo.toml
│
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 4. State Management Architecture

### 4.1 Global State (Zustand)

#### 4.1.1 App Store

```typescript
// stores/appStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Language
  language: string;
  setLanguage: (language: string) => void;

  // UI State
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Current View
  currentView: 'topology' | 'list';
  setCurrentView: (view: 'topology' | 'list') => void;

  // Cluster Selection
  isClusterSelected: boolean;
  selectedClusterId: string | null;
  setSelectedCluster: (clusterId: string | null) => void;

  // Search
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;

  // Notifications
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),

      language: 'en',
      setLanguage: (language) => set({ language }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      currentView: 'topology',
      setCurrentView: (view) => set({ currentView: view }),

      isClusterSelected: false,
      selectedClusterId: null,
      setSelectedCluster: (clusterId) => set({
        selectedClusterId: clusterId,
        isClusterSelected: !!clusterId
      }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      notificationsEnabled: true,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
    }),
    {
      name: 'kubilitics-app-store',
    }
  )
);
```

#### 4.1.2 Kubernetes Config Store

```typescript
// stores/kubernetesConfigStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface KubeCluster {
  id: string;
  name: string;
  server: string;
  context: string;
  namespace: string;
  isDefault: boolean;
  isConnected: boolean;
  lastConnected?: Date;
  version?: string;
  provider?: 'gke' | 'eks' | 'aks' | 'k3s' | 'kind' | 'minikube' | 'other';
}

interface KubernetesConfigState {
  // Clusters
  clusters: KubeCluster[];
  addCluster: (cluster: KubeCluster) => void;
  removeCluster: (clusterId: string) => void;
  updateCluster: (clusterId: string, updates: Partial<KubeCluster>) => void;
  setDefaultCluster: (clusterId: string) => void;

  // Current Context
  currentContext: string | null;
  setCurrentContext: (context: string | null) => void;

  // Kubeconfig
  kubeconfigPath: string | null;
  setKubeconfigPath: (path: string | null) => void;

  // Connection State
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const useKubernetesConfigStore = create<KubernetesConfigState>()(
  persist(
    (set) => ({
      clusters: [],
      addCluster: (cluster) => set((state) => ({
        clusters: [...state.clusters, cluster]
      })),
      removeCluster: (clusterId) => set((state) => ({
        clusters: state.clusters.filter(c => c.id !== clusterId)
      })),
      updateCluster: (clusterId, updates) => set((state) => ({
        clusters: state.clusters.map(c =>
          c.id === clusterId ? { ...c, ...updates } : c
        )
      })),
      setDefaultCluster: (clusterId) => set((state) => ({
        clusters: state.clusters.map(c => ({
          ...c,
          isDefault: c.id === clusterId
        }))
      })),

      currentContext: null,
      setCurrentContext: (context) => set({ currentContext: context }),

      kubeconfigPath: null,
      setKubeconfigPath: (path) => set({ kubeconfigPath: path }),

      isConnected: false,
      setIsConnected: (connected) => set({ isConnected: connected }),
    }),
    {
      name: 'kubilitics-kubernetes-config',
    }
  )
);
```

#### 4.1.3 Topology Store

```typescript
// stores/topologyStore.ts
import { create } from 'zustand';

export interface TopologyNode {
  id: string;
  type: string;
  name: string;
  namespace?: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
  metadata?: Record<string, any>;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: 'owner' | 'selector' | 'volume' | 'network' | 'rbac';
  label?: string;
}

interface TopologyState {
  // Graph Data
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  setGraph: (nodes: TopologyNode[], edges: TopologyEdge[]) => void;

  // Selection
  selectedNodes: string[];
  setSelectedNodes: (nodeIds: string[]) => void;
  addSelectedNode: (nodeId: string) => void;
  removeSelectedNode: (nodeId: string) => void;
  clearSelection: () => void;

  // Filters
  filters: {
    namespaces: string[];
    resourceTypes: string[];
    statuses: string[];
  };
  setFilters: (filters: Partial<TopologyState['filters']>) => void;

  // Layout
  layoutAlgorithm: 'cola' | 'dagre' | 'fcose';
  setLayoutAlgorithm: (algorithm: 'cola' | 'dagre' | 'fcose') => void;

  // Zoom & Pan
  zoom: number;
  setZoom: (zoom: number) => void;
  pan: { x: number; y: number };
  setPan: (pan: { x: number; y: number }) => void;

  // Layers (X-Ray Vision)
  visibleLayers: {
    compute: boolean;
    network: boolean;
    storage: boolean;
    security: boolean;
    configuration: boolean;
  };
  toggleLayer: (layer: keyof TopologyState['visibleLayers']) => void;

  // Time Machine
  timeMachineEnabled: boolean;
  selectedTimestamp: Date | null;
  setTimeMachineEnabled: (enabled: boolean) => void;
  setSelectedTimestamp: (timestamp: Date | null) => void;
}

export const useTopologyStore = create<TopologyState>((set) => ({
  nodes: [],
  edges: [],
  setGraph: (nodes, edges) => set({ nodes, edges }),

  selectedNodes: [],
  setSelectedNodes: (nodeIds) => set({ selectedNodes: nodeIds }),
  addSelectedNode: (nodeId) => set((state) => ({
    selectedNodes: [...state.selectedNodes, nodeId]
  })),
  removeSelectedNode: (nodeId) => set((state) => ({
    selectedNodes: state.selectedNodes.filter(id => id !== nodeId)
  })),
  clearSelection: () => set({ selectedNodes: [] }),

  filters: {
    namespaces: [],
    resourceTypes: [],
    statuses: [],
  },
  setFilters: (filters) => set((state) => ({
    filters: { ...state.filters, ...filters }
  })),

  layoutAlgorithm: 'cola',
  setLayoutAlgorithm: (algorithm) => set({ layoutAlgorithm: algorithm }),

  zoom: 1,
  setZoom: (zoom) => set({ zoom }),

  pan: { x: 0, y: 0 },
  setPan: (pan) => set({ pan }),

  visibleLayers: {
    compute: true,
    network: true,
    storage: true,
    security: true,
    configuration: true,
  },
  toggleLayer: (layer) => set((state) => ({
    visibleLayers: {
      ...state.visibleLayers,
      [layer]: !state.visibleLayers[layer],
    },
  })),

  timeMachineEnabled: false,
  selectedTimestamp: null,
  setTimeMachineEnabled: (enabled) => set({ timeMachineEnabled: enabled }),
  setSelectedTimestamp: (timestamp) => set({ selectedTimestamp: timestamp }),
}));
```

#### 4.1.4 User Preferences Store

```typescript
// stores/userPreferencesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt?: Date;
}

interface UserPreferencesState {
  // Onboarding
  onboardingCompleted: boolean;
  setOnboardingCompleted: (completed: boolean) => void;

  // Achievements
  achievements: Achievement[];
  unlockAchievement: (achievementId: string) => void;

  // Gamification
  level: number;
  actionsCount: number;
  incrementActionsCount: () => void;

  // Custom Views
  savedViews: Array<{
    id: string;
    name: string;
    filters: any;
    layout: any;
  }>;
  addSavedView: (view: any) => void;
  removeSavedView: (viewId: string) => void;

  // Advanced Settings
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
  refreshInterval: number; // milliseconds
  setRefreshInterval: (interval: number) => void;

  // Developer Mode
  developerMode: boolean;
  setDeveloperMode: (enabled: boolean) => void;
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      onboardingCompleted: false,
      setOnboardingCompleted: (completed) => set({ onboardingCompleted: completed }),

      achievements: [],
      unlockAchievement: (achievementId) => set((state) => ({
        achievements: state.achievements.map(a =>
          a.id === achievementId ? { ...a, unlockedAt: new Date() } : a
        )
      })),

      level: 1,
      actionsCount: 0,
      incrementActionsCount: () => set((state) => {
        const newCount = state.actionsCount + 1;
        const newLevel = Math.floor(Math.log2(newCount / 10 + 1)) + 1;
        return { actionsCount: newCount, level: newLevel };
      }),

      savedViews: [],
      addSavedView: (view) => set((state) => ({
        savedViews: [...state.savedViews, view]
      })),
      removeSavedView: (viewId) => set((state) => ({
        savedViews: state.savedViews.filter(v => v.id !== viewId)
      })),

      autoRefresh: true,
      setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),

      refreshInterval: 10000, // 10 seconds
      setRefreshInterval: (interval) => set({ refreshInterval: interval }),

      developerMode: false,
      setDeveloperMode: (enabled) => set({ developerMode: enabled }),
    }),
    {
      name: 'kubilitics-user-preferences',
    }
  )
);
```

### 4.2 Server State (TanStack Query)

```typescript
// services/api/client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds
      cacheTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

// Query keys factory
export const queryKeys = {
  // Clusters
  clusters: ['clusters'] as const,
  cluster: (id: string) => ['clusters', id] as const,

  // Resources
  resources: (type: string) => ['resources', type] as const,
  resource: (type: string, namespace: string, name: string) =>
    ['resources', type, namespace, name] as const,

  // Topology
  topology: (namespace?: string) => ['topology', namespace] as const,

  // Events
  events: (namespace?: string) => ['events', namespace] as const,

  // Metrics
  metrics: (type: string, namespace: string, name: string) =>
    ['metrics', type, namespace, name] as const,
};
```

---

## 5. Routing & Navigation

### 5.1 Route Configuration

```typescript
// app/routes.tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';

// Lazy loading for code splitting
const Dashboard = lazy(() => import('@/screens/Dashboard/Dashboard'));
const TopologyView = lazy(() => import('@/screens/Topology/TopologyView'));
const PodList = lazy(() => import('@/screens/Resources/Pods/PodList'));
const PodDetail = lazy(() => import('@/screens/Resources/Pods/PodDetail'));
// ... more lazy imports

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'topology',
        element: <TopologyView />,
      },
      {
        path: 'search',
        element: <SearchView />,
      },
      // Resource routes
      {
        path: 'pods',
        children: [
          {
            index: true,
            element: <PodList />,
          },
          {
            path: ':namespace/:name',
            element: <PodDetail />,
          },
        ],
      },
      {
        path: 'deployments',
        children: [
          {
            index: true,
            element: <DeploymentList />,
          },
          {
            path: ':namespace/:name',
            element: <DeploymentDetail />,
          },
        ],
      },
      // ... repeat for all 50+ resource types
      {
        path: 'settings',
        element: <Settings />,
      },
    ],
  },
  {
    path: '/onboarding',
    element: <Onboarding />,
  },
]);
```

### 5.2 Navigation Patterns

#### 5.2.1 Desktop Navigation

- **Sidebar**: Persistent left sidebar with collapsible sections
- **Top Bar**: Cluster switcher, search, notifications, user menu
- **Breadcrumbs**: Current location hierarchy
- **Keyboard Shortcuts**: Full keyboard navigation support

#### 5.2.2 Mobile Navigation

- **Bottom Tab Bar**: 5 primary tabs (Dashboard, Topology, Resources, Search, Settings)
- **Swipe Gestures**: Swipe between tabs, swipe back for navigation
- **Hamburger Menu**: Secondary navigation in drawer

#### 5.2.3 Deep Linking

All screens support deep linking with URL parameters:

```
# Desktop/Web
kubilitics://pods/default/nginx-deployment-abc123
https://app.kubilitics.com/pods/default/nginx-deployment-abc123

# Mobile (QR Code)
kubilitics://cluster?server=https://k8s.example.com&token=...
```

---

## 6. Core Screen: Application Shell

### 6.1 Screen Identity

**Screen Name**: Application Shell (App Shell)
**Entry Points**: All authenticated routes
**Platforms**: Desktop, Mobile, Web
**Route**: `/` (wraps all routes as layout)

### 6.2 Layout & Structure

#### 6.2.1 Desktop Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header (64px fixed)                                        │
│  [Logo] [Cluster Selector ▼] [Search 🔍] [Notif 🔔] [User]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┬───────────────────────────────────────────┐   │
│  │ Sidebar │ Main Content Area                         │   │
│  │ (240px) │ (Scrollable)                              │   │
│  │         │                                           │   │
│  │ • Home  │ [Breadcrumbs]                             │   │
│  │ • Topo  │                                           │   │
│  │         │ [Page Content]                            │   │
│  │ ▼ Work  │                                           │   │
│  │   Pods  │                                           │   │
│  │   Depl  │                                           │   │
│  │         │                                           │   │
│  │ ▼ Net   │                                           │   │
│  │   Svcs  │                                           │   │
│  │         │                                           │   │
│  └─────────┴───────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 6.2.2 Mobile Layout

```
┌─────────────────────┐
│  Header (56px)      │
│  [≡] [Title] [🔔]  │
├─────────────────────┤
│                     │
│  Main Content       │
│  (Scrollable)       │
│                     │
│                     │
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│  Bottom Tab Bar     │
│  [🏠] [🗺] [📦] [🔍] [⚙]│
└─────────────────────┘
```

### 6.3 UI Components

#### 6.3.1 Header Component

**File**: `components/layout/Header.tsx`

```typescript
interface HeaderProps {
  // No props - reads from global state
}

export function Header() {
  const { selectedClusterId } = useKubernetesConfigStore();
  const { setSearchOpen } = useAppStore();

  return (
    <header className="h-16 border-b border-border bg-background">
      <div className="flex items-center justify-between h-full px-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <Logo />
          <ClusterSelector />
        </div>

        {/* Center (Desktop only) */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4">
          <SearchTrigger onClick={() => setSearchOpen(true)} />
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <NotificationButton />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
```

**Interactions**:
- **Logo Click**: Navigate to `/` (Dashboard)
- **Cluster Selector**: Dropdown to switch clusters, add new cluster
- **Search Trigger**: Opens Universal Search (Cmd+K / ⌘K)
- **Notification Button**: Shows notification panel
- **User Menu**: Settings, documentation, logout

**States**:
- **No Cluster Selected**: Show "Select Cluster" prompt
- **Cluster Selected**: Show cluster name and status indicator (green=connected, yellow=connecting, red=disconnected)
- **Multiple Clusters**: Show count badge

#### 6.3.2 Sidebar Component

**File**: `components/layout/Sidebar.tsx`

```typescript
interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const isCollapsed = collapsed || sidebarCollapsed;

  return (
    <aside className={cn(
      "h-full border-r border-border bg-background transition-all duration-300",
      isCollapsed ? "w-16" : "w-60"
    )}>
      {/* Collapse Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="absolute top-2 right-2"
      >
        {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
      </Button>

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        <SidebarSection title="Overview" collapsed={isCollapsed}>
          <SidebarItem icon={Home} label="Dashboard" to="/" />
          <SidebarItem icon={Map} label="Topology" to="/topology" />
        </SidebarSection>

        <SidebarSection title="Workloads" collapsed={isCollapsed} collapsible>
          <SidebarItem icon={Box} label="Pods" to="/pods" />
          <SidebarItem icon={Layers} label="Deployments" to="/deployments" />
          <SidebarItem icon={Database} label="StatefulSets" to="/statefulsets" />
          <SidebarItem icon={GitBranch} label="DaemonSets" to="/daemonsets" />
          <SidebarItem icon={Zap} label="Jobs" to="/jobs" />
          <SidebarItem icon={Clock} label="CronJobs" to="/cronjobs" />
        </SidebarSection>

        <SidebarSection title="Networking" collapsed={isCollapsed} collapsible>
          <SidebarItem icon={Network} label="Services" to="/services" />
          <SidebarItem icon={Globe} label="Ingresses" to="/ingresses" />
          <SidebarItem icon={Shield} label="Network Policies" to="/networkpolicies" />
        </SidebarSection>

        {/* ... more sections */}
      </nav>
    </aside>
  );
}
```

**Interactions**:
- **Collapse Toggle**: Collapse/expand sidebar (Cmd+B / Ctrl+B)
- **Section Click**: Expand/collapse section (if collapsible)
- **Item Click**: Navigate to resource list
- **Item Hover**: Show full label if collapsed
- **Item Badge**: Show resource count (e.g., "Pods (42)")

**States**:
- **Collapsed**: Icons only, hover shows tooltip
- **Expanded**: Icons + labels
- **Active Route**: Highlighted with accent color
- **Loading**: Skeleton loaders for counts

#### 6.3.3 Mobile Bottom Navigation

**File**: `components/layout/MobileNavigation.tsx`

```typescript
export function MobileNavigation() {
  const location = useLocation();

  const tabs = [
    { icon: Home, label: 'Home', to: '/' },
    { icon: Map, label: 'Topology', to: '/topology' },
    { icon: Box, label: 'Resources', to: '/resources' },
    { icon: Search, label: 'Search', to: '/search' },
    { icon: Settings, label: 'Settings', to: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 border-t border-border bg-background md:hidden">
      <div className="flex items-center justify-around h-full">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] mt-1">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

### 6.4 User Interactions

| Gesture | Desktop | Mobile | Result |
|---------|---------|--------|--------|
| **Click Logo** | Click | Tap | Navigate to Dashboard |
| **Click Cluster Selector** | Click | Tap | Open cluster dropdown |
| **Search Trigger** | Cmd+K or Click | Tap or Swipe down | Open Universal Search |
| **Sidebar Item Click** | Click | N/A | Navigate to resource list |
| **Toggle Sidebar** | Cmd+B or Button | N/A | Collapse/expand sidebar |
| **Bottom Tab Tap** | N/A | Tap | Navigate to tab |
| **Swipe Tab** | N/A | Swipe left/right | Switch between tabs |
| **Notification Bell** | Click | Tap | Open notification panel |

### 6.5 Error Handling

**No Cluster Selected**:
- Display empty state in main content area
- Show "Connect to Cluster" onboarding flow
- Disable resource navigation items

**Connection Lost**:
- Show banner at top: "Connection lost. Showing cached data."
- Attempt reconnection every 10 seconds
- Show reconnect button

**Unauthorized**:
- Redirect to login/cluster selection
- Show error toast: "You don't have permission to access this cluster"

---

## 7. Core Screen: Cluster Dashboard

### 7.1 Screen Identity

**Screen Name**: Cluster Dashboard
**Entry Points**:
- Direct navigation: `/`
- Logo click
- Home sidebar item
- Bottom tab (Mobile)

**Platforms**: Desktop, Mobile, Web
**Route**: `/`

### 7.2 Layout & Structure

```
┌─────────────────────────────────────────────────────────────┐
│  [Breadcrumbs: Home]                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Cluster Health Overview                            │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │   │
│  │  │Nodes │ │ Pods │ │Svcs  │ │Warn  │              │   │
│  │  │  ✓5  │ │ ✓142 │ │ ✓28  │ │  ⚠3  │              │   │
│  │  └──────┘ └──────┘ └──────┘ └──────┘              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────┬───────────────────────────────────┐   │
│  │  Topology       │  Recent Events                    │   │
│  │  Preview        │  • nginx scaled to 5 (2m ago)     │   │
│  │  (Mini graph)   │  • db-pod restarted (5m ago)      │   │
│  │                 │  • backup-job failed (12m ago)    │   │
│  │                 │                                   │   │
│  └─────────────────┴───────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Resource Distribution (Charts)                     │   │
│  │  [CPU Usage]  [Memory Usage]  [Pod Distribution]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Quick Actions                                      │   │
│  │  [Deploy App] [Create Resource] [Import YAML]      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 UI Components

#### 7.3.1 Cluster Health Cards

**File**: `screens/Dashboard/ClusterHealthCard.tsx`

```typescript
interface HealthMetric {
  label: string;
  value: number | string;
  total?: number;
  status: 'success' | 'warning' | 'error' | 'info';
  icon: LucideIcon;
}

export function ClusterHealthCard() {
  const { data: clusterHealth } = useClusterHealth();

  const metrics: HealthMetric[] = [
    {
      label: 'Nodes',
      value: clusterHealth?.nodes.ready || 0,
      total: clusterHealth?.nodes.total || 0,
      status: clusterHealth?.nodes.ready === clusterHealth?.nodes.total ? 'success' : 'warning',
      icon: Server,
    },
    {
      label: 'Pods',
      value: clusterHealth?.pods.running || 0,
      total: clusterHealth?.pods.total || 0,
      status: clusterHealth?.pods.failed > 0 ? 'error' : 'success',
      icon: Box,
    },
    {
      label: 'Services',
      value: clusterHealth?.services.total || 0,
      status: 'success',
      icon: Network,
    },
    {
      label: 'Warnings',
      value: clusterHealth?.warnings || 0,
      status: clusterHealth?.warnings > 0 ? 'warning' : 'success',
      icon: AlertTriangle,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cluster Health</CardTitle>
        <CardDescription>Real-time cluster status overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col items-center p-4 rounded-lg border">
              <metric.icon className={cn("h-6 w-6 mb-2", statusColor(metric.status))} />
              <span className="text-2xl font-bold">
                {metric.total ? `${metric.value}/${metric.total}` : metric.value}
              </span>
              <span className="text-sm text-muted-foreground">{metric.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Interactions**:
- **Hover**: Show tooltip with details
- **Click**: Navigate to resource list (e.g., click Pods → `/pods`)
- **Real-time Updates**: Refresh every 5 seconds

**States**:
- **Loading**: Skeleton loaders
- **Error**: Show error message with retry button
- **No Data**: Show "No data available"

#### 7.3.2 Topology Preview

**File**: `screens/Dashboard/TopologyPreviewCard.tsx`

```typescript
export function TopologyPreviewCard() {
  const { nodes, edges } = useDashboardTopology(); // Simplified graph

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Topology Overview</CardTitle>
            <CardDescription>Visual cluster map</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/topology')}>
            View Full <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-64 border rounded-lg">
          <TopologyCanvas
            nodes={nodes}
            edges={edges}
            interactive={false}
            minimap={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
```

**Interactions**:
- **Click "View Full"**: Navigate to full topology view
- **Hover on Node**: Show tooltip with resource name and status
- **Click on Node**: Navigate to resource detail

**States**:
- **Loading**: Skeleton with animated pulse
- **Empty**: Show message "No resources to display"

#### 7.3.3 Recent Events

**File**: `screens/Dashboard/RecentEventsCard.tsx`

```typescript
export function RecentEventsCard() {
  const { data: events } = useRecentEvents({ limit: 10 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Last 10 cluster events</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {events?.map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
              onClick={() => navigateToResource(event.involvedObject)}
            >
              <EventIcon type={event.type} />
              <div className="flex-1">
                <p className="text-sm font-medium">{event.message}</p>
                <p className="text-xs text-muted-foreground">{event.reason} • {formatAge(event.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Interactions**:
- **Click Event**: Navigate to involved resource
- **Hover**: Highlight event row
- **Auto-refresh**: New events appear at top with slide-in animation

**States**:
- **No Events**: Show "No recent events"
- **Event Types**: Normal (blue), Warning (yellow), Error (red)

### 7.4 Error Handling

**No Cluster Connected**:
```tsx
<Card className="text-center p-12">
  <Server className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold mb-2">No Cluster Connected</h3>
  <p className="text-sm text-muted-foreground mb-4">
    Connect to a Kubernetes cluster to see your dashboard
  </p>
  <Button onClick={() => navigate('/clusters/add')}>
    <Plus className="mr-2 h-4 w-4" />
    Add Cluster
  </Button>
</Card>
```

**Connection Error**:
```tsx
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Connection Error</AlertTitle>
  <AlertDescription>
    Failed to fetch cluster data. {error.message}
  </AlertDescription>
  <Button variant="outline" size="sm" onClick={refetch}>
    Retry
  </Button>
</Alert>
```

---

## 8. Core Screen: Topology View

### 8.1 Screen Identity

**Screen Name**: Topology View
**Entry Points**:
- Direct navigation: `/topology`
- Sidebar: "Topology" item
- Dashboard: "View Full Topology" button
- Deep link: `/topology?namespace=default&resource=pod/nginx`

**Platforms**: Desktop, Mobile, Web
**Route**: `/topology`

### 8.2 Layout & Structure

#### Desktop Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Breadcrumbs: Home > Topology]                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Topology Controls                                  │   │
│  │  [Filters ▼] [Layers ▼] [Layout ▼] [Time 🕒] [⤢]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌───┬─────────────────────────────────────────────────┐   │
│  │ L │  Topology Canvas (Full Screen)                  │   │
│  │ e │                                                  │   │
│  │ g │  [Interactive Graph]                            │   │
│  │ e │                                                  │   │
│  │ n │                                                  │   │
│  │ d │                                                  │   │
│  └───┴─────────────────────────────────────────────────┘   │
│                                                             │
│  [Minimap]  [Zoom: 100%]  [Selected: 0]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

(Continued in Part 2...)
