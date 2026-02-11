import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Scale, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

interface VPAResource extends KubernetesResource {
  spec?: {
    targetRef?: { kind?: string; name?: string };
    updatePolicy?: { updateMode?: string };
  };
  status?: {
    recommendation?: { containerRecommendations?: Array<{ lowerBound?: Record<string, string>; target?: Record<string, string>; upperBound?: Record<string, string> }> };
  };
}

interface VPARow {
  name: string;
  namespace: string;
  targetKind: string;
  targetName: string;
  updateMode: string;
  cpuRecommendation: string;
  memoryRecommendation: string;
  age: string;
  updateModeOff: boolean;
  updateModeAuto: boolean;
  updateModeInitial: boolean;
}

function transformVPA(v: VPAResource): VPARow {
  const ref = v.spec?.targetRef;
  const rec = v.status?.recommendation?.containerRecommendations?.[0];
  const mode = v.spec?.updatePolicy?.updateMode ?? 'Auto';
  const cpuRec = rec ? `${rec.lowerBound?.cpu ?? '–'}-${rec.target?.cpu ?? '–'}-${rec.upperBound?.cpu ?? '–'}`.replace(/^–-|–$/g, '–') : '–';
  const memRec = rec ? `${rec.lowerBound?.memory ?? '–'}-${rec.target?.memory ?? '–'}-${rec.upperBound?.memory ?? '–'}`.replace(/^–-|–$/g, '–') : '–';
  return {
    name: v.metadata.name,
    namespace: v.metadata.namespace || 'default',
    targetKind: ref?.kind ?? '–',
    targetName: ref?.name ?? '–',
    updateMode: mode,
    cpuRecommendation: cpuRec,
    memoryRecommendation: memRec,
    age: calculateAge(v.metadata.creationTimestamp),
    updateModeOff: mode === 'Off',
    updateModeAuto: mode === 'Auto',
    updateModeInitial: mode === 'Initial' || mode === 'Recreate',
  };
}

const VPA_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 160, minWidth: 100 },
  { id: 'namespace', defaultWidth: 120, minWidth: 80 },
  { id: 'target', defaultWidth: 160, minWidth: 100 },
  { id: 'updateMode', defaultWidth: 100, minWidth: 70 },
  { id: 'cpuRec', defaultWidth: 140, minWidth: 90 },
  { id: 'memoryRec', defaultWidth: 140, minWidth: 90 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function VerticalPodAutoscalers() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<VPAResource>('verticalpodautoscalers');
  const deleteResource = useDeleteK8sResource('verticalpodautoscalers');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: VPARow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as VPAResource[];
  const items: VPARow[] = useMemo(() => (isConnected ? allItems.map(transformVPA) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<VPARow>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((i) => i.name.toLowerCase().includes(q) || i.namespace.toLowerCase().includes(q) || i.targetName.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const updateModeOff = items.filter((i) => i.updateModeOff).length;
    const updateModeAuto = items.filter((i) => i.updateModeAuto).length;
    const updateModeInitial = items.filter((i) => i.updateModeInitial).length;
    return { total, updateModeOff, updateModeAuto, updateModeInitial };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No VPAs',
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
    filenamePrefix: 'vpa',
    resourceLabel: 'Vertical Pod Autoscalers',
    getExportData: (r: VPARow) => ({ name: r.name, namespace: r.namespace, target: `${r.targetKind}/${r.targetName}`, updateMode: r.updateMode, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: VPARow) => r.name },
      { label: 'Namespace', getValue: (r: VPARow) => r.namespace },
      { label: 'Update Mode', getValue: (r: VPARow) => r.updateMode },
      { label: 'Age', getValue: (r: VPARow) => r.age },
    ],
  };

  const targetLink = (r: VPARow) => {
    const kind = (r.targetKind || '').toLowerCase();
    if (kind === 'deployment') return `/deployments/${r.namespace}/${r.targetName}`;
    if (kind === 'statefulset') return `/statefulsets/${r.namespace}/${r.targetName}`;
    return '#';
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="VerticalPodAutoscaler"
        defaultYaml={DEFAULT_YAMLS.VerticalPodAutoscaler}
        onClose={() => setShowCreator(false)}
        onApply={() => { toast.success('VPA created'); setShowCreator(false); refetch(); }}
      />
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Vertical Pod Autoscalers</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} VPAs
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

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total VPAs" value={stats.total} icon={Scale} iconColor="text-primary" />
          <ListPageStatCard label="Update Mode Off" value={stats.updateModeOff} icon={Scale} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Update Mode Auto" value={stats.updateModeAuto} icon={Scale} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Initial/Recreate" value={stats.updateModeInitial} icon={Scale} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search VPAs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search VPAs" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="verticalpodautoscalers" columnConfig={VPA_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 850 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="target"><span className="text-sm font-medium">Target</span></ResizableTableHead>
                  <ResizableTableHead columnId="updateMode"><span className="text-sm font-medium">Update Mode</span></ResizableTableHead>
                  <ResizableTableHead columnId="cpuRec"><span className="text-sm font-medium">CPU Rec.</span></ResizableTableHead>
                  <ResizableTableHead columnId="memoryRec"><span className="text-sm font-medium">Memory Rec.</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Scale className="h-8 w-8 opacity-50" />
                        <p>No VPAs found</p>
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
                        <Link to={`/verticalpodautoscalers/${r.namespace}/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace"><Badge variant="outline">{r.namespace}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="target">
                        {r.targetName !== '–' ? (
                          <Link to={targetLink(r)} className="font-mono text-sm text-primary hover:underline truncate block">{r.targetKind}/{r.targetName}</Link>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </ResizableTableCell>
                      <ResizableTableCell columnId="updateMode">
                        <Badge variant={r.updateMode === 'Auto' ? 'default' : 'secondary'}>{r.updateMode}</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="cpuRec" className="font-mono text-xs truncate" title={r.cpuRecommendation}>{r.cpuRecommendation}</ResizableTableCell>
                      <ResizableTableCell columnId="memoryRec" className="font-mono text-xs truncate" title={r.memoryRecommendation}>{r.memoryRecommendation}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="VPA actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/verticalpodautoscalers/${r.namespace}/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            {r.targetName !== '–' && <DropdownMenuItem onClick={() => navigate(targetLink(r))} className="gap-2">View Target</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/verticalpodautoscalers/${r.namespace}/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="VerticalPodAutoscaler"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
