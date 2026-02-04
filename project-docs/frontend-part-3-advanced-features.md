# Kubilitics Frontend Engineering Blueprint
## Part 3: Advanced Features, Mobile UI & Edge Cases

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Prerequisites:** Read Parts 1 and 2 first

---

## Table of Contents

1. [Keyboard Shortcuts (Complete Reference)](#1-keyboard-shortcuts-complete-reference)
2. [Mobile-Specific UI Patterns](#2-mobile-specific-ui-patterns)
3. [Accessibility (WCAG 2.1 AA Compliance)](#3-accessibility-wcag-21-aa-compliance)
4. [Advanced Features Implementation](#4-advanced-features-implementation)
5. [Internationalization (i18n) Implementation](#5-internationalization-i18n-implementation)
6. [Error Handling Patterns](#6-error-handling-patterns)
7. [Offline Mode & Caching Strategy](#7-offline-mode--caching-strategy)
8. [Performance Optimization](#8-performance-optimization)
9. [Visual Consistency Rules](#9-visual-consistency-rules)
10. [Edge Cases & Forbidden States](#10-edge-cases--forbidden-states)

---

## 1. Keyboard Shortcuts (Complete Reference)

### 1.1 Global Shortcuts

| Shortcut | Action | Scope | Implementation |
|----------|--------|-------|----------------|
| **Cmd/Ctrl + K** | Open Universal Search | Global | `useKeyboardShortcut('mod+k', () => setSearchOpen(true))` |
| **Cmd/Ctrl + B** | Toggle Sidebar | Global | `useKeyboardShortcut('mod+b', () => toggleSidebar())` |
| **Cmd/Ctrl + ,** | Open Settings | Global | `useKeyboardShortcut('mod+comma', () => navigate('/settings'))` |
| **Cmd/Ctrl + R** | Refresh Current View | Global | `useKeyboardShortcut('mod+r', (e) => { e.preventDefault(); refetch(); })` |
| **Cmd/Ctrl + F** | Find in Page | Global | Browser default (no override) |
| **Cmd/Ctrl + W** | Close Tab/Window | Global | Tauri handled (desktop only) |
| **Cmd/Ctrl + Q** | Quit Application | Global | Tauri handled (desktop only) |
| **Cmd/Ctrl + Tab** | Next Tab (Resource Detail) | Resource Detail | `useKeyboardShortcut('mod+tab', cycleTabForward)` |
| **Cmd/Ctrl + Shift + Tab** | Previous Tab | Resource Detail | `useKeyboardShortcut('mod+shift+tab', cycleTabBackward)` |
| **ESC** | Close Dialog/Modal | Modal Open | Radix UI handled automatically |
| **Space** | Pause/Resume Updates | Topology View | `useKeyboardShortcut('space', togglePause)` |
| **?** | Show Keyboard Shortcuts Help | Global | `useKeyboardShortcut('shift+slash', showShortcutsDialog)` |

### 1.2 Navigation Shortcuts

| Shortcut | Action | Scope |
|----------|--------|-------|
| **G then D** | Go to Dashboard | Global |
| **G then T** | Go to Topology | Global |
| **G then P** | Go to Pods | Global |
| **G then S** | Go to Settings | Global |
| **Alt + ←** | Go Back | Global (history) |
| **Alt + →** | Go Forward | Global (history) |

### 1.3 Topology View Shortcuts

| Shortcut | Action |
|----------|--------|
| **+** | Zoom In |
| **-** | Zoom Out |
| **0** | Reset Zoom (100%) |
| **F** | Fit to Screen |
| **C** | Center Selection |
| **Cmd/Ctrl + A** | Select All Nodes |
| **Cmd/Ctrl + D** | Deselect All |
| **Shift + Click** | Multi-select |
| **Cmd/Ctrl + Click** | Add to Selection |
| **Delete/Backspace** | Delete Selected (with confirmation) |
| **Arrow Keys** | Pan Canvas (10px increments) |
| **Shift + Arrow** | Pan Canvas (50px increments) |
| **L** | Change Layout Algorithm |
| **H** | Toggle Layers Panel |

### 1.4 List View Shortcuts

| Shortcut | Action |
|----------|--------|
| **↑ / ↓** | Navigate List |
| **Enter** | Open Selected Resource |
| **Space** | Toggle Selection (Checkbox) |
| **Cmd/Ctrl + A** | Select All |
| **Cmd/Ctrl + D** | Deselect All |
| **Delete** | Delete Selected (with confirmation) |

### 1.5 Search Shortcuts

| Shortcut | Action |
|----------|--------|
| **↑ / ↓** | Navigate Results |
| **Enter** | Select Result |
| **Tab** | Next Category |
| **Shift + Tab** | Previous Category |
| **ESC** | Close Search |

### 1.6 Implementation

```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';

type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift';
type Key = string;
type KeyCombo = `${ModifierKey}+${Key}` | Key | 'mod+${Key}';

interface Options {
  enabled?: boolean;
  preventDefault?: boolean;
  target?: HTMLElement | Document;
}

export function useKeyboardShortcut(
  combo: KeyCombo,
  handler: (e: KeyboardEvent) => void,
  options: Options = {}
) {
  const { enabled = true, preventDefault = true, target = document } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Parse combo
      const parts = combo.split('+');
      const key = parts[parts.length - 1].toLowerCase();
      const modifiers = parts.slice(0, -1);

      // Check modifiers
      const hasModifier = (mod: string) => {
        if (mod === 'mod') return e.metaKey || e.ctrlKey; // Cmd on Mac, Ctrl on Windows/Linux
        if (mod === 'ctrl') return e.ctrlKey;
        if (mod === 'meta') return e.metaKey;
        if (mod === 'alt') return e.altKey;
        if (mod === 'shift') return e.shiftKey;
        return false;
      };

      const modifiersMatch = modifiers.every(hasModifier);
      const keyMatches = e.key.toLowerCase() === key;

      if (modifiersMatch && keyMatches) {
        if (preventDefault) e.preventDefault();
        handler(e);
      }
    };

    target.addEventListener('keydown', handleKeyDown as any);
    return () => target.removeEventListener('keydown', handleKeyDown as any);
  }, [combo, handler, enabled, preventDefault, target]);
}

// Keyboard shortcut help dialog
export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useKeyboardShortcut('shift+slash', () => setOpen(true)); // "?"

  const shortcuts = [
    {
      category: 'Global',
      items: [
        { keys: ['Cmd/Ctrl', 'K'], description: 'Open search' },
        { keys: ['Cmd/Ctrl', 'B'], description: 'Toggle sidebar' },
        { keys: ['Cmd/Ctrl', ','], description: 'Open settings' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ],
    },
    {
      category: 'Navigation',
      items: [
        { keys: ['G', 'D'], description: 'Go to Dashboard' },
        { keys: ['G', 'T'], description: 'Go to Topology' },
        { keys: ['G', 'P'], description: 'Go to Pods' },
      ],
    },
    // ... more categories
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Speed up your workflow with keyboard shortcuts</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="font-semibold mb-2">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.description} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.description}</span>
                    <div className="flex gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-2 py-1 rounded bg-muted font-mono text-xs"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 2. Mobile-Specific UI Patterns

### 2.1 Responsive Breakpoints

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    screens: {
      'xs': '320px',   // Mobile S
      'sm': '640px',   // Mobile L
      'md': '768px',   // Tablet
      'lg': '1024px',  // Desktop
      'xl': '1280px',  // Desktop L
      '2xl': '1536px', // Desktop XL
    },
  },
};
```

### 2.2 Touch Gestures

```typescript
// hooks/useGestures.ts
import { useGesture } from '@use-gesture/react';

export function useTopologyGestures(cyRef: React.RefObject<cytoscape.Core>) {
  const bind = useGesture({
    // Pinch to zoom
    onPinch: ({ offset: [scale] }) => {
      if (cyRef.current) {
        cyRef.current.zoom(scale);
      }
    },
    // Two-finger pan
    onDrag: ({ offset: [x, y], touches }) => {
      if (touches === 2 && cyRef.current) {
        cyRef.current.pan({ x, y });
      }
    },
    // Double-tap to zoom
    onDoubleTab: ({ event }) => {
      if (cyRef.current) {
        const point = { x: event.clientX, y: event.clientY };
        cyRef.current.zoom({
          level: cyRef.current.zoom() * 2,
          position: point,
        });
      }
    },
  });

  return bind;
}
```

### 2.3 Mobile Navigation Pattern

```typescript
// components/layout/MobileNavigation.tsx (Enhanced)
export function MobileNavigation() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const mainTabs = [
    { icon: Home, label: 'Home', path: '/', color: 'cyan' },
    { icon: Map, label: 'Topology', path: '/topology', color: 'indigo' },
    { icon: Box, label: 'Resources', path: '/resources', color: 'violet' },
    { icon: Search, label: 'Search', path: '/search', color: 'amber' },
    { icon: Menu, label: 'More', action: () => setDrawerOpen(true), color: 'slate' },
  ];

  return (
    <>
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t md:hidden safe-area-inset-bottom">
        <div className="flex items-center justify-around h-full px-2">
          {mainTabs.map((tab, index) => {
            const isActive = tab.path && location.pathname === tab.path;
            const Icon = tab.icon;

            return (
              <button
                key={index}
                onClick={() => {
                  if (tab.path) {
                    navigate(tab.path);
                  } else if (tab.action) {
                    tab.action();
                  }
                }}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full relative",
                  "transition-colors duration-200",
                  isActive
                    ? `text-${tab.color}-500`
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                {/* Active Indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-${tab.color}-500 rounded-full`}
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}

                <Icon className={cn("h-6 w-6", isActive && "scale-110")} />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Drawer (More Menu) */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>More Options</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-2">
            <MobileMenuItem icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
            <MobileMenuItem icon={Bell} label="Notifications" onClick={() => navigate('/notifications')} />
            <MobileMenuItem icon={User} label="Account" onClick={() => navigate('/account')} />
            <MobileMenuItem icon={HelpCircle} label="Help" onClick={() => navigate('/help')} />
            <MobileMenuItem icon={FileText} label="Documentation" onClick={() => window.open('https://docs.kubilitics.com')} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

### 2.4 Mobile Topology Controls

```typescript
// screens/Topology/MobileTopologyControls.tsx
export function MobileTopologyControls() {
  const [controlsVisible, setControlsVisible] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setControlsVisible(!controlsVisible)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center z-50"
      >
        {controlsVisible ? <X className="h-6 w-6" /> : <Settings className="h-6 w-6" />}
      </button>

      {/* Controls Panel (Slide Up) */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="fixed bottom-16 left-0 right-0 bg-background border-t shadow-lg p-4 z-40 safe-area-inset-bottom"
          >
            <div className="space-y-4">
              {/* Zoom Controls */}
              <div>
                <label className="text-sm font-medium mb-2 block">Zoom</label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => zoomIn()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Slider
                    value={[zoom]}
                    min={10}
                    max={500}
                    step={10}
                    onValueChange={([v]) => setZoom(v)}
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={() => zoomOut()}>
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Layout */}
              <div>
                <label className="text-sm font-medium mb-2 block">Layout</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    variant={layout === 'cola' ? 'default' : 'outline'}
                    onClick={() => setLayout('cola')}
                  >
                    Cola
                  </Button>
                  <Button
                    size="sm"
                    variant={layout === 'dagre' ? 'default' : 'outline'}
                    onClick={() => setLayout('dagre')}
                  >
                    Dagre
                  </Button>
                  <Button
                    size="sm"
                    variant={layout === 'fcose' ? 'default' : 'outline'}
                    onClick={() => setLayout('fcose')}
                  >
                    fCoSE
                  </Button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => fitToScreen()}>
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Fit Screen
                </Button>
                <Button size="sm" variant="outline" onClick={() => exportTopology()}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
```

### 2.5 Mobile List Items (Swipeable)

```typescript
// components/resources/SwipeableListItem.tsx
import { useSwipeable } from 'react-swipeable';

export function SwipeableListItem({ resource, onDelete, onEdit }: SwipeableListItemProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      // Only allow left swipe (reveal actions)
      if (eventData.deltaX < 0) {
        setSwipeOffset(Math.max(eventData.deltaX, -120));
      }
    },
    onSwiped: () => {
      // Snap to position
      if (swipeOffset < -60) {
        setSwipeOffset(-120); // Full reveal
      } else {
        setSwipeOffset(0); // Snap back
      }
    },
    trackMouse: false,
  });

  return (
    <div className="relative overflow-hidden">
      {/* Action Buttons (Behind) */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={onEdit}
          className="w-16 bg-blue-500 text-white flex items-center justify-center"
        >
          <Edit className="h-5 w-5" />
        </button>
        <button
          onClick={onDelete}
          className="w-16 bg-red-500 text-white flex items-center justify-center"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Main Content (Swipeable) */}
      <div
        {...handlers}
        style={{ transform: `translateX(${swipeOffset}px)` }}
        className="bg-background transition-transform duration-200 border-b p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{resource.name}</h3>
            <p className="text-sm text-muted-foreground">{resource.namespace}</p>
          </div>
          <StatusBadge status={resource.status} />
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Accessibility (WCAG 2.1 AA Compliance)

### 3.1 Focus Management

```typescript
// hooks/useFocusTrap.ts
export function useFocusTrap(ref: React.RefObject<HTMLElement>, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || !ref.current) return;

    const focusableElements = ref.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    ref.current.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      ref.current?.removeEventListener('keydown', handleTabKey);
    };
  }, [ref, enabled]);
}
```

### 3.2 ARIA Labels

```typescript
// All interactive elements MUST have ARIA labels
<Button
  aria-label="Open universal search"
  aria-keyshortcuts="Control+K"
  onClick={() => setSearchOpen(true)}
>
  <Search className="h-4 w-4" />
</Button>

// Topology nodes
<div
  role="button"
  tabIndex={0}
  aria-label={`${node.type} ${node.name} in namespace ${node.namespace}, status ${node.status}`}
  aria-pressed={isSelected}
  onClick={handleClick}
  onKeyPress={(e) => e.key === 'Enter' && handleClick()}
>
  {/* Node content */}
</div>

// Status indicators
<span
  role="status"
  aria-label={`Pod status: ${status}`}
  className={statusClass}
>
  {status}
</span>
```

### 3.3 Color Contrast

All color combinations MUST meet WCAG AA contrast ratios:

```typescript
// lib/colors.ts
export const colorContrast = {
  // Text on background
  'text-on-background': 4.5, // Minimum ratio
  'large-text-on-background': 3.0,

  // Status colors (must be distinguishable for color-blind users)
  success: { bg: '#22c55e', text: '#ffffff', ratio: 4.6 },
  warning: { bg: '#f59e0b', text: '#000000', ratio: 5.2 },
  error: { bg: '#f43f5e', text: '#ffffff', ratio: 4.8 },
  info: { bg: '#06b6d4', text: '#ffffff', ratio: 4.5 },
};

// Additional visual indicators beyond color
export function StatusIndicator({ status }: { status: string }) {
  const icons = {
    Running: CheckCircle,
    Failed: XCircle,
    Pending: Clock,
    Unknown: AlertTriangle,
  };

  const Icon = icons[status] || AlertTriangle;

  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-4 w-4" />
      <span>{status}</span>
    </span>
  );
}
```

### 3.4 Screen Reader Support

```typescript
// Announce dynamic updates
export function useLiveRegion(message: string, politeness: 'polite' | 'assertive' = 'polite') {
  useEffect(() => {
    const liveRegion = document.getElementById('live-region');
    if (liveRegion && message) {
      liveRegion.setAttribute('aria-live', politeness);
      liveRegion.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = '';
      }, 1000);
    }
  }, [message, politeness]);
}

// App.tsx must include:
<div
  id="live-region"
  className="sr-only"
  aria-live="polite"
  aria-atomic="true"
/>

// Usage
function PodList() {
  const { data: pods } = usePods();
  useLiveRegion(`Loaded ${pods?.length || 0} pods`);

  // ...
}
```

### 3.5 Keyboard Navigation

All interactive elements MUST be keyboard accessible:

```typescript
// Custom clickable divs must handle keyboard events
export function ClickableCard({ onClick, children }: ClickableCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary rounded-lg"
    >
      {children}
    </div>
  );
}
```

---

## 4. Advanced Features Implementation

### 4.1 Gamification System

```typescript
// services/gamification/achievements.ts
export const ACHIEVEMENTS = [
  {
    id: 'first-steps',
    name: 'First Steps',
    description: 'Complete your first action in Kubilitics',
    icon: Footprints,
    condition: (state: UserState) => state.actionsCount >= 1,
  },
  {
    id: 'topology-explorer',
    name: 'Topology Explorer',
    description: 'View 10 different resource types in topology',
    icon: Map,
    condition: (state: UserState) => state.uniqueResourceTypesViewed >= 10,
  },
  {
    id: 'incident-hero',
    name: 'Incident Hero',
    description: 'Resolve your first critical alert',
    icon: Shield,
    condition: (state: UserState) => state.resolvedIncidents >= 1,
  },
  {
    id: 'multi-cluster-master',
    name: 'Multi-Cluster Master',
    description: 'Connect to 5 different clusters',
    icon: Server,
    condition: (state: UserState) => state.connectedClusters >= 5,
  },
  {
    id: 'plugin-creator',
    name: 'Plugin Creator',
    description: 'Build and share a custom plugin',
    icon: Puzzle,
    condition: (state: UserState) => state.publishedPlugins >= 1,
  },
];

// Achievement notification
export function AchievementUnlocked({ achievement }: { achievement: Achievement }) {
  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-20 right-4 w-80 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg shadow-lg p-4"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <achievement.icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold">Achievement Unlocked!</h3>
          <p className="text-sm font-medium">{achievement.name}</p>
          <p className="text-xs opacity-90">{achievement.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Check achievements on action
export function useAchievementTracker() {
  const { incrementActionsCount, unlockAchievement } = useUserPreferencesStore();

  const trackAction = useCallback(() => {
    incrementActionsCount();

    // Check for newly unlocked achievements
    const userState = getUserState();
    ACHIEVEMENTS.forEach((achievement) => {
      if (achievement.condition(userState) && !userState.achievements.includes(achievement.id)) {
        unlockAchievement(achievement.id);
        toast.custom(() => <AchievementUnlocked achievement={achievement} />, {
          duration: 5000,
        });
      }
    });
  }, []);

  return { trackAction };
}
```

### 4.2 Collaboration Features

```typescript
// services/collaboration/presence.ts
interface Presence {
  userId: string;
  userName: string;
  userAvatar: string;
  cursor: { x: number; y: number };
  currentView: string;
  timestamp: Date;
}

export class CollaborationService {
  private ws: WebSocket | null = null;
  private presences: Map<string, Presence> = new Map();

  connect(sessionId: string) {
    this.ws = new WebSocket(`ws://localhost:8080/api/v1/collaborate/${sessionId}`);

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'presence':
          this.presences.set(message.userId, message.data);
          break;
        case 'cursor':
          this.updateCursor(message.userId, message.position);
          break;
        case 'comment':
          this.addComment(message.data);
          break;
      }
    };
  }

  sendCursorPosition(position: { x: number; y: number }) {
    this.ws?.send(JSON.stringify({
      type: 'cursor',
      position,
    }));
  }

  addComment(resourceId: string, text: string, position: { x: number; y: number }) {
    this.ws?.send(JSON.stringify({
      type: 'comment',
      data: {
        resourceId,
        text,
        position,
        timestamp: new Date(),
      },
    }));
  }
}

// Component: Collaborative Cursors
export function CollaborativeCursors({ presences }: { presences: Presence[] }) {
  return (
    <>
      {presences.map((presence) => (
        <motion.div
          key={presence.userId}
          animate={{ x: presence.cursor.x, y: presence.cursor.y }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed pointer-events-none z-50"
        >
          <Cursor className="h-5 w-5 text-blue-500 drop-shadow" />
          <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">
            {presence.userName}
          </span>
        </motion.div>
      ))}
    </>
  );
}
```

---

## 5. Internationalization (i18n) Implementation

### 5.1 Setup

```typescript
// i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enDashboard from './en/dashboard.json';
import enResources from './en/resources.json';
import zhCommon from './zh-CN/common.json';
// ... more imports

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        dashboard: enDashboard,
        resources: enResources,
      },
      'zh-CN': {
        common: zhCommon,
        // ...
      },
      // ... 20+ languages
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
```

### 5.2 Translation Files

```json
// i18n/en/common.json
{
  "app": {
    "name": "Kubilitics",
    "tagline": "The Kubernetes OS"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "refresh": "Refresh",
    "export": "Export",
    "import": "Import"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "topology": "Topology",
    "resources": "Resources",
    "settings": "Settings"
  },
  "errors": {
    "generic": "An error occurred",
    "network": "Network error. Please check your connection.",
    "unauthorized": "You are not authorized to access this resource.",
    "not_found": "Resource not found."
  }
}
```

```json
// i18n/en/resources.json
{
  "pods": {
    "title": "Pods",
    "title_one": "Pod",
    "title_other": "Pods",
    "description": "View and manage pod workloads",
    "status": {
      "running": "Running",
      "pending": "Pending",
      "failed": "Failed",
      "succeeded": "Succeeded",
      "unknown": "Unknown"
    },
    "actions": {
      "restart": "Restart Pod",
      "delete": "Delete Pod",
      "logs": "View Logs",
      "exec": "Execute Shell"
    },
    "fields": {
      "name": "Name",
      "namespace": "Namespace",
      "node": "Node",
      "age": "Age",
      "restarts": "Restarts",
      "ready": "Ready",
      "qos_class": "QoS Class"
    },
    "qos": {
      "guaranteed": "Guaranteed",
      "burstable": "Burstable",
      "besteffort": "BestEffort"
    }
  }
}
```

### 5.3 Usage in Components

```typescript
import { useTranslation } from 'react-i18next';

export function PodList() {
  const { t } = useTranslation(['resources', 'common']);

  return (
    <div>
      <h1>{t('resources:pods.title')}</h1>
      <p>{t('resources:pods.description')}</p>

      <Button onClick={handleRefresh}>
        {t('common:actions.refresh')}
      </Button>

      {/* Pluralization */}
      <p>{t('resources:pods.title', { count: pods.length })}</p>
      {/* → "1 Pod" or "5 Pods" */}
    </div>
  );
}
```

### 5.4 RTL Support

```typescript
// App.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Set direction based on language
    const dir = ['ar', 'he', 'fa'].includes(i18n.language) ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    // ...
  );
}
```

---

## 6. Error Handling Patterns

### 6.1 Error Boundary

```typescript
// components/common/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Send to error tracking service (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-muted-foreground mb-4 text-center max-w-md">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Reload Application
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 6.2 API Error Handling

```typescript
// services/api/errorHandler.ts
export class APIError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: any): never {
  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case 400:
        throw new APIError(400, 'BAD_REQUEST', 'Invalid request', data);
      case 401:
        throw new APIError(401, 'UNAUTHORIZED', 'Authentication required', data);
      case 403:
        throw new APIError(403, 'FORBIDDEN', 'You do not have permission', data);
      case 404:
        throw new APIError(404, 'NOT_FOUND', 'Resource not found', data);
      case 409:
        throw new APIError(409, 'CONFLICT', 'Resource already exists', data);
      case 500:
        throw new APIError(500, 'SERVER_ERROR', 'Server error', data);
      default:
        throw new APIError(status, 'UNKNOWN', data.message || 'Unknown error', data);
    }
  }

  if (error.request) {
    throw new APIError(0, 'NETWORK_ERROR', 'Network error. Please check your connection.');
  }

  throw new APIError(0, 'UNKNOWN', error.message || 'An unexpected error occurred');
}
```

### 6.3 User-Facing Error Display

```typescript
// components/common/ErrorDisplay.tsx
export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const getErrorContent = (error: APIError) => {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return {
          icon: Lock,
          title: 'Authentication Required',
          description: 'Please connect to a cluster or check your credentials.',
          action: { label: 'Connect Cluster', onClick: () => navigate('/clusters/add') },
        };

      case 'FORBIDDEN':
        return {
          icon: ShieldOff,
          title: 'Access Denied',
          description: error.message,
          action: { label: 'View Permissions', onClick: () => navigate('/settings/rbac') },
        };

      case 'NOT_FOUND':
        return {
          icon: Search,
          title: 'Not Found',
          description: 'The resource you are looking for does not exist.',
          action: { label: 'Go Back', onClick: () => navigate(-1) },
        };

      case 'NETWORK_ERROR':
        return {
          icon: Wifi,
          title: 'Connection Error',
          description: 'Cannot connect to the cluster. Please check your network.',
          action: { label: 'Retry', onClick: onRetry },
        };

      default:
        return {
          icon: AlertTriangle,
          title: 'Error',
          description: error.message || 'An unexpected error occurred.',
          action: { label: 'Retry', onClick: onRetry },
        };
    }
  };

  const content = getErrorContent(error);
  const Icon = content.icon;

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Icon className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">{content.title}</h3>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
          {content.description}
        </p>
        <Button onClick={content.action.onClick}>
          {content.action.label}
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 7. Offline Mode & Caching Strategy

### 7.1 Service Worker (PWA)

```typescript
// public/sw.js
const CACHE_NAME = 'kubilitics-v1';
const urlsToCache = [
  '/',
  '/static/js/main.js',
  '/static/css/main.css',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request).then((fetchResponse) => {
        // Cache successful responses
        if (fetchResponse.ok) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchResponse.clone());
            return fetchResponse;
          });
        }
        return fetchResponse;
      });
    }).catch(() => {
      // Return offline page
      return caches.match('/offline.html');
    })
  );
});
```

### 7.2 IndexedDB Cache

```typescript
// services/cache/indexeddb.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface KubiliticsDB extends DBSchema {
  resources: {
    key: string; // type:namespace:name
    value: {
      type: string;
      namespace: string;
      name: string;
      data: any;
      cachedAt: Date;
    };
  };
  topology: {
    key: string; // clusterId
    value: {
      nodes: any[];
      edges: any[];
      cachedAt: Date;
    };
  };
}

class CacheService {
  private db: IDBPDatabase<KubiliticsDB> | null = null;

  async init() {
    this.db = await openDB<KubiliticsDB>('kubilitics', 1, {
      upgrade(db) {
        db.createObjectStore('resources');
        db.createObjectStore('topology');
      },
    });
  }

  async cacheResource(type: string, namespace: string, name: string, data: any) {
    if (!this.db) await this.init();
    const key = `${type}:${namespace}:${name}`;
    await this.db!.put('resources', {
      type,
      namespace,
      name,
      data,
      cachedAt: new Date(),
    }, key);
  }

  async getCachedResource(type: string, namespace: string, name: string) {
    if (!this.db) await this.init();
    const key = `${type}:${namespace}:${name}`;
    const cached = await this.db!.get('resources', key);

    // Return null if cache is older than 5 minutes
    if (cached && (Date.now() - cached.cachedAt.getTime() > 5 * 60 * 1000)) {
      return null;
    }

    return cached?.data;
  }

  async clearCache() {
    if (!this.db) await this.init();
    await this.db!.clear('resources');
    await this.db!.clear('topology');
  }
}

export const cacheService = new CacheService();
```

### 7.3 Offline Queue

```typescript
// services/offline/queue.ts
interface QueuedAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  resource: {
    type: string;
    namespace: string;
    name: string;
    data?: any;
  };
  timestamp: Date;
}

class OfflineQueue {
  private queue: QueuedAction[] = [];

  addAction(action: Omit<QueuedAction, 'id' | 'timestamp'>) {
    const queuedAction: QueuedAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    this.queue.push(queuedAction);
    this.saveToStorage();

    toast.info('Action queued. Will sync when online.');
  }

  async sync() {
    if (!navigator.onLine) return;

    const actions = [...this.queue];
    this.queue = [];

    for (const action of actions) {
      try {
        await this.executeAction(action);
        toast.success(`Synced: ${action.type} ${action.resource.name}`);
      } catch (error) {
        // Re-queue failed actions
        this.queue.push(action);
        toast.error(`Failed to sync: ${action.resource.name}`);
      }
    }

    this.saveToStorage();
  }

  private async executeAction(action: QueuedAction) {
    const { type, resource } = action;
    const url = `/api/v1/${resource.type}/${resource.namespace}/${resource.name}`;

    switch (type) {
      case 'create':
        return fetch(url, { method: 'POST', body: JSON.stringify(resource.data) });
      case 'update':
        return fetch(url, { method: 'PUT', body: JSON.stringify(resource.data) });
      case 'delete':
        return fetch(url, { method: 'DELETE' });
    }
  }

  private saveToStorage() {
    localStorage.setItem('offline-queue', JSON.stringify(this.queue));
  }

  loadFromStorage() {
    const stored = localStorage.getItem('offline-queue');
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }
}

export const offlineQueue = new OfflineQueue();

// Auto-sync when online
window.addEventListener('online', () => {
  offlineQueue.sync();
});
```

---

## 8. Performance Optimization

### 8.1 Code Splitting

```typescript
// app/routes.tsx
import { lazy, Suspense } from 'react';

// Lazy load screens
const Dashboard = lazy(() => import('@/screens/Dashboard/Dashboard'));
const TopologyView = lazy(() => import('@/screens/Topology/TopologyView'));
const PodList = lazy(() => import('@/screens/Resources/Pods/PodList'));

// Wrap with Suspense
export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <Suspense fallback={<PageLoader />}>
        <Dashboard />
      </Suspense>
    ),
  },
  // ...
]);
```

### 8.2 Virtual Scrolling

```typescript
// components/common/VirtualList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function VirtualList({ items, renderItem, estimateSize = 50 }: VirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {renderItem(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 8.3 Memoization

```typescript
// Heavy computations must be memoized
const topologyGraph = useMemo(() => {
  return buildTopologyGraph(nodes, edges);
}, [nodes, edges]);

// Callbacks passed to children must be memoized
const handleNodeClick = useCallback((node: TopologyNode) => {
  setSelectedNode(node);
  navigate(`/${node.type}/${node.namespace}/${node.name}`);
}, [navigate]);
```

---

## 9. Visual Consistency Rules

### 9.1 Spacing System

```typescript
// All spacing must use 4px base unit
const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',  // Base unit
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
};
```

### 9.2 Typography Scale

```typescript
const typography = {
  xs: '12px',   // Small labels
  sm: '14px',   // Body text
  base: '16px', // Default
  lg: '18px',   // Large body
  xl: '20px',   // Headings H4
  '2xl': '24px', // Headings H3
  '3xl': '30px', // Headings H2
  '4xl': '36px', // Headings H1
  '5xl': '48px', // Display
};
```

### 9.3 Animation Timing

```typescript
const animations = {
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// All transitions MUST use these
<div className="transition-all duration-300 ease-out" />
```

---

## 10. Edge Cases & Forbidden States

### 10.1 Forbidden UI States

**CRITICAL**: These states MUST NEVER occur:

1. **Partial Truth**: Never show incomplete topology graphs
   - If graph cannot be fully constructed, show error + empty state
   - Never render nodes without their relationships

2. **Inconsistent Data**: UI and export must be identical
   - Same topology engine instance
   - Same layout seed
   - Same filter application

3. **Missing Labels**: All edges and nodes must have labels
   - If label missing, show "(Unnamed)"
   - Never render unlabeled elements

4. **Zombie Resources**: Deleted resources must disappear immediately
   - WebSocket updates remove nodes instantly
   - No "ghost" nodes in topology

5. **Conflicting Status**: Resource status must be consistent across views
   - List view, detail view, and topology must show same status
   - Single source of truth from backend

### 10.2 Edge Case Handling

| Scenario | Behavior | Implementation |
|----------|----------|----------------|
| **0 Resources** | Show empty state with "Get Started" action | `<EmptyState action="Create Pod" />` |
| **1000+ Pods** | Virtual scrolling + pagination | Use `react-virtual` |
| **Very Long Names** | Truncate with tooltip on hover | `className="truncate max-w-xs"` |
| **Missing Namespace** | Default to "default" namespace | `namespace ?? 'default'` |
| **Invalid YAML** | Show syntax error with line number | Monaco editor validation |
| **Connection Timeout** | Retry 3x, then show error | `retry: 3` in TanStack Query |
| **WebSocket Disconnect** | Show banner "Reconnecting..." | Auto-reconnect logic |
| **Large Topology (10K nodes)** | Paginate or show warning | `if (nodes.length > 10000) showWarning()` |
| **No QoS Class** | Show "Unknown" | `qosClass ?? 'Unknown'` |
| **Container with No Image** | Show error badge | `image ?? 'No image specified'` |

### 10.3 Loading States

**ALL async operations MUST show loading states**:

```typescript
// Bad
if (data) {
  return <ResourceList data={data} />;
}

// Good
if (isLoading) {
  return <Skeleton />;
}

if (error) {
  return <ErrorDisplay error={error} onRetry={refetch} />;
}

if (!data || data.length === 0) {
  return <EmptyState />;
}

return <ResourceList data={data} />;
```

### 10.4 Error Recovery

```typescript
// All mutations must handle errors gracefully
const deletePod = useMutation({
  mutationFn: async ({ name, namespace }) => {
    return api.delete(`/api/v1/pods/${namespace}/${name}`);
  },
  onSuccess: () => {
    toast.success('Pod deleted successfully');
    queryClient.invalidateQueries(['pods']);
    navigate('/pods');
  },
  onError: (error: APIError) => {
    if (error.code === 'FORBIDDEN') {
      toast.error('You do not have permission to delete this pod');
    } else if (error.code === 'NOT_FOUND') {
      toast.error('Pod not found. It may have already been deleted.');
      queryClient.invalidateQueries(['pods']);
    } else {
      toast.error(`Failed to delete pod: ${error.message}`);
    }
  },
});
```

---

**(End of Frontend Engineering Blueprint Part 3)**

**Summary**: This completes the comprehensive frontend engineering blueprint covering:
- Part 1: Architecture, core screens, state management
- Part 2: Topology, search, resources, real-time updates
- Part 3: Advanced features, mobile, accessibility, edge cases

**Next**: Backend Engineering Blueprint (Go implementation)
