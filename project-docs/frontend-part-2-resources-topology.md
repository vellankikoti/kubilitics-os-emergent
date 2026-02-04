# Kubilitics Frontend Engineering Blueprint
## Part 2: Resource Screens & Topology Interactions

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Prerequisite**: Read Part 1 first

---

## Table of Contents

1. [Topology View - Complete Specification](#1-topology-view-complete-specification)
2. [Universal Search - Cmd+K Experience](#2-universal-search-cmdk-experience)
3. [Resource List View Pattern](#3-resource-list-view-pattern)
4. [Resource Detail View Pattern](#4-resource-detail-view-pattern)
5. [Pod Detail Screen (Complete Example)](#5-pod-detail-screen-complete-example)
6. [Interactive UI Elements](#6-interactive-ui-elements)
7. [Real-Time Updates & WebSocket Integration](#7-real-time-updates--websocket-integration)

---

## 1. Topology View - Complete Specification

### 1.1 Canvas Component

**File**: `screens/Topology/TopologyCanvas.tsx`

```typescript
interface TopologyCanvasProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  filters?: TopologyFilters;
  layout?: 'cola' | 'dagre' | 'fcose';
  interactive?: boolean;
  minimap?: boolean;
  onNodeClick?: (node: TopologyNode) => void;
  onNodeHover?: (node: TopologyNode | null) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
}

export function TopologyCanvas({
  nodes,
  edges,
  layout = 'cola',
  interactive = true,
  minimap = true,
  onNodeClick,
  onNodeHover,
  onSelectionChange,
}: TopologyCanvasProps) {
  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { zoom, setZoom, pan, setPan, selectedNodes, setSelectedNodes } = useTopologyStore();

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements: {
        nodes: nodes.map(n => ({
          data: { id: n.id, ...n },
          classes: [n.status.toLowerCase(), n.type.toLowerCase()],
        })),
        edges: edges.map(e => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label,
          },
          classes: [e.type],
        })),
      },
      style: cytoscapeStyles, // Defined below
      layout: getLayoutConfig(layout),
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2,
    });

    // Event handlers
    if (interactive) {
      cyRef.current.on('tap', 'node', (evt) => {
        const node = evt.target.data() as TopologyNode;
        onNodeClick?.(node);
        setSelectedNodes([node.id]);
      });

      cyRef.current.on('mouseover', 'node', (evt) => {
        const node = evt.target.data() as TopologyNode;
        onNodeHover?.(node);
        highlightConnected(cyRef.current!, node.id);
      });

      cyRef.current.on('mouseout', 'node', () => {
        onNodeHover?.(null);
        clearHighlights(cyRef.current!);
      });

      // Box selection for multi-select
      cyRef.current.on('boxselect', 'node', (evt) => {
        const selectedIds = cyRef.current!.nodes(':selected').map(n => n.id());
        setSelectedNodes(selectedIds);
        onSelectionChange?.(selectedIds);
      });
    }

    return () => {
      cyRef.current?.destroy();
    };
  }, [nodes, edges, layout]);

  // Sync zoom/pan with store
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.zoom(zoom);
      cyRef.current.pan(pan);
    }
  }, [zoom, pan]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full bg-background" />
      {minimap && <TopologyMinimap cy={cyRef.current} />}
    </div>
  );
}
```

### 1.2 Cytoscape Styling

```typescript
// styles/cytoscapeStyles.ts
export const cytoscapeStyles: cytoscape.Stylesheet[] = [
  // Nodes - Base
  {
    selector: 'node',
    style: {
      'width': 40,
      'height': 40,
      'label': 'data(name)',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 5,
      'font-size': 12,
      'font-family': 'Inter, sans-serif',
      'background-color': '#06b6d4', // cyan-500
      'border-width': 2,
      'border-color': '#0891b2', // cyan-600
      'transition-property': 'background-color, border-color, width, height',
      'transition-duration': 300,
    },
  },
  // Pods
  {
    selector: 'node.pod',
    style: {
      'shape': 'ellipse',
    },
  },
  {
    selector: 'node.pod.running',
    style: {
      'background-color': '#22c55e', // green-500
      'border-color': '#16a34a', // green-600
    },
  },
  {
    selector: 'node.pod.pending',
    style: {
      'background-color': '#f59e0b', // amber-500
      'border-color': '#d97706', // amber-600
    },
  },
  {
    selector: 'node.pod.failed',
    style: {
      'background-color': '#f43f5e', // rose-500
      'border-color': '#e11d48', // rose-600
    },
  },
  // Deployments
  {
    selector: 'node.deployment',
    style: {
      'shape': 'roundrectangle',
      'width': 60,
      'height': 40,
    },
  },
  // Services
  {
    selector: 'node.service',
    style: {
      'shape': 'diamond',
      'width': 50,
      'height': 50,
    },
  },
  // ConfigMaps/Secrets
  {
    selector: 'node.configmap, node.secret',
    style: {
      'shape': 'rectangle',
      'width': 35,
      'height': 45,
    },
  },
  // Nodes (K8s)
  {
    selector: 'node.node',
    style: {
      'shape': 'rectangle',
      'width': 80,
      'height': 60,
      'background-color': '#6366f1', // indigo-500
    },
  },
  // Edges - Base
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#64748b', // slate-500
      'target-arrow-color': '#64748b',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': 10,
      'text-rotation': 'autorotate',
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.8,
      'text-background-padding': 2,
    },
  },
  // Edge types
  {
    selector: 'edge.owner',
    style: {
      'line-style': 'solid',
      'line-color': '#0891b2', // cyan-600
    },
  },
  {
    selector: 'edge.selector',
    style: {
      'line-style': 'dashed',
      'line-color': '#6366f1', // indigo-500
    },
  },
  {
    selector: 'edge.volume',
    style: {
      'line-style': 'dotted',
      'line-color': '#8b5cf6', // violet-500
    },
  },
  // Hover & Selection
  {
    selector: 'node:selected',
    style: {
      'border-width': 4,
      'border-color': '#0891b2', // cyan-600
      'overlay-color': '#06b6d4',
      'overlay-opacity': 0.2,
    },
  },
  {
    selector: 'node.highlighted',
    style: {
      'width': 50,
      'height': 50,
      'border-width': 3,
      'z-index': 999,
    },
  },
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.3,
    },
  },
  {
    selector: 'edge.highlighted',
    style: {
      'width': 4,
      'line-color': '#f43f5e', // rose-500
      'target-arrow-color': '#f43f5e',
      'z-index': 999,
    },
  },
];
```

### 1.3 Layout Algorithms

```typescript
// services/topology/layoutEngine.ts
export function getLayoutConfig(algorithm: 'cola' | 'dagre' | 'fcose'): cytoscape.LayoutOptions {
  switch (algorithm) {
    case 'cola':
      return {
        name: 'cola',
        animate: true,
        animationDuration: 500,
        animationEasing: 'ease-out',
        refresh: 1,
        fit: true,
        padding: 30,
        nodeDimensionsIncludeLabels: true,
        randomize: false,
        avoidOverlap: true,
        handleDisconnected: true,
        convergenceThreshold: 0.01,
        nodeSpacing: 50,
        flow: undefined,
        alignment: undefined,
        gapInequalities: undefined,
        edgeLength: 100,
      };

    case 'dagre':
      return {
        name: 'dagre',
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 30,
        nodeDimensionsIncludeLabels: true,
        rankDir: 'TB', // Top to Bottom
        ranker: 'network-simplex',
        rankSep: 75,
        nodeSep: 50,
        edgeSep: 10,
      };

    case 'fcose':
      return {
        name: 'fcose',
        animate: true,
        animationDuration: 500,
        fit: true,
        padding: 30,
        nodeDimensionsIncludeLabels: true,
        randomize: false,
        nodeRepulsion: 4500,
        idealEdgeLength: 100,
        edgeElasticity: 0.45,
        nestingFactor: 0.1,
        gravity: 0.25,
        numIter: 2500,
        tile: true,
        tilingPaddingVertical: 10,
        tilingPaddingHorizontal: 10,
        gravityRangeCompound: 1.5,
        gravityCompound: 1.0,
        gravityRange: 3.8,
      };
  }
}
```

### 1.4 Topology Controls

**File**: `screens/Topology/TopologyControls.tsx`

```typescript
export function TopologyControls() {
  const {
    filters,
    setFilters,
    layoutAlgorithm,
    setLayoutAlgorithm,
    visibleLayers,
    toggleLayer,
    timeMachineEnabled,
    setTimeMachineEnabled,
  } = useTopologyStore();

  return (
    <div className="flex items-center gap-2 p-4 border-b">
      {/* Namespace Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="mr-2 h-4 w-4" />
            Namespaces {filters.namespaces.length > 0 && `(${filters.namespaces.length})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <NamespaceMultiSelect
            selected={filters.namespaces}
            onChange={(namespaces) => setFilters({ namespaces })}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Resource Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Layers className="mr-2 h-4 w-4" />
            Types {filters.resourceTypes.length > 0 && `(${filters.resourceTypes.length})`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <ResourceTypeMultiSelect
            selected={filters.resourceTypes}
            onChange={(types) => setFilters({ resourceTypes: types })}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Layer Toggle (X-Ray Vision) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="mr-2 h-4 w-4" />
            Layers
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem
            checked={visibleLayers.compute}
            onCheckedChange={() => toggleLayer('compute')}
          >
            Compute
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibleLayers.network}
            onCheckedChange={() => toggleLayer('network')}
          >
            Network
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibleLayers.storage}
            onCheckedChange={() => toggleLayer('storage')}
          >
            Storage
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibleLayers.security}
            onCheckedChange={() => toggleLayer('security')}
          >
            Security
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={visibleLayers.configuration}
            onCheckedChange={() => toggleLayer('configuration')}
          >
            Configuration
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Layout Algorithm */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <GitGraph className="mr-2 h-4 w-4" />
            Layout: {layoutAlgorithm.toUpperCase()}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={layoutAlgorithm} onValueChange={(v) => setLayoutAlgorithm(v as any)}>
            <DropdownMenuRadioItem value="cola">
              Cola (Force-Directed)
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dagre">
              Dagre (Hierarchical)
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="fcose">
              fCoSE (Compound)
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Time Machine */}
      <Button
        variant={timeMachineEnabled ? 'default' : 'outline'}
        size="sm"
        onClick={() => setTimeMachineEnabled(!timeMachineEnabled)}
      >
        <Clock className="mr-2 h-4 w-4" />
        Time Machine
      </Button>

      {/* Export */}
      <Button variant="outline" size="sm" onClick={() => exportTopology()}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>

      {/* Fullscreen */}
      <Button variant="ghost" size="icon" onClick={() => toggleFullscreen()}>
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### 1.5 Topology Interactions - Complete Specification

| Interaction | Trigger | Visual Feedback | Backend Call | Result |
|-------------|---------|-----------------|--------------|--------|
| **Hover Node** | Mouse over node | • Node scales 1.1x<br>• Border glows<br>• Show tooltip with details<br>• Highlight connected edges/nodes<br>• Dim unrelated nodes (30% opacity) | None | Blast radius visualization |
| **Click Node** | Click on node | • Node selected (thick border)<br>• Detail panel slides in from right<br>• Ripple animation from node | GET `/api/v1/resources/{type}/{namespace}/{name}` | Show resource details in side panel |
| **Double-Click Node** | Double-click | • If compound node: expand/collapse children<br>• Smooth animation | None | Expand/collapse resource groups |
| **Right-Click Node** | Right-click | Context menu appears at cursor | None | Show context menu with actions |
| **Drag Node** | Click + drag | • Node follows cursor<br>• Connected edges stretch<br>• Layout locked temporarily | None | Manual positioning (unlocks layout) |
| **Pan Canvas** | Click empty + drag<br>OR Middle mouse | Canvas pans, minimap updates | None | Navigate canvas |
| **Zoom** | Mouse wheel<br>OR Pinch (mobile) | Smooth zoom animation<br>Zoom level displayed | None | Zoom in/out (10%-500%) |
| **Box Select** | Shift + drag | Selection box drawn<br>All enclosed nodes selected | None | Multi-select nodes |
| **Multi-Select Add** | Cmd/Ctrl + click | Add node to selection | None | Add to selected nodes |
| **Deselect** | Click empty space | Clear selection<br>Close detail panel | None | Clear selection |
| **Space Key** | Hold Space | • Pause real-time updates<br>• Show "PAUSED" indicator | Stop WebSocket updates | Freeze frame for analysis |

### 1.6 Context Menu Actions

```typescript
// components/topology/NodeContextMenu.tsx
interface NodeContextMenuProps {
  node: TopologyNode;
  position: { x: number; y: number };
  onClose: () => void;
}

export function NodeContextMenu({ node, position, onClose }: NodeContextMenuProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'View Details',
      icon: Info,
      onClick: () => {
        navigate(`/${node.type.toLowerCase()}s/${node.namespace}/${node.name}`);
        onClose();
      },
    },
    {
      label: 'View Logs',
      icon: FileText,
      onClick: () => {
        navigate(`/${node.type.toLowerCase()}s/${node.namespace}/${node.name}?tab=logs`);
        onClose();
      },
      condition: node.type === 'Pod',
    },
    {
      label: 'Exec Shell',
      icon: Terminal,
      onClick: () => {
        navigate(`/${node.type.toLowerCase()}s/${node.namespace}/${node.name}?tab=terminal`);
        onClose();
      },
      condition: node.type === 'Pod',
    },
    {
      label: 'Edit YAML',
      icon: FileEdit,
      onClick: () => {
        navigate(`/${node.type.toLowerCase()}s/${node.namespace}/${node.name}?tab=yaml`);
        onClose();
      },
    },
    {
      label: 'Scale',
      icon: ChevronsUpDown,
      onClick: () => {
        openScaleDialog(node);
        onClose();
      },
      condition: ['Deployment', 'StatefulSet', 'ReplicaSet'].includes(node.type),
    },
    {
      type: 'separator',
    },
    {
      label: 'Copy Name',
      icon: Copy,
      onClick: () => {
        navigator.clipboard.writeText(node.name);
        toast.success('Name copied');
        onClose();
      },
    },
    {
      label: 'Copy YAML',
      icon: Copy,
      onClick: async () => {
        const yaml = await fetchResourceYaml(node.type, node.namespace, node.name);
        navigator.clipboard.writeText(yaml);
        toast.success('YAML copied');
        onClose();
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      onClick: () => {
        openDeleteDialog(node);
        onClose();
      },
    },
  ].filter(action => !action.condition || action.condition);

  return (
    <DropdownMenu open onOpenChange={onClose}>
      <DropdownMenuContent
        style={{ position: 'fixed', left: position.x, top: position.y }}
      >
        {actions.map((action, index) =>
          action.type === 'separator' ? (
            <DropdownMenuSeparator key={index} />
          ) : (
            <DropdownMenuItem
              key={action.label}
              onClick={action.onClick}
              className={cn(action.variant === 'destructive' && 'text-destructive')}
            >
              <action.icon className="mr-2 h-4 w-4" />
              {action.label}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 1.7 Blast Radius Visualization

```typescript
// services/topology/blastRadius.ts
export function highlightConnected(cy: cytoscape.Core, nodeId: string) {
  const node = cy.getElementById(nodeId);

  // Get all connected nodes (upstream + downstream)
  const upstream = node.predecessors('node');
  const downstream = node.successors('node');
  const connectedEdges = node.connectedEdges();

  // Dim all nodes first
  cy.nodes().addClass('dimmed');

  // Highlight connected
  node.removeClass('dimmed').addClass('highlighted');
  upstream.removeClass('dimmed').addClass('highlighted');
  downstream.removeClass('dimmed').addClass('highlighted');
  connectedEdges.addClass('highlighted');

  // If node is in error state, highlight impact path
  if (node.data('status') === 'Failed' || node.data('status') === 'Error') {
    downstream.addClass('blast-radius-affected');
    connectedEdges.filter((edge) => {
      return downstream.contains(edge.target());
    }).addClass('blast-radius-path');
  }
}

export function clearHighlights(cy: cytoscape.Core) {
  cy.nodes().removeClass('dimmed highlighted blast-radius-affected');
  cy.edges().removeClass('highlighted blast-radius-path');
}
```

### 1.8 Time Machine Feature

```typescript
// screens/Topology/TimeMachine.tsx
export function TimeMachine() {
  const { timeMachineEnabled, selectedTimestamp, setSelectedTimestamp } = useTopologyStore();
  const [playback, setPlayback] = useState<'paused' | 'playing'>('paused');
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);

  const { data: timeline } = useTopologyTimeline();

  if (!timeMachineEnabled) return null;

  return (
    <Card className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[600px] shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Playback Controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPlayback(playback === 'paused' ? 'playing' : 'paused')}
          >
            {playback === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>

          {/* Speed Control */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {playbackSpeed}x
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuRadioGroup value={String(playbackSpeed)} onValueChange={(v) => setPlaybackSpeed(Number(v) as any)}>
                <DropdownMenuRadioItem value="1">1x</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="2">2x</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="4">4x</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Timeline Scrubber */}
          <div className="flex-1">
            <Slider
              value={[selectedTimestamp ? timeline?.indexOf(selectedTimestamp) || 0 : 0]}
              max={timeline?.length || 100}
              step={1}
              onValueChange={([index]) => {
                const timestamp = timeline?.[index];
                if (timestamp) setSelectedTimestamp(timestamp);
              }}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{timeline?.[0] && formatDate(timeline[0])}</span>
              <span>{selectedTimestamp && formatDate(selectedTimestamp)}</span>
              <span>{timeline?.[timeline.length - 1] && formatDate(timeline[timeline.length - 1])}</span>
            </div>
          </div>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setTimeMachineEnabled(false);
              setSelectedTimestamp(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 1.9 Export Topology

```typescript
// services/topology/export.ts
export async function exportTopology(format: 'png' | 'pdf' | 'svg') {
  const cy = getCytoscapeInstance(); // Get current cytoscape instance

  switch (format) {
    case 'png':
      const png = cy.png({
        output: 'blob',
        bg: 'white',
        full: true,
        scale: 2, // 2x for retina
      });
      download(png, 'topology.png');
      break;

    case 'svg':
      const svg = cy.svg({ full: true });
      download(new Blob([svg], { type: 'image/svg+xml' }), 'topology.svg');
      break;

    case 'pdf':
      // Send to backend for PDF generation (WYSIWYG guarantee)
      const response = await fetch('/api/v1/topology/export/pdf', {
        method: 'POST',
        body: JSON.stringify({
          nodes: cy.nodes().jsons(),
          edges: cy.edges().jsons(),
          viewport: {
            zoom: cy.zoom(),
            pan: cy.pan(),
          },
        }),
      });
      const pdfBlob = await response.blob();
      download(pdfBlob, 'topology.pdf');
      break;
  }
}
```

---

## 2. Universal Search - Cmd+K Experience

### 2.1 Search Component

**File**: `screens/Search/UniversalSearch.tsx`

```typescript
export function UniversalSearch() {
  const { searchOpen, setSearchOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const { data: searchData, isLoading } = useSearch(query, { enabled: query.length > 0 });

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useKeyboardShortcut('mod+k', () => setSearchOpen(true));

  // ESC to close
  useKeyboardShortcut('escape', () => setSearchOpen(false), { enabled: searchOpen });

  useEffect(() => {
    if (searchData) {
      setResults(searchData.results);
    }
  }, [searchData]);

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-w-2xl p-0">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search resources, actions, or ask a question..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0"
            autoFocus
          />
          {query && (
            <Button variant="ghost" size="icon" onClick={() => setQuery('')}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Searching...</p>
            </div>
          ) : results.length === 0 && query ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium">No results found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try searching for a pod, deployment, or service name
              </p>
            </div>
          ) : (
            <SearchResults results={results} onSelect={() => setSearchOpen(false)} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span>Powered by Kubilitics AI</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 2.2 Search Results

```typescript
// screens/Search/SearchResults.tsx
interface SearchResult {
  type: 'resource' | 'action' | 'ai';
  category: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href?: string;
  action?: () => void;
  metadata?: Record<string, any>;
}

export function SearchResults({ results, onSelect }: SearchResultsProps) {
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard navigation
  useKeyboardShortcut('arrowdown', () => {
    setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
  });

  useKeyboardShortcut('arrowup', () => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  });

  useKeyboardShortcut('enter', () => {
    const result = results[selectedIndex];
    handleSelect(result);
  });

  const handleSelect = (result: SearchResult) => {
    if (result.href) {
      navigate(result.href);
    } else if (result.action) {
      result.action();
    }
    onSelect();
  };

  // Group results by category
  const grouped = results.reduce((acc, result) => {
    if (!acc[result.category]) acc[result.category] = [];
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="py-2">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="mb-4 last:mb-0">
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {category}
            </h3>
          </div>
          {items.map((result, index) => {
            const globalIndex = results.indexOf(result);
            const isSelected = globalIndex === selectedIndex;

            return (
              <button
                key={globalIndex}
                onClick={() => handleSelect(result)}
                className={cn(
                  "flex items-start gap-3 w-full px-4 py-3 hover:bg-muted/50 transition-colors text-left",
                  isSelected && "bg-muted"
                )}
              >
                <result.icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{result.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                  {result.metadata && (
                    <div className="flex gap-2 mt-1">
                      {Object.entries(result.metadata).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-[10px]">
                          {key}: {String(value)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {result.type === 'action' && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

### 2.3 Search API Hook

```typescript
// hooks/useSearch.ts
export function useSearch(query: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      // Search across multiple categories in parallel
      const [resources, actions, ai] = await Promise.all([
        searchResources(query),
        searchActions(query),
        searchAI(query),
      ]);

      return {
        results: [
          ...resources.map(r => ({
            type: 'resource' as const,
            category: 'Resources',
            title: r.name,
            description: `${r.kind} in ${r.namespace}`,
            icon: getResourceIcon(r.kind),
            href: `/${r.kind.toLowerCase()}s/${r.namespace}/${r.name}`,
            metadata: {
              status: r.status,
              age: r.age,
            },
          })),
          ...actions.map(a => ({
            type: 'action' as const,
            category: 'Actions',
            title: a.title,
            description: a.description,
            icon: a.icon,
            action: a.handler,
          })),
          ...ai.map(suggestion => ({
            type: 'ai' as const,
            category: 'AI Suggestions',
            title: suggestion.title,
            description: suggestion.explanation,
            icon: Sparkles,
            action: suggestion.action,
          })),
        ],
      };
    },
    enabled: options?.enabled !== false && query.length > 0,
    staleTime: 5000,
  });
}

async function searchResources(query: string) {
  const response = await fetch(`/api/v1/search/resources?q=${encodeURIComponent(query)}`);
  return response.json();
}

async function searchActions(query: string) {
  // Local search through predefined actions
  const allActions = [
    { title: 'Scale deployment', description: 'Increase or decrease replicas', icon: ChevronsUpDown, handler: () => {} },
    { title: 'View logs', description: 'Stream pod logs', icon: FileText, handler: () => {} },
    { title: 'Restart pod', description: 'Delete and recreate pod', icon: RotateCcw, handler: () => {} },
    // ... more actions
  ];

  return allActions.filter(a =>
    a.title.toLowerCase().includes(query.toLowerCase()) ||
    a.description.toLowerCase().includes(query.toLowerCase())
  );
}

async function searchAI(query: string) {
  // Call AI endpoint (paid feature)
  const response = await fetch('/api/v1/ai/search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return response.json();
}
```

---

## 3. Resource List View Pattern

### 3.1 Universal List Component

**File**: `components/resources/ResourceList.tsx`

```typescript
interface ResourceListProps<T> {
  resourceType: string; // 'pods', 'deployments', etc.
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  error?: Error | null;
  onRowClick?: (resource: T) => void;
  actions?: Array<{
    label: string;
    icon: LucideIcon;
    onClick: (resource: T) => void;
    variant?: 'default' | 'destructive';
  }>;
  bulkActions?: Array<{
    label: string;
    icon: LucideIcon;
    onClick: (resources: T[]) => void;
  }>;
}

export function ResourceList<T extends { metadata: { name: string; namespace?: string } }>({
  resourceType,
  columns,
  data,
  isLoading,
  error,
  onRowClick,
  actions,
  bulkActions,
}: ResourceListProps<T>) {
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [filters, setFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters: filters,
      rowSelection: Object.fromEntries(Array.from(selectedRows).map(id => [id, true])),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading {resourceType}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{resourceType}</CardTitle>
            <CardDescription>{data.length} items</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.size > 0 && bulkActions && (
              <>
                <span className="text-sm text-muted-foreground">
                  {selectedRows.size} selected
                </span>
                {bulkActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const resources = Array.from(selectedRows)
                        .map(id => data.find(r => r.metadata.name === id))
                        .filter(Boolean) as T[];
                      action.onClick(resources);
                    }}
                  >
                    <action.icon className="mr-2 h-4 w-4" />
                    {action.label}
                  </Button>
                ))}
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => {/* refresh */}}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedRows.size === data.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedRows(new Set(data.map(r => r.metadata.name)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                  />
                </TableHead>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-4 w-4" />
                        )}
                      </div>
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className="cursor-pointer hover:bg-muted/50"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedRows.has(row.original.metadata.name)}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedRows);
                      if (checked) {
                        newSelected.add(row.original.metadata.name);
                      } else {
                        newSelected.delete(row.original.metadata.name);
                      }
                      setSelectedRows(newSelected);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {actions?.map((action) => (
                        <DropdownMenuItem
                          key={action.label}
                          onClick={(e) => {
                            e.stopPropagation();
                            action.onClick(row.original);
                          }}
                          className={cn(action.variant === 'destructive' && 'text-destructive')}
                        >
                          <action.icon className="mr-2 h-4 w-4" />
                          {action.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

### 3.2 Pod List Example

**File**: `screens/Resources/Pods/PodList.tsx`

```typescript
export function PodList() {
  const navigate = useNavigate();
  const { data: pods, isLoading, error } = usePods();

  const columns: ColumnDef<PodResource>[] = [
    {
      accessorKey: 'metadata.name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono">{row.original.metadata?.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'metadata.namespace',
      header: 'Namespace',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.metadata?.namespace || 'default'}</Badge>
      ),
    },
    {
      accessorKey: 'status.phase',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status?.phase || 'Unknown';
        return <StatusBadge status={status} />;
      },
    },
    {
      id: 'containers',
      header: 'Containers',
      cell: ({ row }) => {
        const ready = row.original.status?.containerStatuses?.filter(c => c.ready).length || 0;
        const total = row.original.status?.containerStatuses?.length || 0;
        return <span>{ready}/{total}</span>;
      },
    },
    {
      id: 'restarts',
      header: 'Restarts',
      cell: ({ row }) => {
        const restarts = row.original.status?.containerStatuses?.reduce((sum, c) => sum + c.restartCount, 0) || 0;
        return restarts > 0 ? (
          <Badge variant="warning">{restarts}</Badge>
        ) : (
          <span className="text-muted-foreground">0</span>
        );
      },
    },
    {
      accessorKey: 'spec.nodeName',
      header: 'Node',
      cell: ({ row }) => (
        <span className="font-mono text-sm">{row.original.spec?.nodeName || '—'}</span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      cell: ({ row }) => {
        const createdAt = row.original.metadata?.creationTimestamp;
        return createdAt ? formatAge(new Date(createdAt)) : '—';
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pods</h1>
          <p className="text-muted-foreground">View and manage pod workloads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {/* open YAML import */}}>
            <Upload className="mr-2 h-4 w-4" />
            Import YAML
          </Button>
        </div>
      </div>

      <ResourceList
        resourceType="Pods"
        columns={columns}
        data={pods || []}
        isLoading={isLoading}
        error={error}
        onRowClick={(pod) => navigate(`/pods/${pod.metadata?.namespace}/${pod.metadata?.name}`)}
        actions={[
          {
            label: 'View Logs',
            icon: FileText,
            onClick: (pod) => navigate(`/pods/${pod.metadata?.namespace}/${pod.metadata?.name}?tab=logs`),
          },
          {
            label: 'Exec Shell',
            icon: Terminal,
            onClick: (pod) => navigate(`/pods/${pod.metadata?.namespace}/${pod.metadata?.name}?tab=terminal`),
          },
          {
            label: 'Delete',
            icon: Trash2,
            onClick: (pod) => {/* open delete dialog */},
            variant: 'destructive',
          },
        ]}
        bulkActions={[
          {
            label: 'Delete Selected',
            icon: Trash2,
            onClick: (pods) => {/* bulk delete */},
          },
        ]}
      />
    </div>
  );
}
```

---

## 4. Resource Detail View Pattern

### 4.1 Universal Detail Layout

Every resource detail screen follows this exact structure:

```
┌─────────────────────────────────────────────────────────────┐
│  [Breadcrumbs: Home > Pods > default > nginx-abc123]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Resource Header                                    │   │
│  │  [Icon] Pod: nginx-abc123 [●Running] [🔄][🗑]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────┬──────┬──────┬──────┐                            │
│  │ Ready│ Rest │ Age  │ QoS  │  Status Cards              │
│  │ 2/2  │   0  │ 5h   │ Guar │                            │
│  └──────┴──────┴──────┴──────┘                            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Tabs                                               │   │
│  │  [Overview] [Containers] [Logs] [Terminal] [Events]│   │
│  │  [Metrics] [YAML] [Compare] [Topology] [Actions]   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │  Tab Content (Scrollable)                          │   │
│  │                                                     │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Universal Tabs

Every resource detail page MUST have these tabs (in order):

1. **Overview**: General information, status, conditions, labels, annotations
2. **[Resource-Specific]**: e.g., Containers (Pods), Replicas (Deployments), Rules (Ingress)
3. **Events**: Kubernetes events related to this resource
4. **Metrics**: CPU, Memory, Network usage (if applicable)
5. **YAML**: Editable YAML view with syntax highlighting
6. **Compare**: Historical versions comparison
7. **Topology**: Relationship graph focused on this resource
8. **Actions**: Quick actions panel

---

## 5. Pod Detail Screen (Complete Example)

### 5.1 Implementation Reference

See the provided `PodDetail.tsx` file as the complete reference implementation. Key points:

#### 5.1.1 Data Fetching

```typescript
const { resource: podResource, isLoading, error, age, yaml, isConnected, refetch } = useResourceDetail<PodResource>(
  'pods',
  name,
  namespace
);

const { events, isLoading: eventsLoading } = useK8sEvents(namespace, {
  involvedObjectName: name,
  involvedObjectKind: 'Pod',
  involvedObjectNamespace: namespace,
  refetchInterval: 10000, // Real-time updates every 10s
});

const { nodes: topologyNodes, edges: topologyEdges } = usePodTopology(name, namespace);

const { data: podMetrics } = usePodMetrics(namespace, name);
```

#### 5.1.2 Container Section

**CRITICAL**: The container section must show:

- Container name, image, image ID
- Ready status, restart count
- Current state (running/waiting/terminated) with reason
- Ports with "Forward" button
- Resource requests & limits with usage bars (CPU, Memory)
- Environment variables (with valueFrom expansion)
- Volume mounts with source (ConfigMap/Secret/PVC)
- Liveness/Readiness probes
- Last state (if terminated before)

**Interactions**:
- **Shell Button**: Opens Terminal tab with this container selected
- **Logs Button**: Opens Logs tab with this container selected
- **Forward Button**: Opens Port Forward dialog

#### 5.1.3 Logs Viewer

**File**: `components/resources/LogViewer.tsx`

```typescript
export function LogViewer({
  podName,
  namespace,
  containerName,
  containers,
  onContainerChange,
}: LogViewerProps) {
  const [follow, setFollow] = useState(true);
  const [timestamps, setTimestamps] = useState(false);
  const [tailLines, setTailLines] = useState(100);
  const [filter, setFilter] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const { data: logs, isLoading } = usePodLogs({
    podName,
    namespace,
    containerName,
    follow,
    timestamps,
    tailLines,
  });

  // Auto-scroll to bottom when following
  useEffect(() => {
    if (follow && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, follow]);

  const filteredLogs = useMemo(() => {
    if (!logs || !filter) return logs;
    return logs.split('\n').filter(line => line.toLowerCase().includes(filter.toLowerCase())).join('\n');
  }, [logs, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Logs</CardTitle>
          <div className="flex items-center gap-2">
            {/* Container Selector */}
            {containers.length > 1 && (
              <Select value={containerName} onValueChange={onContainerChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {containers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filter */}
            <Input
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-[200px]"
            />

            {/* Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFollow(!follow)}
            >
              {follow ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTimestamps(!timestamps)}
            >
              <Clock className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {/* download logs */}}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={logContainerRef}
          className="h-[500px] overflow-auto bg-black text-green-400 font-mono text-sm p-4 rounded-lg"
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{filteredLogs}</pre>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 5.1.4 Terminal Viewer

**File**: `components/resources/TerminalViewer.tsx`

```typescript
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export function TerminalViewer({
  podName,
  namespace,
  containerName,
  containers,
  onContainerChange,
}: TerminalViewerProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm.js
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      theme: {
        background: '#0a0a0a',
        foreground: '#f5f5f5',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    fitAddon.fit();

    termRef.current = terminal;

    // Connect WebSocket
    const ws = new WebSocket(
      `ws://localhost:8080/api/v1/pods/${namespace}/${podName}/${containerName}/exec?command=/bin/sh`
    );

    ws.onopen = () => {
      terminal.writeln('Connected to pod...');
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
    };

    ws.onerror = () => {
      terminal.writeln('\r\n\x1b[31mConnection error\x1b[0m');
    };

    ws.onclose = () => {
      terminal.writeln('\r\n\x1b[33mConnection closed\x1b[0m');
    };

    terminal.onData((data) => {
      ws.send(data);
    });

    wsRef.current = ws;

    return () => {
      terminal.dispose();
      ws.close();
    };
  }, [podName, namespace, containerName]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Terminal</CardTitle>
          <div className="flex items-center gap-2">
            {containers.length > 1 && (
              <Select value={containerName} onValueChange={onContainerChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {containers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => wsRef.current?.send('\x03')} // Ctrl+C
            >
              <Square className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={terminalRef} className="h-[500px] rounded-lg" />
      </CardContent>
    </Card>
  );
}
```

---

## 6. Interactive UI Elements

### 6.1 Status Badge

```typescript
export function StatusBadge({ status }: { status: string }) {
  const variants = {
    Running: 'success',
    Succeeded: 'success',
    Pending: 'warning',
    Failed: 'destructive',
    Unknown: 'secondary',
  };

  return (
    <Badge variant={variants[status] || 'secondary'}>
      {status}
    </Badge>
  );
}
```

### 6.2 Resource Metric Bar

```typescript
export function MetricBar({ label, current, limit, unit = '%' }: MetricBarProps) {
  const percentage = limit > 0 ? (current / limit) * 100 : 0;
  const color = percentage > 90 ? 'destructive' : percentage > 70 ? 'warning' : 'primary';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {current.toFixed(0)}{unit} / {limit.toFixed(0)}{unit}
        </span>
      </div>
      <Progress value={percentage} variant={color} />
    </div>
  );
}
```

### 6.3 Tooltip with Explanation

```typescript
export function ExplainerTooltip({ children, title, content }: ExplainerTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {children}
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-muted-foreground text-xs">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 7. Real-Time Updates & WebSocket Integration

### 7.1 WebSocket Client

```typescript
// services/api/websocket.ts
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect(clusterId: string) {
    const url = `ws://localhost:8080/api/v1/watch?cluster=${clusterId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket closed');
      this.attemptReconnect(clusterId);
    };
  }

  private handleMessage(message: { type: string; resource: string; data: any }) {
    const key = `${message.type}:${message.resource}`;
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => listener(message.data));
    }
  }

  subscribe(type: string, resource: string, callback: (data: any) => void) {
    const key = `${type}:${resource}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Send subscription message
    this.send({
      action: 'subscribe',
      type,
      resource,
    });

    return () => {
      this.listeners.get(key)?.delete(callback);
      if (this.listeners.get(key)?.size === 0) {
        this.send({
          action: 'unsubscribe',
          type,
          resource,
        });
      }
    };
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private attemptReconnect(clusterId: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
        this.connect(clusterId);
      }, 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WebSocketClient();
```

### 7.2 Real-Time Hook

```typescript
// hooks/useWebSocket.ts
export function useWebSocket(type: string, resource: string) {
  const [data, setData] = useState<any>(null);
  const { selectedClusterId } = useKubernetesConfigStore();

  useEffect(() => {
    if (!selectedClusterId) return;

    // Connect if not already connected
    if (!wsClient.isConnected()) {
      wsClient.connect(selectedClusterId);
    }

    // Subscribe to updates
    const unsubscribe = wsClient.subscribe(type, resource, (updatedData) => {
      setData(updatedData);
    });

    return unsubscribe;
  }, [selectedClusterId, type, resource]);

  return data;
}
```

---

**(End of Part 2)**

**Next**: Part 3 will cover advanced features, mobile-specific UI, accessibility, keyboard shortcuts, error handling, offline mode, and edge cases.
