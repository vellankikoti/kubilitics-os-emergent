import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, RefreshCw, MoreHorizontal, CheckCircle2, XCircle, Clock, Loader2, WifiOff, Plus,
  ChevronDown, ChevronLeft, ChevronRight, Trash2, RotateCcw, Scale, History, Rocket, FileText,
  List, Layers, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { resourceTableRowClassName, ROW_MOTION, StatusPill, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, type StatusPillVariant } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { useWorkloadMetricsMap } from '@/hooks/useWorkloadMetricsMap';
import { ResizableTableProvider, ResizableTableHead, ResizableTableCell, type ResizableColumnConfig } from '@/components/ui/resizable-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useK8sResourceList, useDeleteK8sResource, useCreateK8sResource, usePatchK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { applyManifest, CONFIRM_DESTRUCTIVE_HEADER, getDeploymentRolloutHistory, getEvents, postDeploymentRollback } from '@/services/backendApiClient';
import { DeleteConfirmDialog, ScaleDialog, RolloutActionsDialog, UsageBar, parseCpu, parseMemory } from '@/components/resources';
import { ResourceCommandBar, ResourceExportDropdown, ListViewSegmentedControl } from '@/components/list';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DeploymentIcon } from '@/components/icons/KubernetesIcons';

interface DeploymentResource extends KubernetesResource {
  spec: {
    replicas: number;
    strategy?: { type: string; rollingUpdate?: { maxSurge?: string; maxUnavailable?: string } };
    template?: { spec?: { containers?: Array<{ name: string; image: string }> } };
  };
  status: { replicas?: number; readyReplicas?: number; updatedReplicas?: number; availableReplicas?: number; conditions?: Array<{ type: string; status: string }> };
  metadata: KubernetesResource['metadata'] & { annotations?: Record<string, string> };
}

interface Deployment {
  name: string;
  namespace: string;
  status: 'Healthy' | 'Progressing' | 'Degraded';
  ready: string;
  upToDate: number;
  available: number;
  strategy: string;
  age: string;
  replicas: number;
  revision: string;
  images: string[];
  maxSurge: string;
  maxUnavailable: string;
  cpu: string;
  memory: string;
}

const DEPLOYMENTS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'namespace', defaultWidth: 130, minWidth: 80 },
  { id: 'status', defaultWidth: 110, minWidth: 70 },
  { id: 'ready', defaultWidth: 80, minWidth: 50 },
  { id: 'upToDate', defaultWidth: 90, minWidth: 50 },
  { id: 'available', defaultWidth: 90, minWidth: 50 },
  { id: 'strategy', defaultWidth: 110, minWidth: 70 },
  { id: 'maxSurge', defaultWidth: 90, minWidth: 60 },
  { id: 'maxUnavailable', defaultWidth: 110, minWidth: 70 },
  { id: 'revision', defaultWidth: 80, minWidth: 50 },
  { id: 'images', defaultWidth: 180, minWidth: 100 },
  { id: 'cpu', defaultWidth: 110, minWidth: 80 },
  { id: 'memory', defaultWidth: 120, minWidth: 80 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

const statusConfig = {
  Healthy: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Progressing: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Degraded: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

const deploymentStatusToVariant: Record<Deployment['status'], StatusPillVariant> = {
  Healthy: 'success',
  Progressing: 'warning',
  Degraded: 'error',
};

function parseReadyFraction(ready: string): number {
  const m = ready.match(/^(\d+)\/(\d+)$/);
  if (!m) return 100;
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  return den > 0 ? Math.round((num / den) * 100) : 0;
}

function transformResource(resource: DeploymentResource): Deployment {
  const desired = resource.spec?.replicas ?? 0;
  const ready = resource.status?.readyReplicas ?? 0;
  const available = resource.status?.availableReplicas ?? 0;

  let status: Deployment['status'] = 'Healthy';
  if (ready === 0 && desired > 0) status = 'Degraded';
  else if (ready < desired) status = 'Progressing';

  const annotations = resource.metadata?.annotations ?? {};
  const revision = annotations['deployment.kubernetes.io/revision'] ?? '-';
  const containers = resource.spec?.template?.spec?.containers ?? [];
  const images = containers.map((c) => c.image);
  const rolling = resource.spec?.strategy?.rollingUpdate;
  const maxSurge = rolling?.maxSurge ?? '-';
  const maxUnavailable = rolling?.maxUnavailable ?? '-';

  return {
    name: resource.metadata.name,
    namespace: resource.metadata.namespace || 'default',
    status,
    ready: `${ready}/${desired}`,
    upToDate: resource.status?.updatedReplicas ?? 0,
    available,
    strategy: resource.spec?.strategy?.type || 'RollingUpdate',
    age: calculateAge(resource.metadata.creationTimestamp),
    replicas: desired,
    revision,
    images,
    maxSurge,
    maxUnavailable,
    cpu: '-',
    memory: '-',
  };
}

type ListView = 'flat' | 'byNamespace';

export default function Deployments() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Deployment | null; bulk?: boolean }>({ open: false, item: null });
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; item: Deployment | null }>({ open: false, item: null });
  const [rolloutDialog, setRolloutDialog] = useState<{ open: boolean; item: Deployment | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [listView, setListView] = useState<ListView>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = useK8sResourceList<DeploymentResource>('deployments', undefined, { limit: 5000 });
  const deleteResource = useDeleteK8sResource('deployments');
  const createResource = useCreateK8sResource('deployments');
  const patchDeployment = usePatchK8sResource('deployments');
  const backendBaseUrl = getEffectiveBackendBaseUrl(useBackendConfigStore((s) => s.backendBaseUrl));
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const clusterId = useClusterStore((s) => s.activeCluster)?.id ?? useBackendConfigStore((s) => s.currentClusterId);

  const items: Deployment[] = isConnected && data
    ? (data.items ?? []).map(transformResource)
    : [];

  const rolloutDialogItem = rolloutDialog.item;
  const rolloutHistoryQuery = useQuery({
    queryKey: ['backend', 'deployment-rollout-history', clusterId, rolloutDialogItem?.namespace, rolloutDialogItem?.name],
    queryFn: () => getDeploymentRolloutHistory(backendBaseUrl!, clusterId!, rolloutDialogItem!.namespace, rolloutDialogItem!.name),
    enabled: !!(rolloutDialog.open && rolloutDialogItem && isBackendConfigured() && clusterId),
    staleTime: 10_000,
  });
  const rolloutRevisionsForDialog = useMemo(() => {
    const revs = rolloutHistoryQuery.data?.revisions ?? [];
    const currentRev = rolloutDialogItem?.revision;
    return revs.map((r) => ({
      revision: r.revision,
      createdAt: r.creationTimestamp ? new Date(r.creationTimestamp).toLocaleString() : '—',
      current: currentRev != null && String(r.revision) === currentRev,
      changeReason: r.changeCause || undefined,
    }));
  }, [rolloutHistoryQuery.data?.revisions, rolloutDialogItem?.revision]);

  const eventsForScaleCount = useQuery({
    queryKey: ['backend', 'events', clusterId, selectedNamespace],
    queryFn: () => getEvents(backendBaseUrl!, clusterId!, { namespace: selectedNamespace === 'all' ? undefined : selectedNamespace, limit: 300 }),
    enabled: !!(isBackendConfigured() && clusterId && selectedNamespace !== 'all'),
    staleTime: 60_000,
  });
  const scaleEvents24h = useMemo(() => {
    const events = eventsForScaleCount.data ?? [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter((e) => {
      const reason = (e.reason ?? '').toLowerCase();
      const ts = e.last_timestamp || e.first_timestamp;
      const t = ts ? new Date(ts).getTime() : 0;
      return (reason.includes('scaling') || reason === 'scalingreplicaset') && t >= cutoff;
    }).length;
  }, [eventsForScaleCount.data]);

  const stats = useMemo(() => ({
    total: items.length,
    available: items.filter((i) => i.status === 'Healthy').length,
    progressing: items.filter((i) => i.status === 'Progressing').length,
    degraded: items.filter((i) => i.status === 'Degraded').length,
    rollingUpdates: items.filter((i) => i.status === 'Progressing').length,
    scaleEvents24h: selectedNamespace === 'all' ? 0 : scaleEvents24h,
  }), [items, selectedNamespace, scaleEvents24h]);

  const namespaces = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.namespace)))], [items]);

  const itemsAfterSearchAndNs = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || item.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });
  }, [items, searchQuery, selectedNamespace]);

  const deploymentsTableConfig: ColumnConfig<Deployment>[] = useMemo(() => {
    const parseReady = (ready: string): number => {
      const m = ready.match(/^(\d+)\/(\d+)$/);
      if (!m) return -1;
      const den = parseInt(m[2], 10);
      return den > 0 ? parseInt(m[1], 10) / den : -1;
    };
    return [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
      { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
      { columnId: 'ready', getValue: (i) => i.ready, sortable: true, filterable: false, compare: (a, b) => parseReady(a.ready) - parseReady(b.ready) },
      { columnId: 'upToDate', getValue: (i) => i.upToDate, sortable: true, filterable: false },
      { columnId: 'available', getValue: (i) => i.available, sortable: true, filterable: false },
      { columnId: 'strategy', getValue: (i) => i.strategy, sortable: true, filterable: true },
      { columnId: 'maxSurge', getValue: (i) => i.maxSurge, sortable: true, filterable: false },
      { columnId: 'maxUnavailable', getValue: (i) => i.maxUnavailable, sortable: true, filterable: false },
      { columnId: 'revision', getValue: (i) => i.revision, sortable: true, filterable: false },
      { columnId: 'images', getValue: (i) => (i.images?.length ? i.images.join(', ') : '-'), sortable: true, filterable: false },
      { columnId: 'cpu', getValue: (i) => i.cpu, sortable: true, filterable: false },
      { columnId: 'memory', getValue: (i) => i.memory, sortable: true, filterable: false },
      { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
    ];
  }, []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(itemsAfterSearchAndNs, { columns: deploymentsTableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = filteredItems.slice(start, start + pageSize);

  const metricsEntries = useMemo(
    () => itemsOnPage.map((i) => ({ namespace: i.namespace, name: i.name })),
    [itemsOnPage]
  );
  const { metricsMap } = useWorkloadMetricsMap('deployment', metricsEntries);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const pagination = {
    rangeLabel: totalFiltered > 0
      ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}`
      : 'No deployments',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const groupedOnPage = useMemo(() => {
    if (listView !== 'byNamespace' || itemsOnPage.length === 0) return [];
    const map = new Map<string, Deployment[]>();
    for (const item of itemsOnPage) {
      const list = map.get(item.namespace) ?? [];
      list.push(item);
      map.set(item.namespace, list);
    }
    return Array.from(map.entries())
      .map(([label, deployments]) => ({ groupKey: `ns:${label}`, label, deployments }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [listView, itemsOnPage]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!isConnected) {
      toast.error('Connect cluster to delete deployments');
      return;
    }
    if (deleteDialog.bulk && selectedItems.size > 0) {
      for (const key of selectedItems) {
        const [ns, n] = key.split('/');
        await deleteResource.mutateAsync({ name: n, namespace: ns });
      }
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: deleteDialog.item.namespace });
    }
    setDeleteDialog({ open: false, item: null });
  };

  const deploymentExportConfig = {
    filenamePrefix: 'deployments',
    resourceLabel: 'deployments',
    getExportData: (d: Deployment) => ({ name: d.name, namespace: d.namespace, status: d.status, ready: d.ready, upToDate: d.upToDate, available: d.available, strategy: d.strategy, age: d.age, replicas: d.replicas }),
    csvColumns: [
      { label: 'Name', getValue: (d: Deployment) => d.name },
      { label: 'Namespace', getValue: (d: Deployment) => d.namespace },
      { label: 'Status', getValue: (d: Deployment) => d.status },
      { label: 'Ready', getValue: (d: Deployment) => d.ready },
      { label: 'Up to date', getValue: (d: Deployment) => d.upToDate },
      { label: 'Available', getValue: (d: Deployment) => d.available },
      { label: 'Strategy', getValue: (d: Deployment) => d.strategy },
      { label: 'Age', getValue: (d: Deployment) => d.age },
      { label: 'Replicas', getValue: (d: Deployment) => d.replicas },
    ],
    toK8sYaml: (d: Deployment) => `---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${d.name}
  namespace: ${d.namespace}
spec:
  replicas: ${d.replicas}
  strategy:
    type: ${d.strategy}
  selector:
    matchLabels: {}
  template:
    metadata:
      labels: {}
    spec:
      containers: []
`,
  };

  const toggleSelection = (item: Deployment) => {
    const key = `${item.namespace}/${item.name}`;
    const newSel = new Set(selectedItems);
    if (newSel.has(key)) newSel.delete(key); else newSel.add(key);
    setSelectedItems(newSel);
  };

  const toggleAll = () => {
    if (selectedItems.size === itemsOnPage.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(itemsOnPage.map(i => `${i.namespace}/${i.name}`)));
  };

  const handleBulkRestart = () => {
    if (!isConnected) {
      toast.error('Connect cluster to restart deployments');
      return;
    }
    toast.info(`Restarting ${selectedItems.size} deployments…`);
    setSelectedItems(new Set());
  };

  const isAllSelected = itemsOnPage.length > 0 && selectedItems.size === itemsOnPage.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < itemsOnPage.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-primary/10"><DeploymentIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} deployments across {namespaces.length - 1} namespaces
              {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
            </p>
          </div>
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedItems(new Set())}>Clear</Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ResourceExportDropdown
            items={filteredItems}
            selectedKeys={selectedItems}
            getKey={(i) => `${i.namespace}/${i.name}`}
            config={deploymentExportConfig}
            selectionLabel={selectedItems.size > 0 ? 'Selected deployments' : 'All visible deployments'}
            onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
          />
          {selectedItems.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}><Trash2 className="h-4 w-4" />Delete</Button>
          )}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" />Create Deployment</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <ListPageStatCard label="Total" value={stats.total} icon={DeploymentIcon} iconColor="text-primary" selected={!columnFilters.status?.size} onClick={() => setColumnFilter('status', null)} className={cn(!columnFilters.status?.size && 'ring-2 ring-primary')} />
        <ListPageStatCard label="Available" value={stats.available} icon={CheckCircle2} iconColor="text-[hsl(142,76%,36%)]" valueClassName="text-[hsl(142,76%,36%)]" selected={columnFilters.status?.size === 1 && columnFilters.status.has('Healthy')} onClick={() => setColumnFilter('status', new Set(['Healthy']))} className={cn(columnFilters.status?.size === 1 && columnFilters.status.has('Healthy') && 'ring-2 ring-[hsl(142,76%,36%)]')} />
        <ListPageStatCard label="Progressing" value={stats.progressing} icon={Clock} iconColor="text-[hsl(45,93%,47%)]" valueClassName="text-[hsl(45,93%,47%)]" selected={columnFilters.status?.size === 1 && columnFilters.status.has('Progressing')} onClick={() => setColumnFilter('status', new Set(['Progressing']))} className={cn(columnFilters.status?.size === 1 && columnFilters.status.has('Progressing') && 'ring-2 ring-[hsl(45,93%,47%)]')} />
        <ListPageStatCard label="Degraded" value={stats.degraded} icon={XCircle} iconColor="text-[hsl(0,72%,51%)]" valueClassName="text-[hsl(0,72%,51%)]" selected={columnFilters.status?.size === 1 && columnFilters.status.has('Degraded')} onClick={() => setColumnFilter('status', new Set(['Degraded']))} className={cn(columnFilters.status?.size === 1 && columnFilters.status.has('Degraded') && 'ring-2 ring-[hsl(0,72%,51%)]')} />
        <ListPageStatCard label="Rolling Updates" value={stats.rollingUpdates} icon={Rocket} iconColor="text-purple-500" valueClassName="text-purple-600" selected={columnFilters.status?.size === 1 && columnFilters.status.has('Progressing')} onClick={() => setColumnFilter('status', new Set(['Progressing']))} className={cn(columnFilters.status?.size === 1 && columnFilters.status.has('Progressing') && 'ring-2 ring-purple-500')} />
        <ListPageStatCard label="Scale Events (24h)" value={stats.scaleEvents24h} icon={Activity} iconColor="text-cyan-500" valueClassName="text-cyan-600" />
      </div>

      <ResourceCommandBar
        scope={
          <div className="w-full min-w-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full min-w-0 justify-between h-10 gap-2 rounded-lg border border-border bg-background font-medium shadow-sm hover:bg-muted/50 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/20">
                  <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
        }
        search={
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deployments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
              aria-label="Search deployments"
            />
          </div>
        }
        structure={
          <ListViewSegmentedControl
            value={listView}
            onChange={(v) => setListView(v as ListView)}
            options={[
              { id: 'flat', label: 'Flat', icon: List },
              { id: 'byNamespace', label: 'By Namespace', icon: Layers },
            ]}
            label=""
            ariaLabel="List structure"
          />
        }
        className="mb-2"
      />

      <div className="border border-border rounded-xl overflow-x-auto bg-card">
        <ResizableTableProvider tableId="deployments" columnConfig={DEPLOYMENTS_TABLE_COLUMNS}>
          <Table className="table-fixed" style={{ minWidth: 1650 }}>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                <TableHead className="w-10"><Checkbox checked={isAllSelected} onCheckedChange={toggleAll} className={cn(isSomeSelected && 'data-[state=checked]:bg-primary/50')} /></TableHead>
                <ResizableTableHead columnId="name">
                  <TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="namespace">
                  <TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} />
                </ResizableTableHead>
                <ResizableTableHead columnId="status">
                  <TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} />
                </ResizableTableHead>
                <ResizableTableHead columnId="ready">
                  <TableColumnHeaderWithFilterAndSort columnId="ready" label="Ready" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="upToDate">
                  <TableColumnHeaderWithFilterAndSort columnId="upToDate" label="Up-to-date" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="available">
                  <TableColumnHeaderWithFilterAndSort columnId="available" label="Available" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="strategy">
                  <TableColumnHeaderWithFilterAndSort columnId="strategy" label="Strategy" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.strategy ?? []} selectedFilterValues={columnFilters.strategy ?? new Set()} onFilterChange={setColumnFilter} />
                </ResizableTableHead>
                <ResizableTableHead columnId="maxSurge">
                  <TableColumnHeaderWithFilterAndSort columnId="maxSurge" label="Max Surge" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="maxUnavailable">
                  <TableColumnHeaderWithFilterAndSort columnId="maxUnavailable" label="Max Unavailable" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="revision">
                  <TableColumnHeaderWithFilterAndSort columnId="revision" label="Revision" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="images">
                  <TableColumnHeaderWithFilterAndSort columnId="images" label="Images" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="cpu" title="CPU">
                  <TableColumnHeaderWithFilterAndSort columnId="cpu" label="CPU" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="memory" title="Memory">
                  <TableColumnHeaderWithFilterAndSort columnId="memory" label="Memory" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <ResizableTableHead columnId="age">
                  <TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                </ResizableTableHead>
                <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && isConnected ? (
                <TableRow><TableCell colSpan={15} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Rocket className="h-8 w-8 opacity-50" /><p>No deployments found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
              ) : listView === 'flat' ? (
                itemsOnPage.map((item, idx) => {
                  const StatusIcon = statusConfig[item.status]?.icon || Clock;
                  const style = statusConfig[item.status];
                  const key = `${item.namespace}/${item.name}`;
                  const isSelected = selectedItems.has(key);
                  const cpuVal = metricsMap[key]?.cpu ?? '-';
                  const memVal = metricsMap[key]?.memory ?? '-';
                  const cpuNum = parseCpu(cpuVal);
                  const memNum = parseMemory(memVal);
                  const cpuDataPoints = cpuNum != null ? Array(12).fill(cpuNum) : undefined;
                  const memDataPoints = memNum != null ? Array(12).fill(memNum) : undefined;
                  return (
                    <motion.tr key={key} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}>
                      <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item)} /></TableCell>
                      <ResizableTableCell columnId="name"><Link to={`/deployments/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate"><DeploymentIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{item.name}</span></Link></ResizableTableCell>
                      <ResizableTableCell columnId="namespace"><Badge variant="outline" className="font-normal truncate block w-fit max-w-full">{item.namespace}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="status"><StatusPill label={item.status} variant={deploymentStatusToVariant[item.status]} icon={StatusIcon} /></ResizableTableCell>
                      <ResizableTableCell columnId="ready" className="font-mono text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <Progress value={parseReadyFraction(item.ready)} className="h-1.5 w-10 flex-shrink-0" />
                          <span className="tabular-nums">{item.ready}</span>
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="upToDate" className="font-mono text-sm">{item.upToDate}</ResizableTableCell>
                      <ResizableTableCell columnId="available" className="font-mono text-sm">{item.available}</ResizableTableCell>
                      <ResizableTableCell columnId="strategy"><Badge variant="secondary" className="font-mono text-xs truncate block w-fit max-w-full">{item.strategy}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="maxSurge" className="font-mono text-xs">{item.maxSurge}</ResizableTableCell>
                      <ResizableTableCell columnId="maxUnavailable" className="font-mono text-xs">{item.maxUnavailable}</ResizableTableCell>
                      <ResizableTableCell columnId="revision" className="font-mono text-xs">{item.revision}</ResizableTableCell>
                      <ResizableTableCell columnId="images" className="text-xs truncate max-w-[180px]" title={item.images.join(', ')}>{item.images.length ? item.images.join(', ') : '-'}</ResizableTableCell>
                      <ResizableTableCell columnId="cpu">
                        <div className="min-w-0 overflow-hidden">
                          <UsageBar variant="sparkline" value={cpuVal} kind="cpu" dataPoints={cpuDataPoints} displayFormat="compact" width={56} />
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="memory">
                        <div className="min-w-0 overflow-hidden">
                          <UsageBar variant="sparkline" value={memVal} kind="memory" dataPoints={memDataPoints} displayFormat="compact" width={56} />
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="Deployment actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => navigate(`/deployments/${item.namespace}/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/pods?namespace=${item.namespace}&deployment=${item.name}`)} className="gap-2">View Pods</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setScaleDialog({ open: true, item })} className="gap-2" disabled={!isConnected}><Scale className="h-4 w-4" />Scale</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRolloutDialog({ open: true, item })} className="gap-2" disabled={!isConnected}><History className="h-4 w-4" />Rollout Actions</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/deployments/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />Download YAML</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                );
              })
            ) : (
              groupedOnPage.flatMap((group) => {
                const isCollapsed = collapsedGroups.has(group.groupKey);
                return [
                  <TableRow key={group.groupKey} className="bg-muted/30 hover:bg-muted/40 cursor-pointer border-b border-border/60 transition-all duration-200" onClick={() => toggleGroup(group.groupKey)}>
                    <TableCell colSpan={15} className="py-2">
                      <div className="flex items-center gap-2 font-medium">
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                        Namespace: {group.label}
                        <span className="text-muted-foreground font-normal">({group.deployments.length})</span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(isCollapsed ? [] : group.deployments.map((item, idx) => {
                    const StatusIcon = statusConfig[item.status]?.icon || Clock;
                    const style = statusConfig[item.status];
                    const key = `${item.namespace}/${item.name}`;
                    const isSelected = selectedItems.has(key);
                    const cpuVal = metricsMap[key]?.cpu ?? '-';
                    const memVal = metricsMap[key]?.memory ?? '-';
                    const cpuNum = parseCpu(cpuVal);
                    const memNum = parseMemory(memVal);
                    const cpuDataPoints = cpuNum != null ? Array(12).fill(cpuNum) : undefined;
                    const memDataPoints = memNum != null ? Array(12).fill(memNum) : undefined;
                    return (
                      <motion.tr key={key} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}>
                        <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item)} /></TableCell>
                        <ResizableTableCell columnId="name"><Link to={`/deployments/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate"><DeploymentIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{item.name}</span></Link></ResizableTableCell>
                        <ResizableTableCell columnId="namespace"><Badge variant="outline" className="font-normal truncate block w-fit max-w-full">{item.namespace}</Badge></ResizableTableCell>
                        <ResizableTableCell columnId="status"><div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium truncate w-fit max-w-full', style.bg, style.color)}><StatusIcon className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{item.status}</span></div></ResizableTableCell>
                        <ResizableTableCell columnId="ready" className="font-mono text-sm">{item.ready}</ResizableTableCell>
                        <ResizableTableCell columnId="upToDate" className="font-mono text-sm">{item.upToDate}</ResizableTableCell>
                        <ResizableTableCell columnId="available" className="font-mono text-sm">{item.available}</ResizableTableCell>
                        <ResizableTableCell columnId="strategy"><Badge variant="secondary" className="font-mono text-xs truncate block w-fit max-w-full">{item.strategy}</Badge></ResizableTableCell>
                        <ResizableTableCell columnId="maxSurge" className="font-mono text-xs">{item.maxSurge}</ResizableTableCell>
                        <ResizableTableCell columnId="maxUnavailable" className="font-mono text-xs">{item.maxUnavailable}</ResizableTableCell>
                        <ResizableTableCell columnId="revision" className="font-mono text-xs">{item.revision}</ResizableTableCell>
                        <ResizableTableCell columnId="images" className="text-xs truncate max-w-[180px]" title={item.images.join(', ')}>{item.images.length ? item.images.join(', ') : '-'}</ResizableTableCell>
                        <ResizableTableCell columnId="cpu">
                          <div className="min-w-0 overflow-hidden">
                            <UsageBar variant="sparkline" value={cpuVal} kind="cpu" dataPoints={cpuDataPoints} displayFormat="compact" width={56} />
                          </div>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="memory">
                          <div className="min-w-0 overflow-hidden">
                            <UsageBar variant="sparkline" value={memVal} kind="memory" dataPoints={memDataPoints} displayFormat="compact" width={56} />
                          </div>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="Deployment actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/deployments/${item.namespace}/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/pods?namespace=${item.namespace}&deployment=${item.name}`)} className="gap-2">View Pods</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setScaleDialog({ open: true, item })} className="gap-2" disabled={!isConnected}><Scale className="h-4 w-4" />Scale</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRolloutDialog({ open: true, item })} className="gap-2" disabled={!isConnected}><History className="h-4 w-4" />Rollout Actions</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/deployments/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />Download YAML</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })),
                ];
              })
            )}
          </TableBody>
          </Table>
        </ResizableTableProvider>
      </div>

      <div className="pt-4 pb-2 border-t border-border mt-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{pagination.rangeLabel}</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {pageSize} per page
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <DropdownMenuItem
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={cn(pageSize === size && 'bg-accent')}
                  >
                    {size} per page
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ListPagination
            hasPrev={pagination.hasPrev}
            hasNext={pagination.hasNext}
            onPrev={pagination.onPrev}
            onNext={pagination.onNext}
            rangeLabel={undefined}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={pagination.onPageChange}
          />
        </div>
      </div>

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Deployment"
          defaultYaml={DEFAULT_YAMLS.Deployment}
          onClose={() => setShowCreateWizard(false)}
          onApply={async (yaml) => {
            if (!isConnected) {
              toast.error('Connect cluster to create deployments');
              return;
            }
            try {
              if (isBackendConfigured() && clusterId && backendBaseUrl) {
                const res = await fetch(`${backendBaseUrl.replace(/\/+$/, '')}/api/v1/clusters/${encodeURIComponent(clusterId)}/apply`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', [CONFIRM_DESTRUCTIVE_HEADER]: 'true' },
                  body: JSON.stringify({ yaml }),
                });
                if (!res.ok) throw new Error(await res.text());
                toast.success('Deployment created successfully');
              } else {
                await createResource.mutateAsync({ yaml });
              }
              setShowCreateWizard(false);
              refetch();
            } catch (e: any) {
              toast.error(e?.message || 'Failed to create deployment');
              throw e;
            }
          }}
          clusterName="docker-desktop"
        />
      )}
      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })} resourceType="Deployment" resourceName={deleteDialog.bulk ? `${selectedItems.size} deployments` : (deleteDialog.item?.name || '')} namespace={deleteDialog.bulk ? undefined : deleteDialog.item?.namespace} onConfirm={handleDelete} />
      {scaleDialog.item && (
        <ScaleDialog
          open={scaleDialog.open}
          onOpenChange={(open) => setScaleDialog({ open, item: open ? scaleDialog.item : null })}
          resourceType="Deployment"
          resourceName={scaleDialog.item.name}
          namespace={scaleDialog.item.namespace}
          currentReplicas={scaleDialog.item.replicas}
          onScale={async (r) => {
            if (!isConnected) {
              toast.error('Connect cluster to scale');
              return;
            }
            if (isBackendConfigured() && clusterId) {
              await patchDeployment.mutateAsync({
                name: scaleDialog.item!.name,
                namespace: scaleDialog.item!.namespace,
                patch: { spec: { replicas: r } },
              });
              toast.success(`Scaled ${scaleDialog.item?.name} to ${r} replicas`);
            } else {
              if (!isBackendConfigured()) {
                toast.error('Connect to Kubilitics backend in Settings to scale.');
              } else {
                toast.error('Select a cluster from the cluster list to perform this action.');
              }
            }
            setScaleDialog({ open: false, item: null });
            refetch();
          }}
        />
      )}
      {rolloutDialog.item && (
        <RolloutActionsDialog
          open={rolloutDialog.open}
          onOpenChange={(open) => setRolloutDialog({ open, item: open ? rolloutDialog.item : null })}
          resourceType="Deployment"
          resourceName={rolloutDialog.item.name}
          namespace={rolloutDialog.item.namespace}
          revisions={rolloutRevisionsForDialog}
          onRestart={async () => {
            if (!isConnected) {
              toast.error('Connect cluster to restart');
              return;
            }
            if (isBackendConfigured() && clusterId) {
              const restartedAt = new Date().toISOString();
              await patchDeployment.mutateAsync({
                name: rolloutDialog.item!.name,
                namespace: rolloutDialog.item!.namespace,
                patch: {
                  spec: {
                    template: {
                      metadata: {
                        annotations: { 'kubectl.kubernetes.io/restartedAt': restartedAt },
                      },
                    },
                  },
                },
              });
              toast.success(`Restarted ${rolloutDialog.item?.name}`);
            } else {
              if (!isBackendConfigured()) {
                toast.error('Connect to Kubilitics backend in Settings to restart.');
              } else {
                toast.error('Select a cluster from the cluster list to perform this action.');
              }
            }
            setRolloutDialog({ open: false, item: null });
            refetch();
          }}
          onRollback={async (rev) => {
            if (!isConnected) {
              toast.error('Connect cluster to rollback');
              return;
            }
            if (!isBackendConfigured() || !clusterId) {
              toast.error('Connect to Kubilitics backend and select a cluster to rollback.');
              return;
            }
            try {
              await postDeploymentRollback(backendBaseUrl, clusterId, rolloutDialog.item!.namespace, rolloutDialog.item!.name, { revision: rev });
              toast.success(`Rolled back ${rolloutDialog.item?.name} to revision ${rev}`);
              setRolloutDialog({ open: false, item: null });
              refetch();
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              toast.error(msg ?? 'Rollback failed');
              throw e;
            }
          }}
        />
      )}
    </motion.div>
  );
}
