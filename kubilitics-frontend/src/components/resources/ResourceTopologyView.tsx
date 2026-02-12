/**
 * ResourceTopologyView - Reusable component for displaying resource-scoped topology
 * Integrates topology-engine with backend API
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Network, Loader2, AlertCircle, RefreshCw, ZoomIn, ZoomOut, Maximize,
  FileJson, FileText, FileImage, Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TopologyCanvas, NODE_COLORS, downloadJSON, downloadCSV, D3TopologyCanvas, D3HierarchicalTopologyCanvas, convertToD3Topology, type TopologyCanvasRef, type TopologyGraph } from '@/topology-engine';
import type {
  TopologyNode,
  KubernetesKind,
  RelationshipType,
  HealthStatus,
  AbstractionLevel,
} from '@/topology-engine';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { kindToRoutePath, buildTopologyNodeId } from '@/utils/resourceKindMapper';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { toast } from 'sonner';

export interface ResourceTopologyViewProps {
  kind: string;
  namespace?: string | null;
  name?: string | null;
  sourceResourceType?: string;
  sourceResourceName?: string;
}

function getResourceRoute(node: TopologyNode): string | null {
  const route = kindToRoutePath(node.kind);
  if (!route) return null;
  return node.namespace
    ? `/${route}/${node.namespace}/${node.name}`
    : `/${route}/${node.name}`;
}

/**
 * Resource-scoped topology view component.
 * All hooks are called unconditionally at the top; conditional returns come after.
 */
export function ResourceTopologyView({
  kind,
  namespace,
  name,
}: ResourceTopologyViewProps) {
  const navigate = useNavigate();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const clusterId = useActiveClusterId();
  const canvasRef = useRef<TopologyCanvasRef>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState<'cytoscape' | 'd3-force' | 'd3-hierarchical'>('cytoscape');

  const backendConfigured = isBackendConfigured();
  const hasClusterId = !!clusterId;
  const hasKind = !!kind;
  const hasName = !!name;

  const { graph, isLoading, error, refetch } = useResourceTopology({
    kind,
    namespace,
    name,
    enabled: backendConfigured && hasClusterId && hasKind && hasName,
  });

  const currentNodeId = useMemo(() => {
    if (!kind || !name) return undefined;
    return buildTopologyNodeId(kind, namespace ?? '', name);
  }, [kind, namespace, name]);

  // All filter sets declared as hooks (unconditionally)
  const [selectedResources] = useState<Set<KubernetesKind>>(
    new Set<KubernetesKind>([
      'Namespace', 'Ingress', 'Service', 'Deployment', 'StatefulSet', 'DaemonSet',
      'ReplicaSet', 'Pod', 'ConfigMap', 'Secret', 'PersistentVolumeClaim',
      'PersistentVolume', 'StorageClass', 'Node', 'Job', 'CronJob',
      'Endpoints', 'EndpointSlice',
    ])
  );

  const [selectedRelationships] = useState<Set<RelationshipType>>(
    new Set<RelationshipType>([
      'exposes', 'selects', 'owns', 'runs', 'mounts', 'scheduled_on',
      'references', 'backed_by', 'routes', 'configures', 'contains',
      'stores', 'permits', 'limits', 'manages',
    ])
  );

  const [selectedHealth] = useState<Set<HealthStatus | 'pending'>>(
    new Set(['healthy', 'warning', 'critical', 'unknown'])
  );

  const [abstractionLevel] = useState<AbstractionLevel>('L3'); // Full infrastructure
  const [searchQuery] = useState('');
  const [isPaused] = useState(false);

  const handleNodeDoubleClick = useCallback(
    (node: TopologyNode) => {
      const route = getResourceRoute(node);
      if (route) navigate(route);
    },
    [navigate]
  );

  const handleNodeSelect = useCallback((_node: TopologyNode | null) => {}, []);

  // Export handlers
  const handleExportJSON = useCallback(() => {
    if (!graph) return;
    downloadJSON(graph, `topology-${kind}-${name || 'resource'}.json`);
    toast.success('Exported as JSON');
  }, [graph, kind, name]);

  const handleExportCSV = useCallback(() => {
    if (!graph) return;
    downloadCSV(graph, `topology-${kind}-${name || 'resource'}.csv`);
    toast.success('Exported as CSV');
  }, [graph, kind, name]);

  const handleExportPNG = useCallback(() => {
    if (!canvasRef.current) return;
    const pngData = canvasRef.current.exportAsPNG();
    if (pngData) {
      const link = document.createElement('a');
      link.download = `topology-${kind}-${name || 'resource'}.png`;
      link.href = pngData;
      link.click();
      toast.success('Exported as PNG');
    }
  }, [kind, name]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    canvasRef.current?.zoomIn();
    setZoomLevel(prev => Math.min(Math.round(prev * 1.3), 500));
  }, []);

  const handleZoomOut = useCallback(() => {
    canvasRef.current?.zoomOut();
    setZoomLevel(prev => Math.max(Math.round(prev / 1.3), 10));
  }, []);

  const handleFullscreen = useCallback(() => {
    const container = document.querySelector('[data-topology-container]') as HTMLElement;
    if (container) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    }
  }, []);

  const handleRefreshLayout = useCallback(() => {
    canvasRef.current?.relayout();
    toast.success('Layout refreshed');
  }, []);

  const handleD3NodeClick = useCallback((node: { id: string; type: string; name: string; namespace?: string }) => {
    const parts = node.id.split('/');
    if (parts.length >= 3) {
      const [kind, namespace, name] = parts;
      const route = kindToRoutePath(kind as KubernetesKind);
      if (route) {
        navigate(namespace ? `/${route}/${namespace}/${name}` : `/${route}/${name}`);
      }
    }
  }, [navigate]);

  // --- All hooks called above this line. Conditional returns below. ---

  if (!backendConfigured) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Network className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">Connect to Kubilitics backend to view topology</p>
        <p className="text-sm text-muted-foreground">Go to Settings to configure the backend connection</p>
      </div>
    );
  }

  if (!hasClusterId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Network className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Select a cluster to view topology</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Loading topology...</p>
      </div>
    );
  }

  if (error) {
    const msg = error.message || String(error);
    const isNotFound = msg.toLowerCase().includes('not found') || msg.includes('404');
    const isTimeout = msg.toLowerCase().includes('timeout');
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-destructive font-medium mb-2">
          {isNotFound ? 'Resource not found' : isTimeout ? 'Topology build timed out' : 'Failed to load topology'}
        </p>
        <p className="text-sm text-muted-foreground mb-4">{msg}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />Retry
        </Button>
      </div>
    );
  }

  if (!graph || (graph.nodes.length === 0 && graph.edges.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <Network className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-2">No related resources found in topology</p>
        <p className="text-sm text-muted-foreground">This resource has no relationships with other resources in the cluster.</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-20rem)] min-h-[500px] w-full bg-white rounded-lg border border-gray-200 shadow-sm" data-topology-container>
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        {/* Left Section - Title and Layout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center">
              <Network className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Resource Topology</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshLayout}
            className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900"
            disabled={activeTab === 'd3-force' || activeTab === 'd3-hierarchical'}
          >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Refresh Layout
          </Button>
        </div>

        {/* Right Section - Export and Controls */}
        <div className="flex items-center gap-3">
          {/* Export Options */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportJSON}
              className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900"
              disabled={!graph}
            >
              <FileJson className="h-3.5 w-3.5 mr-1.5" />
              JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900"
              disabled={!graph}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportPNG}
              className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900"
              disabled={!graph}
            >
              <FileImage className="h-3.5 w-3.5 mr-1.5" />
              PNG
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              className="h-8 w-8 text-gray-600 hover:text-gray-900"
              disabled={!graph}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-gray-700 min-w-[3rem] text-center">
              {zoomLevel}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              className="h-8 w-8 text-gray-600 hover:text-gray-900"
              disabled={!graph}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Fullscreen */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFullscreen}
            className="h-8 w-8 text-gray-600 hover:text-gray-900"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas Area with Tabs */}
      <div className="relative h-[calc(100%-3.5rem)]">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cytoscape' | 'd3-force' | 'd3-hierarchical')} className="h-full flex flex-col">
          <TabsList className="mb-2 flex-shrink-0 mx-4 mt-2">
            <TabsTrigger value="cytoscape">Cytoscape Layout</TabsTrigger>
            <TabsTrigger value="d3-force">D3.js Force-Directed</TabsTrigger>
            <TabsTrigger value="d3-hierarchical">D3.js Standard</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cytoscape" className="flex-1 relative min-h-0 mt-0">
            <TopologyCanvas
              ref={canvasRef}
              graph={graph}
              selectedResources={selectedResources}
              selectedRelationships={selectedRelationships}
              selectedHealth={selectedHealth}
              searchQuery={searchQuery}
              abstractionLevel={abstractionLevel}
              namespace={namespace ?? undefined}
              centeredNodeId={currentNodeId}
              isPaused={isPaused}
              heatMapMode="none"
              trafficFlowEnabled={false}
              onNodeSelect={handleNodeSelect}
              onNodeDoubleClick={handleNodeDoubleClick}
              className="h-full w-full rounded-b-lg"
            />

            {/* Resource Count Badge */}
            {graph && (
              <div className="absolute bottom-4 right-4 z-50 bg-gray-100 border border-gray-200 rounded-md px-2.5 py-1">
                <span className="text-xs font-medium text-gray-700">
                  {graph.nodes.length} Resources
                </span>
              </div>
            )}

            {/* Legend Bar - Matching Reference Image Style */}
            <div className="absolute bottom-4 left-4 z-50 bg-white border border-gray-200 rounded-lg px-6 py-3 shadow-lg">
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { kind: 'Deployment', label: 'Deployment', color: NODE_COLORS.Deployment.bg },
                  { kind: 'ReplicaSet', label: 'ReplicaSet', color: NODE_COLORS.ReplicaSet.bg },
                  { kind: 'Pod', label: 'Pod', color: NODE_COLORS.Pod.bg },
                  { kind: 'Service', label: 'Service', color: NODE_COLORS.Service.bg },
                  { kind: 'Ingress', label: 'Ingress', color: NODE_COLORS.Ingress.bg },
                  { kind: 'ConfigMap', label: 'ConfigMap', color: NODE_COLORS.ConfigMap.bg },
                  { kind: 'Node', label: 'Node', color: NODE_COLORS.Node.bg },
                  { kind: 'Endpoints', label: 'Endpoints', color: NODE_COLORS.Endpoints.bg },
                ].map(rt => (
                  <div key={rt.kind} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: rt.color }}
                    />
                    <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                      {rt.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="d3-force" className="flex-1 relative min-h-0 mt-0">
            <D3TopologyCanvas
              nodes={convertToD3Topology(graph, currentNodeId).nodes}
              edges={convertToD3Topology(graph, currentNodeId).edges}
              onNodeClick={handleD3NodeClick}
              className="h-full w-full rounded-b-lg"
            />
          </TabsContent>
          
          <TabsContent value="d3-hierarchical" className="flex-1 relative min-h-0 mt-0">
            <D3HierarchicalTopologyCanvas
              nodes={convertToD3Topology(graph, currentNodeId).nodes}
              edges={convertToD3Topology(graph, currentNodeId).edges}
              onNodeClick={handleD3NodeClick}
              className="h-full w-full rounded-b-lg"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
