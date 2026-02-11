import { useState, useMemo, useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Server, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, ChevronDown, Layers, CheckSquare, Square } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DeleteConfirmDialog, UsageBar } from '@/components/resources';
import { StatusPill, type StatusPillVariant } from '@/components/list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ResizableTableProvider,
  ResizableTableHead,
  ResizableTableCell,
  type ResizableColumnConfig,
} from '@/components/ui/resizable-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { usePaginatedResourceList, useDeleteK8sResource, useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { getNodeMetrics } from '@/services/backendApiClient';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ResourceCommandBar,
  ResourceExportDropdown,
  ListPagination,
  ListPageStatCard,
  TableColumnHeaderWithFilterAndSort,
  resourceTableRowClassName,
  ROW_MOTION,
  PAGE_SIZE_OPTIONS,
} from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';

interface NodeResource extends KubernetesResource {
  spec?: {
    unschedulable?: boolean;
    taints?: Array<{ key: string; value?: string; effect: string }>;
  };
  status?: {
    conditions?: Array<{ type: string; status: string }>;
    nodeInfo?: { kubeletVersion: string; operatingSystem?: string; architecture?: string };
    allocatable?: { pods: string; cpu: string; memory: string };
    capacity?: { pods: string; cpu: string; memory: string };
  };
}

interface Node {
  name: string;
  status: string;
  roles: string[];
  version: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  /** Raw usage from metrics (e.g. "250m", "512Mi") for UsageBar display. */
  cpuRaw: string;
  memoryRaw: string;
  pods: string;
  age: string;
  cpuCapacity: string;
  memoryCapacity: string;
  conditions: string[];
  taintsCount: number;
  osArch: string;
}

const nodeStatusVariant: Record<string, StatusPillVariant> = {
  Ready: 'success',
  NotReady: 'error',
  SchedulingDisabled: 'warning',
};

/** Parse CPU capacity string to millicores (e.g. "8" -> 8000, "8000m" -> 8000). */
function parseCpuCapacityToMilli(s: string): number | null {
  if (!s || s === '-') return null;
  const t = s.trim();
  if (t.endsWith('m')) {
    const n = parseFloat(t.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n * 1000 : null;
}

/** Parse memory capacity string to Mi (e.g. "32Gi" -> 32768, "16384Ki" -> 16). */
function parseMemoryCapacityToMi(s: string): number | null {
  if (!s || s === '-') return null;
  const t = s.trim();
  if (t.endsWith('Ki')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n / 1024 : null;
  }
  if (t.endsWith('Mi')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n : null;
  }
  if (t.endsWith('Gi')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n * 1024 : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

/** Parse usage CPU string to millicores (e.g. "250.00m" -> 250). */
function parseCpuUsageToMilli(s: string): number | null {
  if (!s || s === '-') return null;
  const t = s.trim();
  if (t.endsWith('m')) {
    const n = parseFloat(t.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n * 1000 : null;
}

/** Parse usage memory string to Mi (e.g. "1024.50Mi" -> 1024.5). */
function parseMemoryUsageToMi(s: string): number | null {
  if (!s || s === '-') return null;
  const t = s.trim();
  if (t.endsWith('Ki')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n / 1024 : null;
  }
  if (t.endsWith('Mi')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n : null;
  }
  if (t.endsWith('Gi')) {
    const n = parseFloat(t.slice(0, -2));
    return Number.isFinite(n) ? n * 1024 : null;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function transformNodeResource(resource: NodeResource): Node {
  const labels = resource.metadata.labels || {};
  const roles = Object.keys(labels)
    .filter(k => k.startsWith('node-role.kubernetes.io/'))
    .map(k => k.replace('node-role.kubernetes.io/', ''));
  
  if (roles.length === 0) roles.push('worker');
  
  const readyCondition = resource.status?.conditions?.find(c => c.type === 'Ready');
  const isReady = readyCondition?.status === 'True';
  const isSchedulable = !resource.spec?.unschedulable;
  
  let status = 'NotReady';
  if (isReady && isSchedulable) status = 'Ready';
  else if (isReady && !isSchedulable) status = 'SchedulingDisabled';
  
  const conditions = (resource.status?.conditions || [])
    .filter(c => c.status === 'True' || (c.type === 'Ready' && c.status === 'False'))
    .map(c => c.type);

  const podsCap = resource.status?.allocatable?.pods || '0';
  const taintsCount = resource.spec?.taints?.length ?? 0;
  const ni = resource.status?.nodeInfo;
  const osArch = [ni?.operatingSystem ?? '', ni?.architecture ?? ''].filter(Boolean).join(' / ') || '–';

  return {
    name: resource.metadata.name,
    status,
    roles,
    version: resource.status?.nodeInfo?.kubeletVersion || '-',
    cpuUsage: null,
    memoryUsage: null,
    cpuRaw: '-',
    memoryRaw: '-',
    pods: `–/${podsCap}`,
    age: calculateAge(resource.metadata.creationTimestamp),
    cpuCapacity: resource.status?.capacity?.cpu || resource.status?.allocatable?.cpu || '-',
    memoryCapacity: resource.status?.capacity?.memory || resource.status?.allocatable?.memory || '-',
    conditions,
    taintsCount,
    osArch,
  };
}

const NODES_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 180, minWidth: 100 },
  { id: 'status', defaultWidth: 110, minWidth: 80 },
  { id: 'roles', defaultWidth: 140, minWidth: 90 },
  { id: 'conditions', defaultWidth: 120, minWidth: 80 },
  { id: 'cpu', defaultWidth: 100, minWidth: 70 },
  { id: 'memory', defaultWidth: 100, minWidth: 70 },
  { id: 'pods', defaultWidth: 80, minWidth: 50 },
  { id: 'version', defaultWidth: 100, minWidth: 70 },
  { id: 'osArch', defaultWidth: 120, minWidth: 80 },
  { id: 'taints', defaultWidth: 70, minWidth: 50 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function Nodes() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const currentClusterId = useBackendConfigStore((s) => s.currentClusterId);
  const activeCluster = useClusterStore((s) => s.activeCluster);
  const storedUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedUrl);
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const clusterId = currentClusterId ?? activeCluster?.id;

  const { data, refetch, isLoading } = usePaginatedResourceList<NodeResource>('nodes');
  const deleteResource = useDeleteK8sResource('nodes');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Node | null; bulk?: boolean }>({ open: false, item: null });
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as NodeResource[];
  const nodes: Node[] = useMemo(() => (isConnected ? allItems.map(transformNodeResource) : []), [isConnected, allItems]);

  const podsListQuery = useK8sResourceList<KubernetesResource & { spec?: { nodeName?: string } }>('pods', undefined, { limit: 5000, enabled: isConnected });
  const podCountByNode = useMemo(() => {
    const items = podsListQuery.data?.items ?? [];
    const map: Record<string, number> = {};
    for (const p of items) {
      const nodeName = p.spec?.nodeName;
      if (nodeName) map[nodeName] = (map[nodeName] ?? 0) + 1;
    }
    return map;
  }, [podsListQuery.data?.items]);

  const nodesWithPodCount: Node[] = useMemo(() => {
    return nodes.map((n) => {
      const cap = n.pods.split('/')[1] ?? '0';
      const count = podCountByNode[n.name] ?? 0;
      return { ...n, pods: `${count}/${cap}` };
    });
  }, [nodes, podCountByNode]);

  const nodesToFetch = useMemo(() => nodesWithPodCount.slice(0, 40), [nodesWithPodCount]);
  const nodeMetricsQueries = useQueries({
    queries: nodesToFetch.map((node) => ({
      queryKey: ['node-metrics', clusterId, node.name],
      queryFn: () => getNodeMetrics(backendBaseUrl, clusterId!, node.name),
      enabled: !!(isBackendConfigured() && clusterId),
      staleTime: 30_000,
      refetchInterval: 30_000,
    })),
  });
  const nodeMetricsMap = useMemo(() => {
    const m: Record<string, { cpu: string; memory: string }> = {};
    nodeMetricsQueries.forEach((q, i) => {
      if (q.data && nodesToFetch[i]) {
        const d = q.data as { CPU?: string; Memory?: string };
        m[nodesToFetch[i].name] = { cpu: d.CPU ?? '-', memory: d.Memory ?? '-' };
      }
    });
    return m;
  }, [nodeMetricsQueries, nodesToFetch]);

  const nodesWithMetrics = useMemo(() => {
    return nodesWithPodCount.map((n) => {
      const metrics = nodeMetricsMap[n.name];
      const cpuRaw = metrics?.cpu ?? '-';
      const memoryRaw = metrics?.memory ?? '-';
      if (!metrics || (metrics.cpu === '-' && metrics.memory === '-')) return { ...n, cpuRaw, memoryRaw };
      const cpuCapMilli = parseCpuCapacityToMilli(n.cpuCapacity);
      const memCapMi = parseMemoryCapacityToMi(n.memoryCapacity);
      const cpuUsageMilli = parseCpuUsageToMilli(metrics.cpu);
      const memUsageMi = parseMemoryUsageToMi(metrics.memory);
      const cpuUsage = cpuCapMilli != null && cpuCapMilli > 0 && cpuUsageMilli != null ? Math.min(100, (cpuUsageMilli / cpuCapMilli) * 100) : null;
      const memoryUsage = memCapMi != null && memCapMi > 0 && memUsageMi != null ? Math.min(100, (memUsageMi / memCapMi) * 100) : null;
      return { ...n, cpuUsage: cpuUsage ?? n.cpuUsage, memoryUsage: memoryUsage ?? n.memoryUsage, cpuRaw, memoryRaw };
    });
  }, [nodesWithPodCount, nodeMetricsMap]);

  const tableConfig: ColumnConfig<Node>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
    { columnId: 'roles', getValue: (i) => i.roles.join(','), sortable: false, filterable: true },
    {
      columnId: 'cpu',
      getValue: (i) => (i.cpuUsage != null ? String(i.cpuUsage) : ''),
      sortable: true,
      filterable: false,
      compare: (a, b) => (a.cpuUsage ?? -1) - (b.cpuUsage ?? -1),
    },
    {
      columnId: 'memory',
      getValue: (i) => (i.memoryUsage != null ? String(i.memoryUsage) : ''),
      sortable: true,
      filterable: false,
      compare: (a, b) => (a.memoryUsage ?? -1) - (b.memoryUsage ?? -1),
    },
    { columnId: 'pods', getValue: (i) => i.pods, sortable: true, filterable: false },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(nodesWithMetrics, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((n) => n.name.toLowerCase().includes(q) || n.roles.some((r) => r.toLowerCase().includes(q)) || n.version.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = nodesWithMetrics.length;
    const ready = nodesWithMetrics.filter((n) => n.status === 'Ready').length;
    const notReady = nodesWithMetrics.filter((n) => n.status === 'NotReady').length;
    const controlPlane = nodesWithMetrics.filter((n) => n.roles.some((r) => r === 'control-plane' || r === 'master')).length;
    const workers = nodesWithMetrics.filter((n) => n.roles.includes('worker') && !n.roles.some((r) => r === 'control-plane' || r === 'master')).length;
    const resourcePressure = nodesWithMetrics.filter((n) => n.conditions.some((c) => c === 'MemoryPressure' || c === 'DiskPressure' || c === 'PIDPressure')).length;
    return { total, ready, notReady, controlPlane, workers, resourcePressure };
  }, [nodesWithMetrics]);

  const totalFiltered = searchFiltered.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = searchFiltered.slice(start, start + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const pagination = {
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No nodes',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedNodes.size > 0) {
      if (isConnected) {
        for (const nodeName of selectedNodes) {
          await deleteResource.mutateAsync({ name: nodeName });
        }
        setSelectedNodes(new Set());
      }
      setDeleteDialog({ open: false, item: null });
      refetch();
    } else if (deleteDialog.item) {
      if (isConnected) {
        await deleteResource.mutateAsync({ name: deleteDialog.item.name });
        setDeleteDialog({ open: false, item: null });
        refetch();
      } else {
        toast.info('Connect cluster to delete resources');
      }
    }
  };

  const toggleNodeSelection = (node: Node) => {
    const next = new Set(selectedNodes);
    if (next.has(node.name)) next.delete(node.name);
    else next.add(node.name);
    setSelectedNodes(next);
  };

  const toggleAllNodesSelection = () => {
    const keys = itemsOnPage.map((n) => n.name);
    const allSelected = keys.every((k) => selectedNodes.has(k));
    if (allSelected) {
      const next = new Set(selectedNodes);
      keys.forEach((k) => next.delete(k));
      setSelectedNodes(next);
    } else {
      const next = new Set(selectedNodes);
      keys.forEach((k) => next.add(k));
      setSelectedNodes(next);
    }
  };

  const handleCordon = (item: Node) => {
    toast.info(item.status === 'SchedulingDisabled' ? `Uncordon ${item.name} (not implemented)` : `Cordon ${item.name} (not implemented)`);
  };

  const handleDrain = (item: Node) => {
    toast.info(`Drain ${item.name} (not implemented)`);
  };

  const exportConfig = {
    filenamePrefix: 'nodes',
    resourceLabel: 'Nodes',
    getExportData: (n: Node) => ({ name: n.name, status: n.status, roles: n.roles.join(', '), version: n.version, cpuUsage: n.cpuUsage != null ? n.cpuUsage : '–', memoryUsage: n.memoryUsage != null ? n.memoryUsage : '–', pods: n.pods, age: n.age, cpuCapacity: n.cpuCapacity, memoryCapacity: n.memoryCapacity, conditions: n.conditions.join(', '), taintsCount: n.taintsCount, osArch: n.osArch }),
    csvColumns: [
      { label: 'Name', getValue: (n: Node) => n.name },
      { label: 'Status', getValue: (n: Node) => n.status },
      { label: 'Roles', getValue: (n: Node) => n.roles.join(', ') },
      { label: 'Version', getValue: (n: Node) => n.version },
      { label: 'CPU %', getValue: (n: Node) => (n.cpuUsage != null ? String(Math.round(n.cpuUsage)) : '–') },
      { label: 'Memory %', getValue: (n: Node) => (n.memoryUsage != null ? String(Math.round(n.memoryUsage)) : '–') },
      { label: 'Pods', getValue: (n: Node) => n.pods },
      { label: 'Age', getValue: (n: Node) => n.age },
    ],
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10"><Server className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Nodes</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} nodes
                {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedNodes.size > 0 && (
              <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}>
                Delete {selectedNodes.size} selected
              </Button>
            )}
            <ResourceExportDropdown items={searchFiltered} selectedKeys={selectedNodes} getKey={(n) => n.name} config={exportConfig} selectionLabel={selectedNodes.size > 0 ? `${selectedNodes.size} selected` : 'All visible'} onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Nodes" value={stats.total} icon={Server} iconColor="text-primary" />
          <ListPageStatCard label="Ready" value={stats.ready} icon={Layers} iconColor="text-[hsl(142,76%,36%)]" />
          <ListPageStatCard label="Not Ready" value={stats.notReady} icon={Layers} iconColor="text-[hsl(0,72%,51%)]" />
          <ListPageStatCard label="Control Plane" value={stats.controlPlane} icon={Layers} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Workers" value={stats.workers} icon={Layers} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Resource Pressure" value={stats.resourcePressure} icon={Layers} iconColor="text-[hsl(45,93%,47%)]" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search nodes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search nodes" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="nodes" columnConfig={NODES_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <TableHead className="w-12 px-2 text-center">
                    <Checkbox
                      checked={itemsOnPage.length > 0 && itemsOnPage.every((n) => selectedNodes.has(n.name))}
                      onCheckedChange={toggleAllNodesSelection}
                      aria-label="Select all nodes on page"
                    />
                  </TableHead>
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="status"><TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="roles"><TableColumnHeaderWithFilterAndSort columnId="roles" label="Roles" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="conditions"><span className="text-sm font-medium">Conditions</span></ResizableTableHead>
                  <ResizableTableHead columnId="cpu"><TableColumnHeaderWithFilterAndSort columnId="cpu" label="CPU" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="memory"><TableColumnHeaderWithFilterAndSort columnId="memory" label="Memory" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="pods"><TableColumnHeaderWithFilterAndSort columnId="pods" label="Pods" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="version"><span className="text-sm font-medium">Version</span></ResizableTableHead>
                  <ResizableTableHead columnId="osArch"><span className="text-sm font-medium">OS / Arch</span></ResizableTableHead>
                  <ResizableTableHead columnId="taints"><span className="text-sm font-medium">Taints</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow><TableCell colSpan={13} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Server className="h-8 w-8 opacity-50" /><p>No nodes found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
                ) : (
                  itemsOnPage.map((item, idx) => (
                    <motion.tr key={item.name} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <TableCell className="w-12 px-2 text-center">
                        <Checkbox
                          checked={selectedNodes.has(item.name)}
                          onCheckedChange={() => toggleNodeSelection(item)}
                          aria-label={`Select ${item.name}`}
                        />
                      </TableCell>
                      <ResizableTableCell columnId="name">
                        <Link to={`/nodes/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Server className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="status"><StatusPill label={item.status} variant={nodeStatusVariant[item.status] || 'error'} /></ResizableTableCell>
                      <ResizableTableCell columnId="roles">
                        <div className="flex flex-wrap gap-1">
                          {item.roles.map((role) => <Badge key={role} variant="outline" className="text-xs">{role}</Badge>)}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="conditions">
                        <div className="flex flex-wrap gap-1">
                          {item.conditions.slice(0, 2).map((cond) => <Badge key={cond} variant={cond === 'Ready' ? 'default' : 'destructive'} className="text-xs">{cond}</Badge>)}
                          {item.conditions.length > 2 && <Badge variant="outline" className="text-xs">+{item.conditions.length - 2}</Badge>}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="cpu">
                        <div className="min-w-0 overflow-hidden">
                          <UsageBar
                            variant="sparkline"
                            value={item.cpuRaw}
                            kind="cpu"
                            displayFormat="compact"
                            width={56}
                            max={parseCpuCapacityToMilli(item.cpuCapacity) ?? undefined}
                          />
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="memory">
                        <div className="min-w-0 overflow-hidden">
                          <UsageBar
                            variant="sparkline"
                            value={item.memoryRaw}
                            kind="memory"
                            displayFormat="compact"
                            width={56}
                            max={parseMemoryCapacityToMi(item.memoryCapacity) ?? undefined}
                          />
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="pods" className="font-mono text-sm">{item.pods}</ResizableTableCell>
                      <ResizableTableCell columnId="version"><Badge variant="secondary" className="font-mono text-xs">{item.version}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="osArch" className="text-sm text-muted-foreground">{item.osArch}</ResizableTableCell>
                      <ResizableTableCell columnId="taints">{item.taintsCount > 0 ? <Badge variant="outline">{item.taintsCount}</Badge> : '–'}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Node actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onClick={() => navigate(`/nodes/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/pods?node=${encodeURIComponent(item.name)}`)} className="gap-2">View Pods on Node</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCordon(item)} className="gap-2">Cordon</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCordon(item)} className="gap-2">Uncordon</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDrain(item)} className="gap-2">Drain</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/nodes/${item.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  ))
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
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2">{pageSize} per page<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PAGE_SIZE_OPTIONS.map((size) => <DropdownMenuItem key={size} onClick={() => handlePageSizeChange(size)} className={cn(pageSize === size && 'bg-accent')}>{size} per page</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ListPagination hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPrev={pagination.onPrev} onNext={pagination.onNext} rangeLabel={undefined} currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={pagination.onPageChange} />
          </div>
        </div>
      </motion.div>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null, bulk: open ? deleteDialog.bulk : false })}
        resourceType={deleteDialog.bulk ? 'nodes' : 'Node'}
        resourceName={deleteDialog.bulk ? `${selectedNodes.size} selected` : (deleteDialog.item?.name || '')}
        onConfirm={handleDelete}
        requireNameConfirmation={!deleteDialog.bulk}
      />
    </>
  );
}
