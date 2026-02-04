# Kubilitics Frontend Engineering Blueprint — Part 1

## Architecture, Core Components & Design System

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** AUTHORITATIVE — Single Source of Truth
**Scope:** Desktop (Tauri 2.0), Mobile (Tauri Mobile), Web (Browser)

---

## Table of Contents

1. [Frontend Architecture Overview](#1-frontend-architecture-overview)
2. [Technology Stack Specification](#2-technology-stack-specification)
3. [Project Structure](#3-project-structure)
4. [Design System & Tokens](#4-design-system--tokens)
5. [Core Component Library](#5-core-component-library)
6. [Typography & Iconography](#6-typography--iconography)
7. [Accessibility Requirements](#7-accessibility-requirements)

---

## 1. Frontend Architecture Overview

### 1.1 Platform Matrix

| Platform | Shell | Renderer | Distribution |
|----------|-------|----------|--------------|
| **Desktop macOS** | Tauri 2.0 (WebKit) | React 18 | `.dmg`, `.app` |
| **Desktop Windows** | Tauri 2.0 (WebView2) | React 18 | `.msi`, `.exe` |
| **Desktop Linux** | Tauri 2.0 (WebKitGTK) | React 18 | `.deb`, `.AppImage`, `.rpm` |
| **iOS** | Tauri Mobile (WKWebView) | React 18 | App Store |
| **Android** | Tauri Mobile (WebView) | React 18 | Play Store |
| **Web** | Browser | React 18 | Helm Chart (in-cluster) |

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUBILITICS FRONTEND                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         PRESENTATION LAYER                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │    Pages     │  │   Layouts    │  │   Modals     │                  │ │
│  │  │  (Routes)    │  │  (Shells)    │  │  (Overlays)  │                  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                  │ │
│  │         └─────────────────┴─────────────────┘                          │ │
│  │                           │                                             │ │
│  │  ┌────────────────────────┴────────────────────────┐                   │ │
│  │  │              FEATURE COMPONENTS                  │                   │ │
│  │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ │                   │ │
│  │  │  │Topology │ │Resource │ │ Search  │ │ Pulse  │ │                   │ │
│  │  │  │ Canvas  │ │  List   │ │ Modal   │ │  View  │ │                   │ │
│  │  │  └─────────┘ └─────────┘ └─────────┘ └────────┘ │                   │ │
│  │  └─────────────────────────────────────────────────┘                   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────────┐ │
│  │                         COMPONENT LAYER                                 │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │ │
│  │  │ Button  │ │  Card   │ │  Table  │ │  Tabs   │ │  Panel  │  ...     │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────────┐ │
│  │                          STATE LAYER                                    │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │  Zustand Store  │  │  React Query    │  │  Local State    │        │ │
│  │  │  (Global State) │  │  (Server State) │  │  (Component)    │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│  ┌────────────────────────────────┴───────────────────────────────────────┐ │
│  │                        DATA ACCESS LAYER                                │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │ │
│  │  │   Tauri IPC     │  │   WebSocket     │  │   REST Client   │        │ │
│  │  │   (Desktop)     │  │   (Real-time)   │  │   (HTTP)        │        │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Communication Patterns

#### 1.3.1 Desktop (Tauri IPC)

```typescript
// Tauri command invocation pattern
import { invoke } from '@tauri-apps/api/core';

interface TauriCommand<T, R> {
  command: string;
  args: T;
  response: R;
}

// Example: Get cluster topology
const topology = await invoke<TopologyGraph>('get_topology', {
  clusterId: 'prod-us-east-1',
  namespace: 'default',
  depth: -1, // -1 = full closure
});
```

#### 1.3.2 Web (HTTP + WebSocket)

```typescript
// REST API pattern
const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
});

// WebSocket pattern
const ws = new WebSocket('wss://kubilitics.local/ws');
ws.onmessage = (event) => {
  const update: TopologyUpdate = JSON.parse(event.data);
  store.applyTopologyDelta(update);
};
```

---

## 2. Technology Stack Specification

### 2.1 Core Dependencies (Pinned Versions)

```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router-dom": "6.22.0",
    "@tanstack/react-query": "5.17.0",
    "zustand": "4.5.0",
    "cytoscape": "3.28.1",
    "cytoscape-dagre": "2.5.0",
    "cytoscape-cola": "2.5.1",
    "cytoscape-popper": "2.0.0",
    "@radix-ui/react-alert-dialog": "1.0.5",
    "@radix-ui/react-context-menu": "2.1.5",
    "@radix-ui/react-dialog": "1.0.5",
    "@radix-ui/react-dropdown-menu": "2.0.6",
    "@radix-ui/react-popover": "1.0.7",
    "@radix-ui/react-tabs": "1.0.4",
    "@radix-ui/react-tooltip": "1.0.7",
    "i18next": "23.7.16",
    "react-i18next": "14.0.1",
    "lucide-react": "0.312.0",
    "date-fns": "3.3.1",
    "clsx": "2.1.0",
    "tailwind-merge": "2.2.1"
  },
  "devDependencies": {
    "@tauri-apps/api": "2.0.0",
    "@tauri-apps/cli": "2.0.0",
    "typescript": "5.3.3",
    "vite": "5.0.12",
    "@vitejs/plugin-react-swc": "3.5.0",
    "tailwindcss": "3.4.1",
    "postcss": "8.4.33",
    "autoprefixer": "10.4.17",
    "vitest": "1.2.2",
    "@testing-library/react": "14.2.0",
    "playwright": "1.41.1"
  }
}
```

### 2.2 Build Configuration

#### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
    },
  },

  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: process.env.NODE_ENV !== 'production',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-graph': ['cytoscape', 'cytoscape-dagre', 'cytoscape-cola'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-tabs'],
        },
      },
    },
  },

  // Desktop: Tauri expects localhost:1420
  server: {
    port: 1420,
    strictPort: true,
  },
});
```

---

## 3. Project Structure

```
kubilitics-frontend/
├── src/
│   ├── main.tsx                      # Application entry point
│   ├── App.tsx                       # Root component with providers
│   │
│   ├── components/                   # Shared UI components
│   │   ├── ui/                       # Primitive components (Button, Input, etc.)
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.test.tsx
│   │   │   │   ├── Button.stories.tsx
│   │   │   │   └── index.ts
│   │   │   ├── Card/
│   │   │   ├── Dialog/
│   │   │   ├── DropdownMenu/
│   │   │   ├── Input/
│   │   │   ├── Tabs/
│   │   │   ├── Table/
│   │   │   ├── Toast/
│   │   │   ├── Tooltip/
│   │   │   └── index.ts
│   │   │
│   │   ├── layout/                   # Layout components
│   │   │   ├── AppShell/
│   │   │   ├── Sidebar/
│   │   │   ├── Header/
│   │   │   ├── DetailPanel/
│   │   │   └── BottomSheet/          # Mobile-specific
│   │   │
│   │   ├── feedback/                 # Feedback components
│   │   │   ├── Loading/
│   │   │   ├── Error/
│   │   │   ├── Empty/
│   │   │   └── Skeleton/
│   │   │
│   │   └── common/                   # Common feature components
│   │       ├── ResourceIcon/
│   │       ├── StatusBadge/
│   │       ├── HealthIndicator/
│   │       ├── RelativeTime/
│   │       └── CodeBlock/
│   │
│   ├── features/                     # Feature modules
│   │   ├── topology/                 # Topology canvas
│   │   │   ├── components/
│   │   │   │   ├── TopologyCanvas.tsx
│   │   │   │   ├── TopologyNode.tsx
│   │   │   │   ├── TopologyEdge.tsx
│   │   │   │   ├── TopologyControls.tsx
│   │   │   │   ├── TopologyLegend.tsx
│   │   │   │   ├── TopologyMinimap.tsx
│   │   │   │   └── BlastRadius.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useTopology.ts
│   │   │   │   ├── useTopologyLayout.ts
│   │   │   │   ├── useTopologyInteractions.ts
│   │   │   │   └── useTopologyExport.ts
│   │   │   ├── utils/
│   │   │   │   ├── layoutEngine.ts
│   │   │   │   ├── nodeStyles.ts
│   │   │   │   └── edgeStyles.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── search/                   # Universal search
│   │   │   ├── components/
│   │   │   │   ├── SearchModal.tsx
│   │   │   │   ├── SearchInput.tsx
│   │   │   │   ├── SearchResults.tsx
│   │   │   │   └── SearchHints.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useSearch.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── resources/                # Resource management
│   │   │   ├── pods/
│   │   │   │   ├── PodList.tsx
│   │   │   │   ├── PodDetail.tsx
│   │   │   │   ├── PodOverview.tsx
│   │   │   │   ├── PodContainers.tsx
│   │   │   │   ├── PodEvents.tsx
│   │   │   │   ├── PodLogs.tsx
│   │   │   │   ├── PodTopology.tsx
│   │   │   │   ├── PodYaml.tsx
│   │   │   │   ├── PodSecurity.tsx
│   │   │   │   └── PodPerformance.tsx
│   │   │   ├── deployments/
│   │   │   ├── services/
│   │   │   ├── configmaps/
│   │   │   ├── secrets/
│   │   │   ├── nodes/
│   │   │   ├── namespaces/
│   │   │   ├── persistentvolumes/
│   │   │   ├── persistentvolumeclaims/
│   │   │   ├── ingresses/
│   │   │   ├── networkpolicies/
│   │   │   ├── serviceaccounts/
│   │   │   ├── roles/
│   │   │   ├── rolebindings/
│   │   │   ├── clusterroles/
│   │   │   ├── clusterrolebindings/
│   │   │   ├── storageclasses/
│   │   │   ├── jobs/
│   │   │   ├── cronjobs/
│   │   │   ├── statefulsets/
│   │   │   ├── daemonsets/
│   │   │   ├── replicasets/
│   │   │   ├── endpoints/
│   │   │   ├── endpointslices/
│   │   │   ├── resourcequotas/
│   │   │   ├── limitranges/
│   │   │   ├── events/
│   │   │   ├── crds/
│   │   │   └── _shared/
│   │   │       ├── ResourceList.tsx
│   │   │       ├── ResourceDetail.tsx
│   │   │       └── ResourceActions.tsx
│   │   │
│   │   ├── cluster/                  # Cluster management
│   │   │   ├── ClusterSelector.tsx
│   │   │   ├── ClusterOverview.tsx
│   │   │   └── ClusterPulse.tsx
│   │   │
│   │   ├── collaboration/            # Real-time collaboration
│   │   │   ├── Cursors.tsx
│   │   │   ├── Comments.tsx
│   │   │   └── Presence.tsx
│   │   │
│   │   └── ai/                       # AI features (premium)
│   │       ├── AIChat.tsx
│   │       ├── AISuggestions.tsx
│   │       └── AIRemediation.tsx
│   │
│   ├── pages/                        # Route pages
│   │   ├── Dashboard.tsx
│   │   ├── Topology.tsx
│   │   ├── Workloads.tsx
│   │   ├── Networking.tsx
│   │   ├── Storage.tsx
│   │   ├── Configuration.tsx
│   │   ├── Security.tsx
│   │   ├── Cluster.tsx
│   │   ├── Settings.tsx
│   │   └── NotFound.tsx
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── clusterStore.ts
│   │   ├── topologyStore.ts
│   │   ├── uiStore.ts
│   │   ├── searchStore.ts
│   │   ├── collaborationStore.ts
│   │   └── settingsStore.ts
│   │
│   ├── services/                     # API services
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   ├── resources.ts
│   │   │   ├── topology.ts
│   │   │   ├── logs.ts
│   │   │   ├── exec.ts
│   │   │   └── search.ts
│   │   ├── tauri/
│   │   │   ├── commands.ts
│   │   │   └── events.ts
│   │   └── websocket/
│   │       ├── client.ts
│   │       └── handlers.ts
│   │
│   ├── hooks/                        # Shared hooks
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── useMediaQuery.ts
│   │   ├── usePlatform.ts
│   │   ├── useDebounce.ts
│   │   ├── useInterval.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── kubernetes.ts
│   │   ├── topology.ts
│   │   ├── api.ts
│   │   └── ui.ts
│   │
│   ├── utils/                        # Utility functions
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   ├── kubernetes.ts
│   │   └── export.ts
│   │
│   ├── i18n/                         # Internationalization
│   │   ├── index.ts
│   │   ├── locales/
│   │   │   ├── en/
│   │   │   │   ├── common.json
│   │   │   │   ├── resources.json
│   │   │   │   ├── topology.json
│   │   │   │   └── errors.json
│   │   │   ├── zh-CN/
│   │   │   ├── ja/
│   │   │   ├── es/
│   │   │   ├── pt/
│   │   │   ├── ko/
│   │   │   ├── de/
│   │   │   ├── fr/
│   │   │   ├── ru/
│   │   │   ├── it/
│   │   │   ├── hi/
│   │   │   ├── ar/
│   │   │   ├── tr/
│   │   │   ├── nl/
│   │   │   ├── pl/
│   │   │   ├── th/
│   │   │   ├── vi/
│   │   │   ├── id/
│   │   │   └── he/
│   │   └── utils.ts
│   │
│   └── styles/                       # Global styles
│       ├── globals.css
│       ├── typography.css
│       └── animations.css
│
├── public/
│   ├── fonts/
│   └── icons/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .storybook/                       # Storybook config
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 4. Design System & Tokens

### 4.1 Color Palette

```typescript
// src/styles/tokens/colors.ts
export const colors = {
  // Background colors
  background: {
    primary: {
      light: '#fafafa',   // neutral-50
      dark: '#0a0a0a',    // neutral-950
    },
    secondary: {
      light: '#f5f5f5',   // neutral-100
      dark: '#171717',    // neutral-900
    },
    tertiary: {
      light: '#e5e5e5',   // neutral-200
      dark: '#262626',    // neutral-800
    },
    elevated: {
      light: '#ffffff',
      dark: '#1c1c1c',
    },
  },

  // Text colors
  text: {
    primary: {
      light: '#0a0a0a',   // neutral-950
      dark: '#fafafa',    // neutral-50
    },
    secondary: {
      light: '#525252',   // neutral-600
      dark: '#a3a3a3',    // neutral-400
    },
    tertiary: {
      light: '#737373',   // neutral-500
      dark: '#737373',    // neutral-500
    },
    disabled: {
      light: '#a3a3a3',   // neutral-400
      dark: '#525252',    // neutral-600
    },
  },

  // Brand colors
  brand: {
    primary: '#06b6d4',     // cyan-500 (Kubernetes blue)
    primaryHover: '#0891b2', // cyan-600
    primaryActive: '#0e7490', // cyan-700
  },

  // Semantic colors
  semantic: {
    success: {
      base: '#22c55e',      // green-500
      light: '#dcfce7',     // green-100
      dark: '#166534',      // green-800
    },
    warning: {
      base: '#f59e0b',      // amber-500
      light: '#fef3c7',     // amber-100
      dark: '#92400e',      // amber-800
    },
    danger: {
      base: '#f43f5e',      // rose-500
      light: '#ffe4e6',     // rose-100
      dark: '#9f1239',      // rose-800
    },
    info: {
      base: '#6366f1',      // indigo-500
      light: '#e0e7ff',     // indigo-100
      dark: '#3730a3',      // indigo-800
    },
  },

  // Topology-specific colors
  topology: {
    node: {
      pod: {
        running: '#22c55e',
        pending: '#f59e0b',
        failed: '#f43f5e',
        succeeded: '#3b82f6',
        terminating: '#ef4444',
      },
      deployment: '#6366f1',
      service: '#8b5cf6',
      configmap: '#14b8a6',
      secret: '#f97316',
      pv: '#64748b',
      node: '#0ea5e9',
      namespace: '#a855f7',
      ingress: '#eab308',
    },
    edge: {
      ownerReference: '#6b7280',
      labelSelector: '#9ca3af',
      volumeMount: '#d1d5db',
      networkFlow: '#06b6d4',
      rbac: '#f43f5e',
    },
  },

  // Resource status colors (universal mapping)
  status: {
    healthy: '#22c55e',
    warning: '#f59e0b',
    critical: '#f43f5e',
    unknown: '#6b7280',
    pending: '#3b82f6',
  },
} as const;
```

### 4.2 Spacing Scale

```typescript
// src/styles/tokens/spacing.ts
export const spacing = {
  0: '0px',
  px: '1px',
  0.5: '2px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  3.5: '14px',
  4: '16px',      // Base unit
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
} as const;

// Component-specific spacing
export const componentSpacing = {
  card: {
    padding: spacing[4],        // 16px
    gap: spacing[3],            // 12px
  },
  modal: {
    padding: spacing[6],        // 24px
    headerGap: spacing[4],      // 16px
    contentGap: spacing[4],     // 16px
    footerGap: spacing[3],      // 12px
  },
  table: {
    cellPadding: spacing[3],    // 12px
    headerPadding: spacing[4],  // 16px
  },
  sidebar: {
    width: '256px',
    collapsedWidth: '64px',
    padding: spacing[4],        // 16px
    itemGap: spacing[1],        // 4px
  },
  detailPanel: {
    width: '400px',
    mobileHeight: '60vh',
    padding: spacing[4],        // 16px
  },
} as const;
```

### 4.3 Typography Scale

```typescript
// src/styles/tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Noto Sans',
      'Helvetica',
      'Arial',
      'sans-serif',
      'Noto Sans CJK SC',
      'Noto Sans CJK TC',
      'Noto Sans CJK JP',
      'Noto Sans CJK KR',
    ].join(', '),
    mono: [
      'JetBrains Mono',
      'SF Mono',
      'Consolas',
      'Liberation Mono',
      'Menlo',
      'monospace',
    ].join(', '),
  },

  fontSize: {
    xs: ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
    sm: ['14px', { lineHeight: '20px', letterSpacing: '0' }],
    base: ['16px', { lineHeight: '24px', letterSpacing: '0' }],
    lg: ['18px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
    xl: ['20px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
    '2xl': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
    '3xl': ['30px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
    '4xl': ['36px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// Semantic typography styles
export const textStyles = {
  h1: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
  },
  h2: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.semibold,
  },
  h3: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
  },
  h4: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
  },
  body: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.normal,
  },
  bodySmall: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.normal,
  },
  caption: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.normal,
  },
  code: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.sm,
  },
  mono: {
    fontFamily: typography.fontFamily.mono,
    fontSize: typography.fontSize.xs,
  },
} as const;
```

### 4.4 Elevation (Shadows)

```typescript
// src/styles/tokens/elevation.ts
export const elevation = {
  none: 'none',

  // Level 1: Cards, list items
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',

  // Level 2: Dropdowns, floating panels
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',

  // Level 3: Modals, dialogs
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',

  // Level 4: Popovers, tooltips
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',

  // Special: Focus rings
  focus: '0 0 0 3px rgba(6, 182, 212, 0.4)',
  focusDanger: '0 0 0 3px rgba(244, 63, 94, 0.4)',

  // Topology node glow
  nodeGlow: {
    healthy: '0 0 8px 2px rgba(34, 197, 94, 0.3)',
    warning: '0 0 8px 2px rgba(245, 158, 11, 0.3)',
    critical: '0 0 8px 2px rgba(244, 63, 94, 0.3)',
    selected: '0 0 12px 3px rgba(6, 182, 212, 0.5)',
  },
} as const;
```

### 4.5 Animation Tokens

```typescript
// src/styles/tokens/animation.ts
export const animation = {
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  easing: {
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Pre-composed animations
  transition: {
    default: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '100ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    transform: '200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
    colors: 'color 200ms, background-color 200ms, border-color 200ms',
    opacity: 'opacity 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Keyframe animations (CSS class names)
  keyframes: {
    fadeIn: 'animate-fadeIn',
    fadeOut: 'animate-fadeOut',
    slideInRight: 'animate-slideInRight',
    slideOutRight: 'animate-slideOutRight',
    slideInUp: 'animate-slideInUp',
    slideOutDown: 'animate-slideOutDown',
    scaleIn: 'animate-scaleIn',
    pulse: 'animate-pulse',
    spin: 'animate-spin',
    shimmer: 'animate-shimmer',
    shake: 'animate-shake',
    bounce: 'animate-bounce',
  },
} as const;
```

### 4.6 Border Radius

```typescript
// src/styles/tokens/radius.ts
export const radius = {
  none: '0px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

// Component-specific radii
export const componentRadius = {
  button: radius.md,
  buttonPill: radius.full,
  card: radius.lg,
  modal: radius.xl,
  input: radius.md,
  badge: radius.sm,
  avatar: radius.full,
  tooltip: radius.md,
  topologyNode: radius.md,
} as const;
```

---

## 5. Core Component Library

### 5.1 Button Component

```typescript
// src/components/ui/Button/Button.tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  // Base styles
  `inline-flex items-center justify-center font-medium transition-all
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        primary: `bg-cyan-500 text-white hover:bg-cyan-600
                  focus-visible:ring-cyan-500`,
        secondary: `bg-neutral-100 text-neutral-900 hover:bg-neutral-200
                    dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700
                    focus-visible:ring-neutral-500`,
        outline: `border border-neutral-300 bg-transparent hover:bg-neutral-100
                  dark:border-neutral-700 dark:hover:bg-neutral-800
                  focus-visible:ring-neutral-500`,
        ghost: `bg-transparent hover:bg-neutral-100
                dark:hover:bg-neutral-800
                focus-visible:ring-neutral-500`,
        danger: `bg-rose-500 text-white hover:bg-rose-600
                 focus-visible:ring-rose-500`,
        success: `bg-green-500 text-white hover:bg-green-600
                  focus-visible:ring-green-500`,
        link: `text-cyan-500 underline-offset-4 hover:underline
               focus-visible:ring-cyan-500 p-0 h-auto`,
      },
      size: {
        xs: 'h-7 px-2 text-xs rounded',
        sm: 'h-8 px-3 text-sm rounded-md',
        md: 'h-10 px-4 text-sm rounded-md',
        lg: 'h-11 px-6 text-base rounded-lg',
        xl: 'h-12 px-8 text-base rounded-lg',
        icon: 'h-10 w-10 rounded-md',
        iconSm: 'h-8 w-8 rounded-md',
        iconLg: 'h-12 w-12 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Loading state - shows spinner and disables button */
  isLoading?: boolean;
  /** Icon to show before text */
  leftIcon?: ReactNode;
  /** Icon to show after text */
  rightIcon?: ReactNode;
  /** Accessible label when loading */
  loadingText?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading = false,
      leftIcon,
      rightIcon,
      loadingText,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        )}
        {!isLoading && leftIcon && (
          <span className="mr-2" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {isLoading && loadingText ? loadingText : children}
        {!isLoading && rightIcon && (
          <span className="ml-2" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### 5.2 StatusBadge Component

```typescript
// src/components/common/StatusBadge/StatusBadge.tsx
import { type FC } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-medium',
  {
    variants: {
      status: {
        running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        failed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
        succeeded: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        terminating: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        unknown: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-900/30 dark:text-neutral-400',
        healthy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        critical: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
        available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        bound: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        released: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        notReady: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

// Status indicator dot
const statusDotVariants = cva('rounded-full', {
  variants: {
    status: {
      running: 'bg-green-500',
      pending: 'bg-amber-500',
      failed: 'bg-rose-500',
      succeeded: 'bg-blue-500',
      terminating: 'bg-red-500 animate-pulse',
      unknown: 'bg-neutral-500',
      healthy: 'bg-green-500',
      warning: 'bg-amber-500',
      critical: 'bg-rose-500 animate-pulse',
      available: 'bg-green-500',
      bound: 'bg-blue-500',
      released: 'bg-amber-500',
      active: 'bg-green-500',
      ready: 'bg-green-500',
      notReady: 'bg-rose-500',
    },
    size: {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export type ResourceStatus =
  | 'running'
  | 'pending'
  | 'failed'
  | 'succeeded'
  | 'terminating'
  | 'unknown'
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'available'
  | 'bound'
  | 'released'
  | 'active'
  | 'ready'
  | 'notReady';

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  status: ResourceStatus;
  label?: string;
  showDot?: boolean;
  className?: string;
}

export const StatusBadge: FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
  showDot = true,
  className,
}) => {
  const displayLabel = label ?? status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(statusBadgeVariants({ status, size }), className)}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      {showDot && (
        <span
          className={cn(statusDotVariants({ status, size }))}
          aria-hidden="true"
        />
      )}
      {displayLabel}
    </span>
  );
};
```

### 5.3 ResourceIcon Component

```typescript
// src/components/common/ResourceIcon/ResourceIcon.tsx
import { type FC, memo } from 'react';
import {
  Box,
  Server,
  Database,
  Shield,
  FileText,
  Lock,
  Globe,
  Layers,
  Hexagon,
  Zap,
  RefreshCw,
  HardDrive,
  Network,
  Users,
  Key,
  Scale,
  Ruler,
  Clock,
  Webhook,
  Workflow,
  Package,
  GitBranch,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// Resource type to icon mapping
const resourceIconMap: Record<string, LucideIcon> = {
  // Workloads
  pod: Box,
  deployment: Layers,
  statefulset: Database,
  daemonset: Server,
  replicaset: Layers,
  job: Zap,
  cronjob: RefreshCw,

  // Networking
  service: Network,
  ingress: Globe,
  networkpolicy: Shield,
  endpointslice: Network,
  ingressclass: Globe,

  // Storage
  persistentvolume: HardDrive,
  persistentvolumeclaim: HardDrive,
  storageclass: HardDrive,
  volumeattachment: HardDrive,

  // Configuration
  configmap: FileText,
  secret: Lock,
  resourcequota: Scale,
  limitrange: Ruler,

  // RBAC
  serviceaccount: Users,
  role: Key,
  rolebinding: Key,
  clusterrole: Key,
  clusterrolebinding: Key,

  // Cluster
  node: Server,
  namespace: Hexagon,
  event: Clock,
  lease: Clock,

  // Extensibility
  customresourcedefinition: Settings,
  mutatingwebhookconfiguration: Webhook,
  validatingwebhookconfiguration: Webhook,

  // External
  helmrelease: Package,
  application: GitBranch, // ArgoCD
  kustomization: Workflow, // Flux
};

// Resource type to color mapping
const resourceColorMap: Record<string, string> = {
  // Workloads
  pod: 'text-green-500',
  deployment: 'text-indigo-500',
  statefulset: 'text-purple-500',
  daemonset: 'text-blue-500',
  replicaset: 'text-indigo-400',
  job: 'text-amber-500',
  cronjob: 'text-amber-600',

  // Networking
  service: 'text-violet-500',
  ingress: 'text-yellow-500',
  networkpolicy: 'text-rose-500',
  endpointslice: 'text-violet-400',

  // Storage
  persistentvolume: 'text-slate-500',
  persistentvolumeclaim: 'text-slate-400',
  storageclass: 'text-slate-600',

  // Configuration
  configmap: 'text-teal-500',
  secret: 'text-orange-500',
  resourcequota: 'text-cyan-500',
  limitrange: 'text-cyan-400',

  // RBAC
  serviceaccount: 'text-pink-500',
  role: 'text-rose-400',
  rolebinding: 'text-rose-400',
  clusterrole: 'text-rose-600',
  clusterrolebinding: 'text-rose-600',

  // Cluster
  node: 'text-sky-500',
  namespace: 'text-purple-500',
  event: 'text-neutral-500',
  lease: 'text-neutral-400',
};

export interface ResourceIconProps {
  /** Kubernetes resource kind (lowercase) */
  kind: string;
  /** Icon size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Use default color or inherit */
  colored?: boolean;
}

export const ResourceIcon: FC<ResourceIconProps> = memo(
  ({ kind, size = 20, className, colored = true }) => {
    const normalizedKind = kind.toLowerCase().replace(/s$/, ''); // Remove plural 's'
    const Icon = resourceIconMap[normalizedKind] ?? Box;
    const colorClass = colored ? resourceColorMap[normalizedKind] ?? 'text-neutral-500' : '';

    return (
      <Icon
        size={size}
        className={cn(colorClass, className)}
        aria-hidden="true"
      />
    );
  }
);

ResourceIcon.displayName = 'ResourceIcon';
```

### 5.4 Table Component

```typescript
// src/components/ui/Table/Table.tsx
import {
  type ReactNode,
  type FC,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
  forwardRef,
} from 'react';
import { cn } from '@/utils/cn';

// Table Root
export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  children: ReactNode;
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
);
Table.displayName = 'Table';

// Table Header
export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('[&_tr]:border-b', className)}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

// Table Body
export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

// Table Row
export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  isSelected?: boolean;
  isHovered?: boolean;
}

export const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, isSelected, isHovered, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b transition-colors',
        'hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50',
        'data-[state=selected]:bg-neutral-100 dark:data-[state=selected]:bg-neutral-800',
        isSelected && 'bg-cyan-50 dark:bg-cyan-950/30',
        isHovered && 'bg-neutral-100/50 dark:bg-neutral-800/50',
        className
      )}
      data-state={isSelected ? 'selected' : undefined}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

// Table Head Cell
export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sortDirection, onSort, children, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 px-3 text-left align-middle font-medium text-neutral-500',
        'dark:text-neutral-400',
        '[&:has([role=checkbox])]:pr-0',
        sortable && 'cursor-pointer select-none hover:text-neutral-900 dark:hover:text-neutral-100',
        className
      )}
      onClick={sortable ? onSort : undefined}
      aria-sort={
        sortDirection === 'asc'
          ? 'ascending'
          : sortDirection === 'desc'
          ? 'descending'
          : undefined
      }
      {...props}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortable && sortDirection && (
          <span className="ml-1" aria-hidden="true">
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  )
);
TableHead.displayName = 'TableHead';

// Table Cell
export const TableCell = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'p-3 align-middle [&:has([role=checkbox])]:pr-0',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

// Table Caption
export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-neutral-500 dark:text-neutral-400', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';
```

### 5.5 Tabs Component

```typescript
// src/components/ui/Tabs/Tabs.tsx
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/utils/cn';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-start gap-1 rounded-lg',
      'bg-neutral-100 p-1 text-neutral-500',
      'dark:bg-neutral-800 dark:text-neutral-400',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md',
      'px-3 py-1.5 text-sm font-medium ring-offset-white',
      'transition-all focus-visible:outline-none focus-visible:ring-2',
      'focus-visible:ring-cyan-500 focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-white data-[state=active]:text-neutral-950',
      'data-[state=active]:shadow-sm',
      'dark:ring-offset-neutral-950 dark:data-[state=active]:bg-neutral-900',
      'dark:data-[state=active]:text-neutral-50',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-white focus-visible:outline-none',
      'focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2',
      'dark:ring-offset-neutral-950',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
```

---

## 6. Typography & Iconography

### 6.1 Font Loading Strategy

```typescript
// src/styles/fonts.ts
export const fontLoadingStrategy = {
  // Critical fonts (preload)
  critical: [
    {
      family: 'Inter',
      weights: ['400', '500', '600'],
      display: 'swap',
      preload: true,
    },
    {
      family: 'JetBrains Mono',
      weights: ['400'],
      display: 'swap',
      preload: true,
    },
  ],

  // CJK fonts (lazy load based on locale)
  cjk: [
    {
      family: 'Noto Sans CJK SC',
      locales: ['zh-CN', 'zh-TW'],
    },
    {
      family: 'Noto Sans CJK JP',
      locales: ['ja'],
    },
    {
      family: 'Noto Sans CJK KR',
      locales: ['ko'],
    },
  ],

  // RTL fonts
  rtl: [
    {
      family: 'Noto Sans Arabic',
      locales: ['ar'],
    },
    {
      family: 'Noto Sans Hebrew',
      locales: ['he'],
    },
  ],
};
```

### 6.2 Icon System

```typescript
// src/components/common/Icon/iconRegistry.ts

// Resource status icons (Unicode-based for i18n compatibility)
export const statusIcons = {
  // Pod phases
  podRunning: '●',      // Filled circle
  podPending: '○',      // Empty circle
  podTerminating: '◐',  // Half circle
  podFailed: '✕',       // X mark
  podSucceeded: '✓',    // Checkmark

  // Generic status
  healthy: '●',
  warning: '◐',
  critical: '●',
  unknown: '○',
} as const;

// Topology node shapes (CSS classes)
export const nodeShapes = {
  pod: 'rounded-full',
  deployment: 'rounded-lg',
  statefulset: 'rounded-lg',
  service: 'rotate-45 rounded-sm', // Diamond
  configmap: 'rounded-sm',
  secret: 'rounded-sm',
  pv: 'rounded-full', // Cylinder via gradient
  node: 'rounded-md',
  namespace: 'clip-hexagon', // Custom clip-path
  ingress: 'clip-lightning', // Custom clip-path
  cronjob: 'rounded-full',
} as const;

// Edge types
export const edgeStyles = {
  ownerReference: {
    lineStyle: 'solid',
    width: 2,
    arrow: 'triangle',
  },
  labelSelector: {
    lineStyle: 'dashed',
    width: 1.5,
    arrow: 'vee',
  },
  volumeMount: {
    lineStyle: 'dotted',
    width: 1,
    arrow: 'none',
  },
  networkFlow: {
    lineStyle: 'solid',
    width: 2,
    arrow: 'triangle',
    animated: true,
  },
  rbacBinding: {
    lineStyle: 'dashed',
    width: 1,
    arrow: 'vee',
    color: 'rose',
  },
} as const;
```

---

## 7. Accessibility Requirements

### 7.1 WCAG 2.1 AA Compliance Matrix

| Requirement | Implementation | Testing |
|-------------|----------------|---------|
| **Color Contrast** | Minimum 4.5:1 for text, 3:1 for UI | `axe-core` automated |
| **Keyboard Navigation** | All interactions keyboard-accessible | Manual + Playwright |
| **Focus Indicators** | Visible focus rings on all interactive elements | Visual regression |
| **Screen Reader** | ARIA labels, roles, live regions | NVDA/VoiceOver testing |
| **Motion** | `prefers-reduced-motion` respected | CSS media query |
| **Text Resize** | Supports 200% zoom without loss | Manual testing |

### 7.2 ARIA Implementation Patterns

```typescript
// src/utils/aria.ts

/**
 * Generate unique IDs for ARIA relationships
 */
export const generateAriaId = (prefix: string): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * ARIA live region announcer
 */
export class AriaAnnouncer {
  private static instance: AriaAnnouncer;
  private liveRegion: HTMLElement | null = null;

  static getInstance(): AriaAnnouncer {
    if (!AriaAnnouncer.instance) {
      AriaAnnouncer.instance = new AriaAnnouncer();
    }
    return AriaAnnouncer.instance;
  }

  constructor() {
    if (typeof document !== 'undefined') {
      this.liveRegion = document.createElement('div');
      this.liveRegion.setAttribute('role', 'status');
      this.liveRegion.setAttribute('aria-live', 'polite');
      this.liveRegion.setAttribute('aria-atomic', 'true');
      this.liveRegion.className = 'sr-only';
      document.body.appendChild(this.liveRegion);
    }
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    if (this.liveRegion) {
      this.liveRegion.setAttribute('aria-live', priority);
      this.liveRegion.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = '';
        }
      }, 1000);
    }
  }
}

/**
 * Focus trap for modals and dialogs
 */
export const trapFocus = (container: HTMLElement): (() => void) => {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  firstElement?.focus();

  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};
```

### 7.3 Keyboard Shortcut Registry

```typescript
// src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  modifiers?: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean; // Cmd on Mac
  };
  action: () => void;
  description: string;
  scope?: 'global' | 'topology' | 'list' | 'detail';
}

// Global shortcut registry
export const globalShortcuts: KeyboardShortcut[] = [
  {
    key: 'k',
    modifiers: { meta: true },
    action: () => {}, // Bound in component
    description: 'Open universal search',
    scope: 'global',
  },
  {
    key: 'Escape',
    action: () => {},
    description: 'Close modal / deselect',
    scope: 'global',
  },
  {
    key: '/',
    action: () => {},
    description: 'Focus search',
    scope: 'global',
  },
  {
    key: '?',
    modifiers: { shift: true },
    action: () => {},
    description: 'Show keyboard shortcuts',
    scope: 'global',
  },
  {
    key: 't',
    action: () => {},
    description: 'Toggle topology/list view',
    scope: 'global',
  },
  {
    key: 'r',
    action: () => {},
    description: 'Refresh data',
    scope: 'global',
  },
];

// Topology-specific shortcuts
export const topologyShortcuts: KeyboardShortcut[] = [
  {
    key: '+',
    action: () => {},
    description: 'Zoom in',
    scope: 'topology',
  },
  {
    key: '-',
    action: () => {},
    description: 'Zoom out',
    scope: 'topology',
  },
  {
    key: '0',
    action: () => {},
    description: 'Reset zoom',
    scope: 'topology',
  },
  {
    key: 'f',
    action: () => {},
    description: 'Fit to screen',
    scope: 'topology',
  },
  {
    key: ' ',
    action: () => {},
    description: 'Pause/resume updates',
    scope: 'topology',
  },
  {
    key: 'ArrowUp',
    action: () => {},
    description: 'Select previous node',
    scope: 'topology',
  },
  {
    key: 'ArrowDown',
    action: () => {},
    description: 'Select next node',
    scope: 'topology',
  },
  {
    key: 'Enter',
    action: () => {},
    description: 'Open selected node detail',
    scope: 'topology',
  },
];

// List view shortcuts
export const listShortcuts: KeyboardShortcut[] = [
  {
    key: 'j',
    action: () => {},
    description: 'Move down',
    scope: 'list',
  },
  {
    key: 'k',
    action: () => {},
    description: 'Move up',
    scope: 'list',
  },
  {
    key: 'x',
    action: () => {},
    description: 'Toggle selection',
    scope: 'list',
  },
  {
    key: 'a',
    modifiers: { meta: true },
    action: () => {},
    description: 'Select all',
    scope: 'list',
  },
  {
    key: 'Delete',
    action: () => {},
    description: 'Delete selected (with confirmation)',
    scope: 'list',
  },
];

export const useKeyboardShortcuts = (
  shortcuts: KeyboardShortcut[],
  enabled: boolean = true
) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const modifiers = shortcut.modifiers ?? {};
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

        // Map meta to ctrl on non-Mac
        const cmdKey = isMac ? event.metaKey : event.ctrlKey;

        const modifiersMatch =
          (modifiers.meta ? cmdKey : !cmdKey || !modifiers.meta) &&
          (modifiers.ctrl ? event.ctrlKey : !event.ctrlKey || !modifiers.ctrl) &&
          (modifiers.alt ? event.altKey : !event.altKey || !modifiers.alt) &&
          (modifiers.shift ? event.shiftKey : !event.shiftKey || !modifiers.shift);

        if (event.key === shortcut.key && modifiersMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
```

---

## Next: Part 2 — Screens & Interactions

Continue to `frontend-part-2.md` for:
- Complete screen specifications
- All user interaction definitions
- Navigation patterns
- Mobile adaptations
