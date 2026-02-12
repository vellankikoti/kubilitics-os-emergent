/**
 * World-Class Topology Page
 * Uses the portable /topology-engine
 * Structural + Traffic Flow modes, Heatmap, Minimap
 */
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Network, ZoomIn, ZoomOut, Maximize, RotateCcw, Download,
  FileCode, FileImage, FileText, FileJson, Table, Search,
  Layers, ChevronDown, Activity, Thermometer, RefreshCcw,
  Map as MapIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useClusterStore } from '@/stores/clusterStore';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// ─── Import from portable topology-engine ─────────────────────
import {
  TopologyCanvas,
  ABSTRACTION_LEVELS,
  NODE_COLORS,
  KIND_LABELS,
  getKindColor,
  RELATIONSHIP_CONFIG,
  downloadJSON,
  downloadCSV,
  downloadPDF,
  getRecommendedAbstraction,
  D3TopologyCanvas,
  D3HierarchicalTopologyCanvas,
  convertToD3Topology,
  type TopologyCanvasRef,
  type TopologyGraph,
  type TopologyNode,
  type KubernetesKind,
  type HealthStatus,
  type RelationshipType,
  type AbstractionLevel,
  type HeatMapMode,
} from '@/topology-engine';

// ─── Resource type filter config ──────────────────────────────
const RESOURCE_TYPES: Array<{ kind: KubernetesKind; label: string; color: string }> = [
  { kind: 'Namespace', label: 'Namespace', color: NODE_COLORS.Namespace.bg },
  { kind: 'Ingress', label: 'Ingress', color: NODE_COLORS.Ingress.bg },
  { kind: 'Service', label: 'Service', color: NODE_COLORS.Service.bg },
  { kind: 'Deployment', label: 'Deployment', color: NODE_COLORS.Deployment.bg },
  { kind: 'StatefulSet', label: 'StatefulSet', color: NODE_COLORS.StatefulSet.bg },
  { kind: 'DaemonSet', label: 'DaemonSet', color: NODE_COLORS.DaemonSet.bg },
  { kind: 'ReplicaSet', label: 'ReplicaSet', color: NODE_COLORS.ReplicaSet.bg },
  { kind: 'Pod', label: 'Pod', color: NODE_COLORS.Pod.bg },
  { kind: 'PodGroup', label: 'PodGroup', color: NODE_COLORS.PodGroup.bg },
  { kind: 'ConfigMap', label: 'ConfigMap', color: NODE_COLORS.ConfigMap.bg },
  { kind: 'Secret', label: 'Secret', color: NODE_COLORS.Secret.bg },
  { kind: 'PersistentVolumeClaim', label: 'PersistentVolumeClaim', color: NODE_COLORS.PersistentVolumeClaim.bg },
  { kind: 'PersistentVolume', label: 'PersistentVolume', color: NODE_COLORS.PersistentVolume.bg },
  { kind: 'StorageClass', label: 'StorageClass', color: NODE_COLORS.StorageClass.bg },
  { kind: 'Node', label: 'Node', color: NODE_COLORS.Node.bg },
  { kind: 'Job', label: 'Job', color: NODE_COLORS.Job.bg },
  { kind: 'CronJob', label: 'CronJob', color: NODE_COLORS.CronJob.bg },
];

const ALL_RELATIONSHIPS: RelationshipType[] = [
  'owns', 'selects', 'scheduled_on', 'routes', 'references',
  'configures', 'mounts', 'stores', 'contains', 'exposes', 'backed_by',
  'permits', 'limits', 'manages',
];

// Helper
function n(partial: Omit<TopologyNode, 'label'>): TopologyNode {
  return { ...partial, label: partial.name };
}

// ─── Mock Graph ───────────────────────────────────────────────
const mockGraph: TopologyGraph = {
  schemaVersion: '1.0',
  nodes: [
    n({ id: 'Namespace/blue-green-demo', kind: 'Namespace', namespace: '', name: 'blue-green-demo', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ns-1' }, computed: { health: 'healthy' } }),
    n({ id: 'Node/desktop-worker', kind: 'Node', namespace: '', name: 'desktop-worker', apiVersion: 'v1', status: 'Ready', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'node-1' }, computed: { health: 'healthy', cpuUsage: 45 } }),
    n({ id: 'Deployment/blue-green-demo/nginx', kind: 'Deployment', namespace: 'blue-green-demo', name: 'nginx-deployment', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } }),
    n({ id: 'Deployment/blue-green-demo/api', kind: 'Deployment', namespace: 'blue-green-demo', name: 'api-gateway', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-2' }, computed: { health: 'warning', replicas: { desired: 2, ready: 1, available: 1 }, cpuUsage: 78 } }),
    n({ id: 'ReplicaSet/blue-green-demo/nginx-rs', kind: 'ReplicaSet', namespace: 'blue-green-demo', name: 'nginx-rs-abc12', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'rs-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } }),
    n({ id: 'Pod/blue-green-demo/nginx-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-abc12', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-1' }, computed: { health: 'healthy', restartCount: 0, cpuUsage: 12 } }),
    n({ id: 'Pod/blue-green-demo/nginx-2', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-def34', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-2' }, computed: { health: 'healthy', restartCount: 0, cpuUsage: 18 } }),
    n({ id: 'Pod/blue-green-demo/nginx-3', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-ghi56', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-3' }, computed: { health: 'warning', restartCount: 5, cpuUsage: 62 } }),
    n({ id: 'Pod/blue-green-demo/api-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'api-jkl78', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-4' }, computed: { health: 'healthy', restartCount: 1, cpuUsage: 34 } }),
    n({ id: 'Service/blue-green-demo/nginx-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'nginx-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-1' }, computed: { health: 'healthy' } }),
    n({ id: 'Service/blue-green-demo/api-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'api-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-2' }, computed: { health: 'healthy' } }),
    n({ id: 'ConfigMap/blue-green-demo/nginx-config', kind: 'ConfigMap', namespace: 'blue-green-demo', name: 'nginx-config', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'cm-1' }, computed: { health: 'healthy' } }),
    n({ id: 'Secret/blue-green-demo/api-secrets', kind: 'Secret', namespace: 'blue-green-demo', name: 'api-secrets', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sec-1' }, computed: { health: 'healthy' } }),
    n({ id: 'Ingress/blue-green-demo/main-ingress', kind: 'Ingress', namespace: 'blue-green-demo', name: 'todo-ingress', apiVersion: 'networking.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ing-1' }, computed: { health: 'healthy' } }),
    n({ id: 'PersistentVolume/pv-test-001', kind: 'PersistentVolume', namespace: '', name: 'pv-test-001', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-1' }, computed: { health: 'healthy' } }),
    n({ id: 'PersistentVolumeClaim/blue-green-demo/data-pvc', kind: 'PersistentVolumeClaim', namespace: 'blue-green-demo', name: 'data-pvc', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pvc-1' }, computed: { health: 'healthy' } }),
    n({ id: 'StorageClass/hostpath', kind: 'StorageClass', namespace: '', name: 'hostpath', apiVersion: 'storage.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sc-1' }, computed: { health: 'healthy' } }),
  ],
  edges: [
    { id: 'e-dep-rs', source: 'Deployment/blue-green-demo/nginx', target: 'ReplicaSet/blue-green-demo/nginx-rs', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod1', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod2', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod3', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-dep-pod4', source: 'Deployment/blue-green-demo/api', target: 'Pod/blue-green-demo/api-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-svc-pod1', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'selects', label: 'selected by', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod2', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'selects', label: 'selected by', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod3', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'selects', label: 'selected by', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod4', source: 'Service/blue-green-demo/api-svc', target: 'Pod/blue-green-demo/api-1', relationshipType: 'selects', label: 'selected by', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-ing-svc1', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/nginx-svc', relationshipType: 'routes', label: 'routes to', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    { id: 'e-ing-svc2', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/api-svc', relationshipType: 'routes', label: 'routes to', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    { id: 'e-dep-cm', source: 'Deployment/blue-green-demo/nginx', target: 'ConfigMap/blue-green-demo/nginx-config', relationshipType: 'references', label: 'uses config', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.volumes' } },
    { id: 'e-dep-sec', source: 'Deployment/blue-green-demo/api', target: 'Secret/blue-green-demo/api-secrets', relationshipType: 'references', label: 'uses secret', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.containers[].envFrom' } },
    { id: 'e-pod-node1', source: 'Pod/blue-green-demo/nginx-1', target: 'Node/desktop-worker', relationshipType: 'scheduled_on', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node2', source: 'Pod/blue-green-demo/nginx-2', target: 'Node/desktop-worker', relationshipType: 'scheduled_on', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node3', source: 'Pod/blue-green-demo/nginx-3', target: 'Node/desktop-worker', relationshipType: 'scheduled_on', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node4', source: 'Pod/blue-green-demo/api-1', target: 'Node/desktop-worker', relationshipType: 'scheduled_on', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pvc-pv', source: 'PersistentVolumeClaim/blue-green-demo/data-pvc', target: 'PersistentVolume/pv-test-001', relationshipType: 'stores', label: 'binds to', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.volumeName' } },
    { id: 'e-sc-pv1', source: 'StorageClass/hostpath', target: 'PersistentVolume/pv-test-001', relationshipType: 'backed_by', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
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
  const { activeCluster } = useClusterStore();
  const navigate = useNavigate();
  const canvasRef = useRef<TopologyCanvasRef>(null);

  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [abstractionLevel, setAbstractionLevel] = useState<AbstractionLevel>('L2');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [topologyMode, setTopologyMode] = useState<'structural' | 'traffic'>('structural');
  const [heatMapMode, setHeatMapMode] = useState<HeatMapMode>('none');

  const [selectedResources, setSelectedResources] = useState<Set<KubernetesKind>>(
    new Set(RESOURCE_TYPES.map(r => r.kind))
  );
  const [selectedRelationships, setSelectedRelationships] = useState<Set<RelationshipType>>(
    new Set(ALL_RELATIONSHIPS)
  );
  const [selectedHealth, setSelectedHealth] = useState<Set<HealthStatus | 'pending'>>(
    new Set(['healthy', 'warning', 'critical', 'unknown'])
  );
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [activeTab, setActiveTab] = useState<'cytoscape' | 'd3-force' | 'd3-hierarchical'>('cytoscape');

  const availableNamespaces = useMemo(() => {
    const ns = new Set<string>();
    mockGraph.nodes.forEach(n => { if (n.namespace) ns.add(n.namespace); });
    return Array.from(ns);
  }, []);

  const handleResourceToggle = useCallback((kind: KubernetesKind) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      next.has(kind) ? next.delete(kind) : next.add(kind);
      return next;
    });
  }, []);

  const handleNodeDoubleClick = useCallback((node: TopologyNode) => {
    const routeMap: Record<string, string> = {
      Pod: 'pods', Deployment: 'deployments', ReplicaSet: 'replicasets',
      StatefulSet: 'statefulsets', DaemonSet: 'daemonsets', Service: 'services',
      ConfigMap: 'configmaps', Secret: 'secrets', Ingress: 'ingresses',
      Node: 'nodes', Namespace: 'namespaces', PersistentVolume: 'persistentvolumes',
      PersistentVolumeClaim: 'persistentvolumeclaims', StorageClass: 'storageclasses',
      Job: 'jobs', CronJob: 'cronjobs',
    };
    const route = routeMap[node.kind];
    if (route) navigate(node.namespace ? `/${route}/${node.namespace}/${node.name}` : `/${route}/${node.name}`);
  }, [navigate]);

  const handleExport = useCallback((format: string) => {
    if (!canvasRef.current) return;
    switch (format) {
      case 'svg': {
        const data = canvasRef.current.exportAsSVG();
        if (data) {
          const blob = new Blob([data], { type: 'image/svg+xml' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `topology-${new Date().toISOString().slice(0, 10)}.svg`;
          link.href = url; link.click(); URL.revokeObjectURL(url);
        }
        break;
      }
      case 'png': {
        const data = canvasRef.current.exportAsPNG();
        if (data) {
          const link = document.createElement('a');
          link.download = `topology-${new Date().toISOString().slice(0, 10)}.png`;
          link.href = data; link.click();
        }
        break;
      }
      case 'json': downloadJSON(mockGraph, `topology-${new Date().toISOString().slice(0, 10)}.json`); break;
      case 'csv': downloadCSV(mockGraph, `topology-${new Date().toISOString().slice(0, 10)}.csv`); break;
    }
    toast.success(`Exported as ${format.toUpperCase()}`);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsRefreshing(false);
    toast.success('Topology refreshed');
  }, []);

  // Keyboard: space to toggle pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsPaused(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[calc(100vh-4rem)] gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Network className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cluster Topology</h1>
            <p className="text-sm text-muted-foreground">
              {activeCluster?.name || 'docker-desktop'} • {mockGraph.nodes.length} resources • ELK Layered
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Structural / Traffic toggle */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={topologyMode === 'structural' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopologyMode('structural')}
                  className="h-8 px-3 text-xs font-medium gap-1.5"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Structural
                </Button>
              </TooltipTrigger>
              <TooltipContent>Cluster Intelligence Map – resource connections</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={topologyMode === 'traffic' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTopologyMode('traffic')}
                  className="h-8 px-3 text-xs font-medium gap-1.5"
                >
                  <Activity className="h-3.5 w-3.5" />
                  Traffic Flow
                </Button>
              </TooltipTrigger>
              <TooltipContent>Interactive Traffic Topology – request flow simulation</TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Abstraction Level Selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-muted rounded-lg">
            {(['L0', 'L1', 'L2', 'L3'] as AbstractionLevel[]).map((level) => (
              <Tooltip key={level}>
                <TooltipTrigger asChild>
                  <Button
                    variant={abstractionLevel === level ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setAbstractionLevel(level)}
                    className="h-8 px-3 text-xs font-medium"
                  >
                    {level}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{ABSTRACTION_LEVELS[level].label}</p>
                  <p className="text-xs text-muted-foreground">{ABSTRACTION_LEVELS[level].description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
        {/* Namespace selector */}
        <Select value={selectedNamespace} onValueChange={setSelectedNamespace}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="All Namespaces" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Namespaces</SelectItem>
            {availableNamespaces.map(ns => (
              <SelectItem key={ns} value={ns}>{ns}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Heatmap */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={heatMapMode !== 'none' ? 'default' : 'outline'} size="sm" className="gap-1.5 h-9">
              <Thermometer className="h-4 w-4" />
              {heatMapMode === 'none' ? 'Heatmap' : heatMapMode === 'cpu' ? 'CPU Heat' : 'Restart Heat'}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setHeatMapMode('none')}>
              Off
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHeatMapMode('cpu')}>
              <Thermometer className="h-4 w-4 mr-2" /> CPU Usage
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setHeatMapMode('restarts')}>
              <RefreshCcw className="h-4 w-4 mr-2" /> Restart Count
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <Download className="h-4 w-4" /> Export <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('svg')}>
              <FileCode className="h-4 w-4 mr-2" /> SVG (Vector)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('png')}>
              <FileImage className="h-4 w-4 mr-2" /> PNG (High DPI)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleExport('json')}>
              <FileJson className="h-4 w-4 mr-2" /> JSON (Full Graph)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <Table className="h-4 w-4 mr-2" /> CSV (Summary)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Refresh */}
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={handleRefresh} disabled={isRefreshing}>
          <RotateCcw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Resource Type Filters */}
      <div className="flex flex-wrap items-center gap-1.5 flex-shrink-0">
        {RESOURCE_TYPES.map(rt => {
          const active = selectedResources.has(rt.kind);
          return (
            <button
              key={rt.kind}
              onClick={() => handleResourceToggle(rt.kind)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-border text-muted-foreground bg-background hover:bg-muted'
              }`}
              style={active ? { backgroundColor: rt.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rt.color }} />
              {rt.label}
            </button>
          );
        })}
      </div>

      {/* Traffic mode info banner */}
      {topologyMode === 'traffic' && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
          <Activity className="h-4 w-4 text-emerald-600" />
          <span className="text-sm text-emerald-700 font-medium">
            Traffic Flow Mode — Animated edges show request flow: Ingress → Service → Pod
          </span>
        </div>
      )}

      {/* Canvas with Tabs */}
      <div className="flex-1 relative min-h-0">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cytoscape' | 'd3-force' | 'd3-hierarchical')} className="h-full flex flex-col">
          <TabsList className="mb-2 flex-shrink-0">
            <TabsTrigger value="cytoscape">Cytoscape Layout</TabsTrigger>
            <TabsTrigger value="d3-force">D3.js Force-Directed</TabsTrigger>
            <TabsTrigger value="d3-hierarchical">D3.js Standard</TabsTrigger>
          </TabsList>
          
          <TabsContent value="cytoscape" className="flex-1 relative min-h-0 mt-0">
            <TopologyCanvas
              ref={canvasRef}
              graph={mockGraph}
              selectedResources={selectedResources}
              selectedRelationships={selectedRelationships}
              selectedHealth={selectedHealth}
              searchQuery={searchQuery}
              abstractionLevel={abstractionLevel}
              namespace={selectedNamespace}
              isPaused={isPaused}
              heatMapMode={heatMapMode}
              trafficFlowEnabled={topologyMode === 'traffic'}
              onNodeSelect={setSelectedNode}
              onNodeDoubleClick={handleNodeDoubleClick}
              className="h-full"
            />

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

            {/* Node count indicator */}
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm border border-gray-200/80 rounded-lg px-3 py-1.5 shadow-md">
              <span className="text-xs font-semibold text-gray-700">
                {mockGraph.nodes.length} nodes
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 flex flex-col items-center gap-1 p-1 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.zoomIn()}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Zoom In</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.zoomOut()}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Zoom Out</TooltipContent>
              </Tooltip>
              <Separator className="w-5" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.fitToScreen()}>
                    <Maximize className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Fit (F)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => canvasRef.current?.resetView()}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Reset (R)</TooltipContent>
              </Tooltip>
            </div>
          </TabsContent>
          
          <TabsContent value="d3-force" className="flex-1 relative min-h-0 mt-0">
            <D3TopologyCanvas
              nodes={convertToD3Topology(mockGraph).nodes}
              edges={convertToD3Topology(mockGraph).edges}
              onNodeClick={(node) => {
                // Navigate to resource detail page
                const parts = node.id.split('/');
                if (parts.length >= 3) {
                  const [kind, namespace, name] = parts;
                  const routeMap: Record<string, string> = {
                    Pod: 'pods', Deployment: 'deployments', ReplicaSet: 'replicasets',
                    StatefulSet: 'statefulsets', DaemonSet: 'daemonsets', Service: 'services',
                    ConfigMap: 'configmaps', Secret: 'secrets', Ingress: 'ingresses',
                    Node: 'nodes', Namespace: 'namespaces',
                  };
                  const route = routeMap[kind] || kind.toLowerCase() + 's';
                  navigate(`/clusters/${activeCluster?.id || 'default'}/${route}/${namespace}/${name}`);
                }
              }}
              className="h-full"
            />
          </TabsContent>
          
          <TabsContent value="d3-hierarchical" className="flex-1 relative min-h-0 mt-0">
            <D3HierarchicalTopologyCanvas
              nodes={convertToD3Topology(mockGraph).nodes}
              edges={convertToD3Topology(mockGraph).edges}
              onNodeClick={(node) => {
                // Navigate to resource detail page
                const parts = node.id.split('/');
                if (parts.length >= 3) {
                  const [kind, namespace, name] = parts;
                  const routeMap: Record<string, string> = {
                    Pod: 'pods', Deployment: 'deployments', ReplicaSet: 'replicasets',
                    StatefulSet: 'statefulsets', DaemonSet: 'daemonsets', Service: 'services',
                    ConfigMap: 'configmaps', Secret: 'secrets', Ingress: 'ingresses',
                    Node: 'nodes', Namespace: 'namespaces',
                  };
                  const route = routeMap[kind] || kind.toLowerCase() + 's';
                  navigate(`/clusters/${activeCluster?.id || 'default'}/${route}/${namespace}/${name}`);
                }
              }}
              className="h-full"
            />
          </TabsContent>
        </Tabs>

        {/* Selected Node Panel - Only show for Cytoscape tab */}
        {activeTab === 'cytoscape' && selectedNode && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="absolute top-4 left-4 w-72">
            <Card className="p-4 bg-background/95 backdrop-blur-sm shadow-lg border-primary/30">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-md leading-tight text-center"
                  style={{ backgroundColor: getKindColor(selectedNode.kind) }}
                >
                  {selectedNode.kind}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate text-sm">{selectedNode.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedNode.kind}{selectedNode.namespace && ` • ${selectedNode.namespace}`}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={
                    selectedNode.computed.health === 'healthy' ? 'default' :
                    selectedNode.computed.health === 'warning' ? 'secondary' : 'destructive'
                  } className="text-[10px] h-5">
                    {selectedNode.computed.health}
                  </Badge>
                </div>
                {selectedNode.computed.restartCount !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Restarts:</span>
                    <span className="font-medium">{selectedNode.computed.restartCount}</span>
                  </div>
                )}
                {selectedNode.computed.cpuUsage !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">CPU:</span>
                    <span className="font-medium">{selectedNode.computed.cpuUsage}%</span>
                  </div>
                )}
                {selectedNode.computed.replicas && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">Replicas:</span>
                    <span className="font-medium">{selectedNode.computed.replicas.ready}/{selectedNode.computed.replicas.desired}</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-end">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => handleNodeDoubleClick(selectedNode)}>
                  View Details →
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
