import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gauge, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { DeleteConfirmDialog } from '@/components/resources';
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

interface ResourceQuotaResource extends KubernetesResource {
  spec?: { hard?: Record<string, string>; scopeSelector?: unknown };
  status?: { hard?: Record<string, string>; used?: Record<string, string> };
}

interface ResourceQuotaRow {
  name: string;
  namespace: string;
  cpuRequests: string;
  cpuLimits: string;
  memoryRequests: string;
  memoryLimits: string;
  pods: string;
  services: string;
  pvcs: string;
  overallUsagePct: number | null;
  age: string;
  hasScopeSelector: boolean;
  isNearLimit: boolean;
  isAtLimit: boolean;
}

function parseQuantityToNum(q: string): number | null {
  if (q === undefined || q === null || q === '') return null;
  const s = String(q).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10) / 1000;
  const m2 = s.match(/^(\d+)([KMGTPE]i?)$/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function computeUsagePercent(used: Record<string, string>, hard: Record<string, string>): number | null {
  let maxPct: number | null = null;
  for (const key of Object.keys(hard || {})) {
    const h = hard[key];
    const u = (used || {})[key] || '0';
    const hNum = parseQuantityToNum(h);
    const uNum = parseQuantityToNum(u);
    if (hNum != null && hNum > 0 && uNum != null) {
      const pct = Math.round((uNum / hNum) * 100);
      if (maxPct == null || pct > maxPct) maxPct = pct;
    }
  }
  return maxPct;
}

function formatUsedHard(used: Record<string, string>, hard: Record<string, string>, key: string): string {
  const u = (used || {})[key] ?? '–';
  const h = (hard || {})[key] ?? '–';
  return `${u}/${h}`;
}

function transformResourceQuota(r: ResourceQuotaResource): ResourceQuotaRow {
  const hard = r.status?.hard || r.spec?.hard || {};
  const used = r.status?.used || {};
  const overallPct = computeUsagePercent(used, hard);
  const isNearLimit = overallPct != null && overallPct >= 80 && overallPct < 100;
  const isAtLimit = overallPct != null && overallPct >= 100;
  const hasScopeSelector = !!(r.spec?.scopeSelector && Object.keys((r.spec.scopeSelector as Record<string, unknown>) || {}).length > 0);
  return {
    name: r.metadata.name,
    namespace: r.metadata.namespace || 'default',
    cpuRequests: formatUsedHard(used, hard, 'requests.cpu'),
    cpuLimits: formatUsedHard(used, hard, 'limits.cpu'),
    memoryRequests: formatUsedHard(used, hard, 'requests.memory'),
    memoryLimits: formatUsedHard(used, hard, 'limits.memory'),
    pods: formatUsedHard(used, hard, 'pods'),
    services: formatUsedHard(used, hard, 'services'),
    pvcs: formatUsedHard(used, hard, 'persistentvolumeclaims'),
    overallUsagePct: overallPct,
    age: calculateAge(r.metadata.creationTimestamp),
    hasScopeSelector,
    isNearLimit,
    isAtLimit,
  };
}

const RQ_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 160, minWidth: 100 },
  { id: 'namespace', defaultWidth: 120, minWidth: 80 },
  { id: 'cpuRequests', defaultWidth: 110, minWidth: 80 },
  { id: 'cpuLimits', defaultWidth: 110, minWidth: 80 },
  { id: 'memoryRequests', defaultWidth: 120, minWidth: 80 },
  { id: 'memoryLimits', defaultWidth: 120, minWidth: 80 },
  { id: 'pods', defaultWidth: 80, minWidth: 50 },
  { id: 'services', defaultWidth: 90, minWidth: 50 },
  { id: 'pvcs', defaultWidth: 90, minWidth: 50 },
  { id: 'overallUsage', defaultWidth: 100, minWidth: 70 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function ResourceQuotas() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<ResourceQuotaResource>('resourcequotas');
  const deleteResource = useDeleteK8sResource('resourcequotas');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ResourceQuotaRow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as ResourceQuotaResource[];
  const items: ResourceQuotaRow[] = useMemo(() => (isConnected ? allItems.map(transformResourceQuota) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<ResourceQuotaRow>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((i) => i.name.toLowerCase().includes(q) || i.namespace.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const namespacesWithQuotas = new Set(items.map((i) => i.namespace)).size;
    const nearLimit = items.filter((i) => i.isNearLimit).length;
    const atLimit = items.filter((i) => i.isAtLimit).length;
    const scoped = items.filter((i) => i.hasScopeSelector).length;
    return { total, namespacesWithQuotas, nearLimit, atLimit, scoped };
  }, [items]);

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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No resource quotas',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (isConnected) {
      await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: deleteDialog.item.namespace });
      setDeleteDialog({ open: false, item: null });
      refetch();
    } else {
      toast.info('Connect cluster to delete resources');
    }
  };

  const exportConfig = {
    filenamePrefix: 'resource-quotas',
    resourceLabel: 'Resource Quotas',
    getExportData: (r: ResourceQuotaRow) => ({ name: r.name, namespace: r.namespace, cpuRequests: r.cpuRequests, memoryRequests: r.memoryRequests, pods: r.pods, overallUsagePct: r.overallUsagePct, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: ResourceQuotaRow) => r.name },
      { label: 'Namespace', getValue: (r: ResourceQuotaRow) => r.namespace },
      { label: 'Pods', getValue: (r: ResourceQuotaRow) => r.pods },
      { label: 'Overall %', getValue: (r: ResourceQuotaRow) => (r.overallUsagePct != null ? String(r.overallUsagePct) : '–') },
      { label: 'Age', getValue: (r: ResourceQuotaRow) => r.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ResourceQuota"
        defaultYaml={DEFAULT_YAMLS.ResourceQuota}
        onClose={() => setShowCreator(false)}
        onApply={() => { toast.success('ResourceQuota created'); setShowCreator(false); refetch(); }}
      />
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Gauge className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Resource Quotas</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} resource quotas
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(r) => `${r.namespace}/${r.name}`} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Quotas" value={stats.total} icon={Gauge} iconColor="text-primary" />
          <ListPageStatCard label="Namespaces with Quotas" value={stats.namespacesWithQuotas} icon={Gauge} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Near Limit (≥80%)" value={stats.nearLimit} icon={Gauge} iconColor="text-amber-600" />
          <ListPageStatCard label="At Limit (100%)" value={stats.atLimit} icon={Gauge} iconColor="text-destructive" />
          <ListPageStatCard label="Scoped Quotas" value={stats.scoped} icon={Gauge} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search resource quotas..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search resource quotas" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="resourcequotas" columnConfig={RQ_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="cpuRequests"><span className="text-sm font-medium">CPU Req</span></ResizableTableHead>
                  <ResizableTableHead columnId="cpuLimits"><span className="text-sm font-medium">CPU Lim</span></ResizableTableHead>
                  <ResizableTableHead columnId="memoryRequests"><span className="text-sm font-medium">Mem Req</span></ResizableTableHead>
                  <ResizableTableHead columnId="memoryLimits"><span className="text-sm font-medium">Mem Lim</span></ResizableTableHead>
                  <ResizableTableHead columnId="pods"><span className="text-sm font-medium">Pods</span></ResizableTableHead>
                  <ResizableTableHead columnId="services"><span className="text-sm font-medium">Services</span></ResizableTableHead>
                  <ResizableTableHead columnId="pvcs"><span className="text-sm font-medium">PVCs</span></ResizableTableHead>
                  <ResizableTableHead columnId="overallUsage"><span className="text-sm font-medium">Overall %</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Gauge className="h-8 w-8 opacity-50" />
                        <p>No resource quotas found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((r, idx) => (
                    <motion.tr key={`${r.namespace}/${r.name}`} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/resourcequotas/${r.namespace}/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Gauge className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace"><Badge variant="outline">{r.namespace}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="cpuRequests" className="font-mono text-xs">{r.cpuRequests}</ResizableTableCell>
                      <ResizableTableCell columnId="cpuLimits" className="font-mono text-xs">{r.cpuLimits}</ResizableTableCell>
                      <ResizableTableCell columnId="memoryRequests" className="font-mono text-xs truncate" title={r.memoryRequests}>{r.memoryRequests}</ResizableTableCell>
                      <ResizableTableCell columnId="memoryLimits" className="font-mono text-xs truncate" title={r.memoryLimits}>{r.memoryLimits}</ResizableTableCell>
                      <ResizableTableCell columnId="pods" className="font-mono text-sm">{r.pods}</ResizableTableCell>
                      <ResizableTableCell columnId="services" className="font-mono text-sm">{r.services}</ResizableTableCell>
                      <ResizableTableCell columnId="pvcs" className="font-mono text-sm">{r.pvcs}</ResizableTableCell>
                      <ResizableTableCell columnId="overallUsage">
                        {r.overallUsagePct != null ? (
                          <div className="flex items-center gap-2">
                            <Progress value={Math.min(r.overallUsagePct, 100)} className="h-2 w-14" />
                            <span className={cn('text-sm font-medium', r.isAtLimit && 'text-destructive', r.isNearLimit && !r.isAtLimit && 'text-amber-600')}>{r.overallUsagePct}%</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Resource quota actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/resourcequotas/${r.namespace}/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/namespaces/${r.namespace}`)} className="gap-2">View Namespace</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/resourcequotas/${r.namespace}/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item: r })} disabled={!isConnected}>Delete</DropdownMenuItem>
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
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {pageSize} per page
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <DropdownMenuItem key={size} onClick={() => handlePageSizeChange(size)} className={cn(pageSize === size && 'bg-accent')}>
                      {size} per page
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ListPagination hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPrev={pagination.onPrev} onNext={pagination.onNext} rangeLabel={undefined} currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={pagination.onPageChange} />
          </div>
        </div>
      </motion.div>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="ResourceQuota"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
