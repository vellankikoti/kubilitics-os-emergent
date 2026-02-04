/**
 * World-Class Topology Page
 * Full-screen cluster topology visualization with advanced filtering
 * Per Reference Design: Complete with resource filters, relationship toggles, layout controls
 */
import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useClusterStore } from '@/stores/clusterStore';
import { 
  TopologyCanvas, 
  TopologyFilters, 
  TopologyToolbar, 
  LayoutDirectionToggle,
  resourceTypes,
  type TopologyCanvasRef 
} from '@/features/topology';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { TopologyGraph, TopologyNode, KubernetesKind, HealthStatus, RelationshipType } from '@/types/topology';

// Comprehensive mock topology data
const mockGraph: TopologyGraph = {
  schemaVersion: '1.0',
  nodes: [
    // Namespaces
    { id: 'Namespace/blue-green-demo', kind: 'Namespace', namespace: '', name: 'blue-green-demo', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ns-1' }, computed: { health: 'healthy' } },
    
    // Nodes
    { id: 'Node/desktop-worker', kind: 'Node', namespace: '', name: 'desktop-worker', apiVersion: 'v1', status: 'Ready', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'node-1' }, computed: { health: 'healthy' } },
    
    // Deployments
    { id: 'Deployment/blue-green-demo/nginx', kind: 'Deployment', namespace: 'blue-green-demo', name: 'nginx-deployment', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } },
    { id: 'Deployment/blue-green-demo/api', kind: 'Deployment', namespace: 'blue-green-demo', name: 'api-gateway', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-2' }, computed: { health: 'warning', replicas: { desired: 2, ready: 1, available: 1 } } },
    
    // ReplicaSets
    { id: 'ReplicaSet/blue-green-demo/nginx-rs', kind: 'ReplicaSet', namespace: 'blue-green-demo', name: 'nginx-rs-abc12', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'rs-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } },
    
    // Pods
    { id: 'Pod/blue-green-demo/nginx-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-abc12', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-1' }, computed: { health: 'healthy', restartCount: 0 } },
    { id: 'Pod/blue-green-demo/nginx-2', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-def34', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-2' }, computed: { health: 'healthy', restartCount: 0 } },
    { id: 'Pod/blue-green-demo/nginx-3', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-ghi56', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-3' }, computed: { health: 'warning', restartCount: 2 } },
    { id: 'Pod/blue-green-demo/api-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'api-jkl78', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-4' }, computed: { health: 'healthy', restartCount: 0 } },
    
    // Services
    { id: 'Service/blue-green-demo/nginx-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'nginx-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-1' }, computed: { health: 'healthy' } },
    { id: 'Service/blue-green-demo/api-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'api-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-2' }, computed: { health: 'healthy' } },
    
    // ConfigMap & Secret
    { id: 'ConfigMap/blue-green-demo/nginx-config', kind: 'ConfigMap', namespace: 'blue-green-demo', name: 'nginx-config', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'cm-1' }, computed: { health: 'healthy' } },
    { id: 'Secret/blue-green-demo/api-secrets', kind: 'Secret', namespace: 'blue-green-demo', name: 'api-secrets', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sec-1' }, computed: { health: 'healthy' } },
    
    // Ingress
    { id: 'Ingress/blue-green-demo/main-ingress', kind: 'Ingress', namespace: 'blue-green-demo', name: 'todo-ingress', apiVersion: 'networking.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ing-1' }, computed: { health: 'healthy' } },
    
    // PVs and PVCs
    { id: 'PersistentVolume/pv-test-001', kind: 'PersistentVolume', namespace: '', name: 'pv-test-001', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-1' }, computed: { health: 'healthy' } },
    { id: 'PersistentVolume/pv-test-002', kind: 'PersistentVolume', namespace: '', name: 'pv-test-002', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-2' }, computed: { health: 'healthy' } },
    { id: 'PersistentVolume/pv-test-003', kind: 'PersistentVolume', namespace: '', name: 'pv-test-003', apiVersion: 'v1', status: 'Available', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-3' }, computed: { health: 'warning' } },
    { id: 'PersistentVolumeClaim/blue-green-demo/data-pvc', kind: 'PersistentVolumeClaim', namespace: 'blue-green-demo', name: 'data-pvc', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pvc-1' }, computed: { health: 'healthy' } },
    
    // StorageClasses
    { id: 'StorageClass/hostpath', kind: 'StorageClass', namespace: '', name: 'hostpath', apiVersion: 'storage.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sc-1' }, computed: { health: 'healthy' } },
    { id: 'StorageClass/standard', kind: 'StorageClass', namespace: '', name: 'standard', apiVersion: 'storage.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sc-2' }, computed: { health: 'healthy' } },
  ],
  edges: [
    // Namespace contains resources
    { id: 'e-ns-dep1', source: 'Namespace/blue-green-demo', target: 'Deployment/blue-green-demo/nginx', relationshipType: 'contains', label: 'contains', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'metadata.namespace' } },
    { id: 'e-ns-dep2', source: 'Namespace/blue-green-demo', target: 'Deployment/blue-green-demo/api', relationshipType: 'contains', label: 'contains', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'metadata.namespace' } },
    
    // Deployment owns ReplicaSet
    { id: 'e-dep-rs', source: 'Deployment/blue-green-demo/nginx', target: 'ReplicaSet/blue-green-demo/nginx-rs', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // ReplicaSet owns Pods
    { id: 'e-rs-pod1', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod2', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod3', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // Deployment owns Pod (API)
    { id: 'e-dep-pod4', source: 'Deployment/blue-green-demo/api', target: 'Pod/blue-green-demo/api-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // Service selects Pods
    { id: 'e-svc-pod1', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod2', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod3', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod4', source: 'Service/blue-green-demo/api-svc', target: 'Pod/blue-green-demo/api-1', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    
    // Ingress routes to Services
    { id: 'e-ing-svc1', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/nginx-svc', relationshipType: 'routes', label: 'routes', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    { id: 'e-ing-svc2', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/api-svc', relationshipType: 'routes', label: 'routes', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    
    // Deployment uses ConfigMap/Secret
    { id: 'e-dep-cm', source: 'Deployment/blue-green-demo/nginx', target: 'ConfigMap/blue-green-demo/nginx-config', relationshipType: 'configures', label: 'uses', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.volumes' } },
    { id: 'e-dep-sec', source: 'Deployment/blue-green-demo/api', target: 'Secret/blue-green-demo/api-secrets', relationshipType: 'configures', label: 'uses', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.containers[].envFrom' } },
    
    // Pods scheduled on Node
    { id: 'e-pod-node1', source: 'Pod/blue-green-demo/nginx-1', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node2', source: 'Pod/blue-green-demo/nginx-2', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node3', source: 'Pod/blue-green-demo/nginx-3', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node4', source: 'Pod/blue-green-demo/api-1', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    
    // PVC binds to PV
    { id: 'e-pvc-pv', source: 'PersistentVolumeClaim/blue-green-demo/data-pvc', target: 'PersistentVolume/pv-test-001', relationshipType: 'stores', label: 'binds', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.volumeName' } },
    
    // StorageClass provisions PVs
    { id: 'e-sc-pv1', source: 'StorageClass/hostpath', target: 'PersistentVolume/pv-test-001', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    { id: 'e-sc-pv2', source: 'StorageClass/standard', target: 'PersistentVolume/pv-test-002', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    { id: 'e-sc-pv3', source: 'StorageClass/standard', target: 'PersistentVolume/pv-test-003', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    
    // Pod mounts PVC
    { id: 'e-pod-pvc', source: 'Pod/blue-green-demo/nginx-1', target: 'PersistentVolumeClaim/blue-green-demo/data-pvc', relationshipType: 'mounts', label: 'mounts', metadata: { derivation: 'volumeMount', confidence: 1, sourceField: 'spec.volumes' } },
  ],
  metadata: {
    clusterId: 'docker-desktop',
    generatedAt: new Date().toISOString(),
    layoutSeed: 'deterministic-seed-123',
    isComplete: true,
    warnings: [],
  },
};

export default function Topology() {
  const { activeCluster, namespaces } = useClusterStore();
  const navigate = useNavigate();
  const canvasRef = useRef<TopologyCanvasRef>(null);
  
  // View state
  const [viewMode, setViewMode] = useState<'cluster' | 'namespace'>('cluster');
  const [selectedNamespace, setSelectedNamespace] = useState('blue-green-demo');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter state
  const [selectedResources, setSelectedResources] = useState<Set<KubernetesKind>>(
    new Set(resourceTypes.map(r => r.kind))
  );
  const [selectedRelationships, setSelectedRelationships] = useState<Set<RelationshipType>>(
    new Set(['owns', 'selects', 'schedules', 'routes', 'configures', 'mounts', 'stores', 'contains'])
  );
  const [selectedHealth, setSelectedHealth] = useState<Set<HealthStatus | 'pending'>>(
    new Set(['healthy', 'warning', 'critical', 'unknown'])
  );
  
  // Selected node state
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  // Available namespaces from mock data
  const availableNamespaces = useMemo(() => {
    const nsSet = new Set<string>();
    mockGraph.nodes.forEach(n => {
      if (n.namespace) nsSet.add(n.namespace);
    });
    return Array.from(nsSet);
  }, []);

  const handleResourceToggle = useCallback((kind: KubernetesKind) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleRelationshipToggle = useCallback((type: RelationshipType) => {
    setSelectedRelationships(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleHealthToggle = useCallback((status: HealthStatus | 'pending') => {
    setSelectedHealth(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const handleSelectAllResources = useCallback(() => {
    setSelectedResources(new Set(resourceTypes.map(r => r.kind)));
  }, []);

  const handleClearAllResources = useCallback(() => {
    setSelectedResources(new Set());
  }, []);

  const handleNodeSelect = useCallback((node: TopologyNode | null) => {
    setSelectedNode(node);
  }, []);

  const handleNodeDoubleClick = useCallback((node: TopologyNode) => {
    const routeMap: Record<string, string> = {
      Pod: 'pods',
      Deployment: 'deployments',
      ReplicaSet: 'replicasets',
      StatefulSet: 'statefulsets',
      DaemonSet: 'daemonsets',
      Service: 'services',
      ConfigMap: 'configmaps',
      Secret: 'secrets',
      Ingress: 'ingresses',
      Node: 'nodes',
      Namespace: 'namespaces',
      PersistentVolume: 'persistentvolumes',
      PersistentVolumeClaim: 'persistentvolumeclaims',
      StorageClass: 'storageclasses',
      Job: 'jobs',
      CronJob: 'cronjobs',
    };
    const route = routeMap[node.kind];
    if (route) {
      if (node.namespace) {
        navigate(`/${route}/${node.namespace}/${node.name}`);
      } else {
        navigate(`/${route}/${node.name}`);
      }
    }
  }, [navigate]);

  const handleExport = useCallback((format: 'png' | 'svg' | 'pdf') => {
    if (!canvasRef.current) return;
    
    const data = canvasRef.current.exportAsImage(format === 'pdf' ? 'png' : format);
    if (data) {
      // Create download link
      const link = document.createElement('a');
      link.download = `topology-${activeCluster?.name || 'cluster'}-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.href = data;
      link.click();
      toast.success(`Exported as ${format.toUpperCase()}`);
    }
  }, [activeCluster]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    toast.success('Topology refreshed');
  }, []);

  const handleLayoutDirectionChange = useCallback((direction: 'TB' | 'LR') => {
    setLayoutDirection(direction);
    canvasRef.current?.relayout(direction);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-[calc(100vh-4rem)] gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Network className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cluster Topology</h1>
          <p className="text-sm text-muted-foreground">
            Complete cluster view • {activeCluster?.name || 'docker-desktop'}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <TopologyToolbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedNamespace={selectedNamespace}
        namespaces={availableNamespaces}
        onNamespaceChange={setSelectedNamespace}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        layoutDirection={layoutDirection}
        onLayoutDirectionChange={handleLayoutDirectionChange}
        onExport={handleExport}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        className="flex-shrink-0"
      />

      {/* Filters */}
      <TopologyFilters
        selectedResources={selectedResources}
        onResourceToggle={handleResourceToggle}
        selectedRelationships={selectedRelationships}
        onRelationshipToggle={handleRelationshipToggle}
        selectedHealth={selectedHealth}
        onHealthToggle={handleHealthToggle}
        onSelectAll={handleSelectAllResources}
        onClearAll={handleClearAllResources}
        className="flex-shrink-0 bg-card/50 p-4 rounded-xl border border-border"
      />

      {/* Canvas Container */}
      <div className="flex-1 relative min-h-0">
        <TopologyCanvas
          ref={canvasRef}
          graph={mockGraph}
          selectedResources={selectedResources}
          selectedRelationships={selectedRelationships}
          selectedHealth={selectedHealth}
          searchQuery={searchQuery}
          layoutDirection={layoutDirection}
          onNodeSelect={handleNodeSelect}
          onNodeDoubleClick={handleNodeDoubleClick}
          className="h-full"
        />

        {/* Layout Direction Toggle - positioned over canvas */}
        <LayoutDirectionToggle
          direction={layoutDirection}
          onChange={handleLayoutDirectionChange}
          className="absolute top-4 right-4"
        />

        {/* Zoom Controls - positioned over canvas */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 p-1 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => canvasRef.current?.zoomOut()}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom Out</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => canvasRef.current?.zoomIn()}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom In</TooltipContent>
          </Tooltip>
          <Separator orientation="vertical" className="h-5 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => canvasRef.current?.fitToScreen()}
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit to Screen (F)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => canvasRef.current?.resetView()}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset View (R)</TooltipContent>
          </Tooltip>
        </div>

        {/* Selected Node Panel */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-4 left-4 w-72"
          >
            <Card className="p-4 bg-card/95 backdrop-blur-sm shadow-lg border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: resourceTypes.find(r => r.kind === selectedNode.kind)?.color || '#6b7280' }}
                  >
                    {selectedNode.kind[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{selectedNode.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedNode.kind}
                      {selectedNode.namespace && ` • ${selectedNode.namespace}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <Badge variant={selectedNode.computed.health === 'healthy' ? 'default' : selectedNode.computed.health === 'warning' ? 'secondary' : 'destructive'}>
                  {selectedNode.computed.health}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleNodeDoubleClick(selectedNode)}
                >
                  View Details
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
