import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  MoreHorizontal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Download,
  Box,
  Loader2,
  WifiOff,
  Plus,
  Terminal,
  FileText,
  ExternalLink,
  Trash2,
  RotateCcw,
  ArrowUpDown,
  ChevronDown,
  GitCompare,
  CheckSquare,
  Square,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { DeleteConfirmDialog, PortForwardDialog, Sparkline, PodComparisonView } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface PodResource extends KubernetesResource {
  spec: {
    nodeName?: string;
    containers: Array<{ name: string; image: string; ports?: Array<{ containerPort: number; name?: string; protocol?: string }> }>;
  };
  status: {
    phase: string;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
    }>;
  };
}

interface Pod {
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'CrashLoopBackOff';
  ready: string;
  restarts: number;
  age: string;
  node: string;
  cpu: string;
  memory: string;
  containers: Array<{ name: string; ports?: Array<{ containerPort: number; name?: string; protocol?: string }> }>;
  // Live metrics data
  cpuData?: number[];
  memoryData?: number[];
}

const mockPods: Pod[] = [
  { name: 'nginx-deployment-7fb96c846b-abc12', namespace: 'production', status: 'Running', ready: '1/1', restarts: 0, age: '2d', node: 'worker-node-1', cpu: '10m', memory: '32Mi', containers: [{ name: 'nginx', ports: [{ containerPort: 80, name: 'http' }] }], cpuData: [12, 15, 10, 18, 14, 11, 13, 16, 12, 14, 10, 15, 13, 11, 14, 12, 15, 10, 13, 11], memoryData: [30, 32, 35, 31, 33, 34, 32, 30, 35, 33, 31, 32, 34, 30, 33, 35, 32, 31, 34, 32] },
  { name: 'nginx-deployment-7fb96c846b-def34', namespace: 'production', status: 'Running', ready: '1/1', restarts: 0, age: '2d', node: 'worker-node-2', cpu: '12m', memory: '28Mi', containers: [{ name: 'nginx', ports: [{ containerPort: 80, name: 'http' }] }], cpuData: [14, 12, 16, 13, 15, 11, 14, 12, 18, 15, 13, 11, 16, 14, 12, 15, 13, 17, 14, 12], memoryData: [28, 26, 30, 27, 29, 25, 28, 30, 26, 28, 27, 29, 25, 28, 30, 27, 26, 29, 28, 28] },
  { name: 'api-gateway-5f8f9c7d6-jkl78', namespace: 'production', status: 'Running', ready: '2/2', restarts: 1, age: '5d', node: 'worker-node-3', cpu: '45m', memory: '128Mi', containers: [{ name: 'gateway', ports: [{ containerPort: 8080, name: 'http' }, { containerPort: 8443, name: 'https' }] }], cpuData: [40, 45, 50, 42, 48, 55, 45, 40, 52, 47, 43, 50, 45, 48, 42, 55, 47, 43, 50, 45], memoryData: [120, 125, 130, 128, 135, 140, 130, 125, 138, 132, 128, 135, 130, 140, 125, 132, 138, 128, 135, 128] },
  { name: 'redis-master-0', namespace: 'production', status: 'Running', ready: '1/1', restarts: 0, age: '14d', node: 'worker-node-2', cpu: '25m', memory: '64Mi', containers: [{ name: 'redis', ports: [{ containerPort: 6379, name: 'redis' }] }], cpuData: [20, 25, 22, 28, 24, 21, 26, 23, 27, 24, 22, 25, 28, 21, 24, 26, 23, 25, 22, 25], memoryData: [60, 62, 65, 64, 68, 63, 66, 62, 64, 67, 63, 65, 68, 62, 64, 66, 63, 65, 62, 64] },
  { name: 'flaky-service-8f7g6h5-mno90', namespace: 'staging', status: 'CrashLoopBackOff', ready: '0/1', restarts: 15, age: '3h', node: 'worker-node-3', cpu: '0m', memory: '0Mi', containers: [{ name: 'app', ports: [{ containerPort: 3000 }] }], cpuData: [0, 5, 0, 3, 0, 0, 2, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0], memoryData: [0, 10, 0, 5, 0, 0, 8, 0, 0, 3, 0, 0, 0, 5, 0, 0, 0, 2, 0, 0] },
  { name: 'new-deployment-pending-pqr12', namespace: 'staging', status: 'Pending', ready: '0/1', restarts: 0, age: '5m', node: '-', cpu: '-', memory: '-', containers: [{ name: 'app', ports: [{ containerPort: 8080 }] }] },
  { name: 'etcd-0', namespace: 'kube-system', status: 'Running', ready: '1/1', restarts: 0, age: '90d', node: 'control-plane-1', cpu: '50m', memory: '256Mi', containers: [{ name: 'etcd', ports: [{ containerPort: 2379, name: 'client' }, { containerPort: 2380, name: 'peer' }] }], cpuData: [45, 50, 55, 48, 52, 58, 50, 45, 55, 52, 48, 50, 55, 48, 52, 58, 50, 45, 55, 50], memoryData: [250, 255, 260, 258, 262, 255, 258, 252, 260, 256, 254, 258, 262, 255, 258, 260, 254, 256, 260, 256] },
  { name: 'coredns-6d4b75cb6d-stu34', namespace: 'kube-system', status: 'Running', ready: '1/1', restarts: 0, age: '60d', node: 'control-plane-1', cpu: '5m', memory: '32Mi', containers: [{ name: 'coredns', ports: [{ containerPort: 53, name: 'dns' }] }], cpuData: [4, 5, 6, 5, 4, 6, 5, 4, 5, 6, 5, 4, 6, 5, 4, 5, 6, 5, 4, 5], memoryData: [30, 32, 34, 31, 33, 32, 30, 34, 31, 33, 32, 30, 34, 31, 33, 32, 30, 34, 31, 32] },
  { name: 'kube-proxy-xyz45', namespace: 'kube-system', status: 'Running', ready: '1/1', restarts: 0, age: '90d', node: 'worker-node-1', cpu: '10m', memory: '48Mi', containers: [{ name: 'kube-proxy' }], cpuData: [8, 10, 12, 9, 11, 10, 8, 12, 10, 9, 11, 8, 10, 12, 9, 11, 10, 8, 12, 10], memoryData: [45, 48, 50, 47, 49, 48, 45, 50, 48, 47, 49, 45, 48, 50, 47, 49, 48, 45, 50, 48] },
  { name: 'metrics-server-abc67', namespace: 'kube-system', status: 'Running', ready: '1/1', restarts: 2, age: '30d', node: 'control-plane-1', cpu: '15m', memory: '64Mi', containers: [{ name: 'metrics-server', ports: [{ containerPort: 443, name: 'https' }] }], cpuData: [12, 15, 18, 14, 16, 15, 12, 18, 15, 14, 16, 12, 15, 18, 14, 16, 15, 12, 18, 15], memoryData: [60, 64, 68, 62, 66, 64, 60, 68, 64, 62, 66, 60, 64, 68, 62, 66, 64, 60, 68, 64] },
];

const statusConfig = {
  Running: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Pending: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Failed: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
  Succeeded: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
  CrashLoopBackOff: { icon: AlertTriangle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

function transformPodResource(resource: PodResource): Pod {
  const containerStatuses = resource.status?.containerStatuses || [];
  const readyCount = containerStatuses.filter(c => c.ready).length;
  const totalCount = resource.spec?.containers?.length || containerStatuses.length || 1;
  const restarts = containerStatuses.reduce((sum, c) => sum + (c.restartCount || 0), 0);
  
  let status: Pod['status'] = 'Running';
  const phase = resource.status?.phase;
  if (phase === 'Pending') status = 'Pending';
  else if (phase === 'Failed') status = 'Failed';
  else if (phase === 'Succeeded') status = 'Succeeded';
  else if (containerStatuses.some(c => !c.ready && (c as any).state?.waiting?.reason === 'CrashLoopBackOff')) {
    status = 'CrashLoopBackOff';
  }

  return {
    name: resource.metadata.name,
    namespace: resource.metadata.namespace || 'default',
    status,
    ready: `${readyCount}/${totalCount}`,
    restarts,
    age: calculateAge(resource.metadata.creationTimestamp),
    node: resource.spec?.nodeName || '-',
    cpu: '-',
    memory: '-',
    containers: resource.spec?.containers || [],
  };
}

type SortKey = 'name' | 'namespace' | 'status' | 'restarts' | 'age';
type ViewMode = 'all' | 'running' | 'pending' | 'failed';

export default function Pods() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; pod: Pod | null; bulk?: boolean }>({ open: false, pod: null });
  const [portForwardDialog, setPortForwardDialog] = useState<{ open: boolean; pod: Pod | null }>({ open: false, pod: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedPods, setSelectedPods] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<PodResource>('pods');
  const deletePod = useDeleteK8sResource('pods');
  
  // Transform API data or use mock data
  const pods: Pod[] = config.isConnected && data?.items
    ? data.items.map(transformPodResource)
    : mockPods;

  // Calculate stats
  const stats = useMemo(() => ({
    total: pods.length,
    running: pods.filter(p => p.status === 'Running').length,
    pending: pods.filter(p => p.status === 'Pending').length,
    failed: pods.filter(p => p.status === 'Failed' || p.status === 'CrashLoopBackOff').length,
  }), [pods]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(pods.map((p) => p.namespace)))];
  }, [pods]);

  const filteredPods = useMemo(() => {
    let result = pods.filter((pod) => {
      const matchesSearch = pod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           pod.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || pod.namespace === selectedNamespace;
      
      let matchesView = true;
      if (viewMode === 'running') matchesView = pod.status === 'Running';
      else if (viewMode === 'pending') matchesView = pod.status === 'Pending';
      else if (viewMode === 'failed') matchesView = pod.status === 'Failed' || pod.status === 'CrashLoopBackOff';
      
      return matchesSearch && matchesNamespace && matchesView;
    });

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'namespace':
          comparison = a.namespace.localeCompare(b.namespace);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'restarts':
          comparison = a.restarts - b.restarts;
          break;
        case 'age':
          comparison = a.age.localeCompare(b.age);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [pods, searchQuery, selectedNamespace, viewMode, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedPods.size > 0) {
      // Bulk delete
      if (config.isConnected) {
        for (const podKey of selectedPods) {
          const [namespace, name] = podKey.split('/');
          await deletePod.mutateAsync({ name, namespace });
        }
      } else {
        toast.success(`Deleted ${selectedPods.size} pods (demo mode)`);
      }
      setSelectedPods(new Set());
    } else if (deleteDialog.pod) {
      // Single delete
      if (config.isConnected) {
        await deletePod.mutateAsync({
          name: deleteDialog.pod.name,
          namespace: deleteDialog.pod.namespace,
        });
      } else {
        toast.success(`Pod ${deleteDialog.pod.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, pod: null });
  };

  const handleViewLogs = (pod: Pod) => {
    navigate(`/pods/${pod.namespace}/${pod.name}?tab=logs`);
  };

  const handleExecShell = (pod: Pod) => {
    navigate(`/pods/${pod.namespace}/${pod.name}?tab=terminal`);
  };

  const handleDownloadYaml = (pod: Pod) => {
    const yaml = `apiVersion: v1
kind: Pod
metadata:
  name: ${pod.name}
  namespace: ${pod.namespace}
spec:
  containers:
${pod.containers.map(c => `  - name: ${c.name}
    image: nginx:latest`).join('\n')}
`;
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pod.name}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  };

  const handleExportAll = () => {
    const podsToExport = selectedPods.size > 0 
      ? filteredPods.filter(p => selectedPods.has(`${p.namespace}/${p.name}`))
      : filteredPods;
    const exportData = podsToExport.map(p => ({
      name: p.name,
      namespace: p.namespace,
      status: p.status,
      ready: p.ready,
      restarts: p.restarts,
      age: p.age,
      node: p.node,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pods-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${podsToExport.length} pods`);
  };

  // Bulk actions
  const togglePodSelection = (pod: Pod) => {
    const key = `${pod.namespace}/${pod.name}`;
    const newSelection = new Set(selectedPods);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedPods(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedPods.size === filteredPods.length) {
      setSelectedPods(new Set());
    } else {
      setSelectedPods(new Set(filteredPods.map(p => `${p.namespace}/${p.name}`)));
    }
  };

  const handleBulkRestart = () => {
    if (selectedPods.size === 0) return;
    toast.success(`Restarted ${selectedPods.size} pods (demo mode)`);
    setSelectedPods(new Set());
  };

  const handleBulkExportYaml = () => {
    const podsToExport = filteredPods.filter(p => selectedPods.has(`${p.namespace}/${p.name}`));
    const yamls = podsToExport.map(pod => `---
apiVersion: v1
kind: Pod
metadata:
  name: ${pod.name}
  namespace: ${pod.namespace}
spec:
  containers:
${pod.containers.map(c => `  - name: ${c.name}
    image: nginx:latest`).join('\n')}
`).join('\n');
    
    const blob = new Blob([yamls], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pods-bulk.yaml';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${podsToExport.length} pod YAMLs`);
  };

  const isAllSelected = filteredPods.length > 0 && selectedPods.size === filteredPods.length;
  const isSomeSelected = selectedPods.size > 0 && selectedPods.size < filteredPods.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Box className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Pods</h1>
            <p className="text-sm text-muted-foreground">
              {filteredPods.length} pods across {namespaces.length - 1} namespaces
              {!config.isConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                  <WifiOff className="h-3 w-3" /> Demo mode
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowComparison(true)}>
            <GitCompare className="h-4 w-4" />
            Compare
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download className="h-4 w-4" />
            {selectedPods.size > 0 ? `Export (${selectedPods.size})` : 'Export'}
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}>
            <Plus className="h-4 w-4" />
            Create Pod
          </Button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedPods.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedPods.size} selected
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPods(new Set())}>
              Clear selection
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkRestart}>
              <RotateCcw className="h-4 w-4" />
              Restart
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkExportYaml}>
              <Download className="h-4 w-4" />
              Export YAML
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowComparison(true)}>
              <GitCompare className="h-4 w-4" />
              Compare
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-1.5"
              onClick={() => setDeleteDialog({ open: true, pod: null, bulk: true })}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className={cn('cursor-pointer transition-all', viewMode === 'all' && 'ring-2 ring-primary')} onClick={() => setViewMode('all')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pods</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Box className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'running' && 'ring-2 ring-[hsl(142,76%,36%)]')} onClick={() => setViewMode('running')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.running}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-[hsl(142,76%,36%)] opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'pending' && 'ring-2 ring-[hsl(45,93%,47%)]')} onClick={() => setViewMode('pending')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-[hsl(45,93%,47%)] opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'failed' && 'ring-2 ring-[hsl(0,72%,51%)]')} onClick={() => setViewMode('failed')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-[hsl(0,72%,51%)]">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-[hsl(0,72%,51%)] opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pods by name or namespace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              {selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {namespaces.map((ns) => (
              <DropdownMenuItem 
                key={ns} 
                onClick={() => setSelectedNamespace(ns)}
                className={cn(selectedNamespace === ns && 'bg-accent')}
              >
                {ns === 'all' ? 'All Namespaces' : ns}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleAllSelection}
                  aria-label="Select all"
                  className={cn(isSomeSelected && 'data-[state=checked]:bg-primary/50')}
                />
              </TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('name')}>
                  Name
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('namespace')}>
                  Namespace
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('status')}>
                  Status
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">Ready</TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('restarts')}>
                  Restarts
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="font-semibold">CPU</TableHead>
              <TableHead className="font-semibold">Memory</TableHead>
              <TableHead className="font-semibold">
                <Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('age')}>
                  Age
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && config.isConnected ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading pods...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Box className="h-8 w-8 opacity-50" />
                    <p>No pods found</p>
                    {(searchQuery || viewMode !== 'all') && (
                      <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setViewMode('all'); }}>
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPods.map((pod, index) => {
                const StatusIcon = statusConfig[pod.status]?.icon || Clock;
                const statusStyle = statusConfig[pod.status] || statusConfig.Pending;
                const podKey = `${pod.namespace}/${pod.name}`;
                const isSelected = selectedPods.has(podKey);
                return (
                  <motion.tr
                    key={podKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className={cn(
                      'group cursor-pointer border-b border-border hover:bg-muted/50',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePodSelection(pod)}
                        aria-label={`Select ${pod.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/pods/${pod.namespace}/${pod.name}`}
                        className="font-medium text-primary hover:underline flex items-center gap-2"
                      >
                        <Box className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{pod.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {pod.namespace}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                        statusStyle.bg,
                        statusStyle.color
                      )}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {pod.status}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{pod.ready}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'font-medium',
                        pod.restarts > 5 && 'text-[hsl(0,72%,51%)]',
                        pod.restarts > 0 && pod.restarts <= 5 && 'text-[hsl(45,93%,47%)]'
                      )}>
                        {pod.restarts}
                      </span>
                    </TableCell>
                    <TableCell>
                      {pod.cpuData ? (
                        <div className="flex items-center gap-2">
                          <Sparkline data={pod.cpuData} width={50} height={18} color="hsl(var(--primary))" showLive />
                          <span className="text-xs font-medium">{pod.cpu}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {pod.memoryData ? (
                        <div className="flex items-center gap-2">
                          <Sparkline data={pod.memoryData} width={50} height={18} color="hsl(142, 76%, 36%)" showLive />
                          <span className="text-xs font-medium">{pod.memory}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{pod.age}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleViewLogs(pod)} className="gap-2">
                            <FileText className="h-4 w-4" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExecShell(pod)} className="gap-2">
                            <Terminal className="h-4 w-4" />
                            Exec Shell
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPortForwardDialog({ open: true, pod })} className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            Port Forward
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDownloadYaml(pod)} className="gap-2">
                            <Download className="h-4 w-4" />
                            Download YAML
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-[hsl(0,72%,51%)]"
                            onClick={() => setDeleteDialog({ open: true, pod })}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete Pod
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Pod */}
      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Pod"
          defaultYaml={DEFAULT_YAMLS.Pod}
          onClose={() => setShowCreateWizard(false)}
          onApply={(yaml) => {
            console.log('Creating Pod with YAML:', yaml);
            toast.success('Pod created successfully (demo mode)');
            setShowCreateWizard(false);
            refetch();
          }}
          clusterName="docker-desktop"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, pod: open ? deleteDialog.pod : null })}
        resourceType="Pod"
        resourceName={deleteDialog.bulk ? `${selectedPods.size} pods` : (deleteDialog.pod?.name || '')}
        namespace={deleteDialog.bulk ? undefined : deleteDialog.pod?.namespace}
        onConfirm={handleDelete}
      />

      {/* Port Forward Dialog */}
      {portForwardDialog.pod && (
        <PortForwardDialog
          open={portForwardDialog.open}
          onOpenChange={(open) => setPortForwardDialog({ open, pod: open ? portForwardDialog.pod : null })}
          podName={portForwardDialog.pod.name}
          namespace={portForwardDialog.pod.namespace}
          containers={portForwardDialog.pod.containers}
        />
      )}

      {/* Pod Comparison View */}
      <PodComparisonView
        open={showComparison}
        onClose={() => setShowComparison(false)}
        availablePods={filteredPods.map(p => ({ name: p.name, namespace: p.namespace, status: p.status }))}
      />
    </motion.div>
  );
}
