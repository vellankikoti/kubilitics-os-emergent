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

interface LimitRangeItem {
  type: string;
  default?: Record<string, string>;
  defaultRequest?: Record<string, string>;
  min?: Record<string, string>;
  max?: Record<string, string>;
  maxLimitRequestRatio?: Record<string, string>;
}

interface LimitRangeResource extends KubernetesResource {
  spec?: { limits?: LimitRangeItem[] };
}

interface LimitRangeRow {
  name: string;
  namespace: string;
  types: string[];
  defaultCpu: string;
  defaultMemory: string;
  minCpu: string;
  maxCpu: string;
  age: string;
  hasContainer: boolean;
  hasPod: boolean;
}

function getContainerLimit(limits: LimitRangeItem[]): LimitRangeItem | undefined {
  return limits?.find((l) => l.type === 'Container');
}

function getPodLimit(limits: LimitRangeItem[]): LimitRangeItem | undefined {
  return limits?.find((l) => l.type === 'Pod');
}

function transformLimitRange(r: LimitRangeResource): LimitRangeRow {
  const limits = r.spec?.limits ?? [];
  const container = getContainerLimit(limits);
  const pod = getPodLimit(limits);
  const types = limits.map((l) => l.type);
  const defaultCpu = container?.default?.cpu ?? container?.defaultRequest?.cpu ?? '–';
  const defaultMemory = container?.default?.memory ?? container?.defaultRequest?.memory ?? '–';
  const minCpu = container?.min?.cpu ?? pod?.min?.cpu ?? '–';
  const maxCpu = container?.max?.cpu ?? pod?.max?.cpu ?? '–';
  return {
    name: r.metadata.name,
    namespace: r.metadata.namespace || 'default',
    types,
    defaultCpu,
    defaultMemory,
    minCpu,
    maxCpu,
    age: calculateAge(r.metadata.creationTimestamp),
    hasContainer: !!container,
    hasPod: !!pod,
  };
}

const LR_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 160, minWidth: 100 },
  { id: 'namespace', defaultWidth: 120, minWidth: 80 },
  { id: 'types', defaultWidth: 140, minWidth: 90 },
  { id: 'defaultCpu', defaultWidth: 100, minWidth: 70 },
  { id: 'defaultMemory', defaultWidth: 110, minWidth: 80 },
  { id: 'minCpu', defaultWidth: 90, minWidth: 60 },
  { id: 'maxCpu', defaultWidth: 90, minWidth: 60 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function LimitRanges() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<LimitRangeResource>('limitranges');
  const deleteResource = useDeleteK8sResource('limitranges');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: LimitRangeRow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as LimitRangeResource[];
  const items: LimitRangeRow[] = useMemo(() => (isConnected ? allItems.map(transformLimitRange) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<LimitRangeRow>[] = useMemo(() => [
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
    const namespacesCovered = new Set(items.map((i) => i.namespace)).size;
    const containerLimits = items.filter((i) => i.hasContainer).length;
    const podLimits = items.filter((i) => i.hasPod).length;
    return { total, namespacesCovered, containerLimits, podLimits };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No limit ranges',
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
    filenamePrefix: 'limit-ranges',
    resourceLabel: 'Limit Ranges',
    getExportData: (r: LimitRangeRow) => ({ name: r.name, namespace: r.namespace, types: r.types.join(', '), defaultCpu: r.defaultCpu, defaultMemory: r.defaultMemory, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: LimitRangeRow) => r.name },
      { label: 'Namespace', getValue: (r: LimitRangeRow) => r.namespace },
      { label: 'Types', getValue: (r: LimitRangeRow) => r.types.join(', ') },
      { label: 'Age', getValue: (r: LimitRangeRow) => r.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="LimitRange"
        defaultYaml={DEFAULT_YAMLS.LimitRange}
        onClose={() => setShowCreator(false)}
        onApply={() => { toast.success('LimitRange created'); setShowCreator(false); refetch(); }}
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
              <h1 className="text-2xl font-semibold tracking-tight">Limit Ranges</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} limit ranges
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
          <ListPageStatCard label="Total Limit Ranges" value={stats.total} icon={Scale} iconColor="text-primary" />
          <ListPageStatCard label="Namespaces Covered" value={stats.namespacesCovered} icon={Scale} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Container Limits" value={stats.containerLimits} icon={Scale} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Pod Limits" value={stats.podLimits} icon={Scale} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search limit ranges..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search limit ranges" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="limitranges" columnConfig={LR_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 850 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="types"><span className="text-sm font-medium">Types</span></ResizableTableHead>
                  <ResizableTableHead columnId="defaultCpu"><span className="text-sm font-medium">Default CPU</span></ResizableTableHead>
                  <ResizableTableHead columnId="defaultMemory"><span className="text-sm font-medium">Default Memory</span></ResizableTableHead>
                  <ResizableTableHead columnId="minCpu"><span className="text-sm font-medium">Min CPU</span></ResizableTableHead>
                  <ResizableTableHead columnId="maxCpu"><span className="text-sm font-medium">Max CPU</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Scale className="h-8 w-8 opacity-50" />
                        <p>No limit ranges found</p>
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
                        <Link to={`/limitranges/${r.namespace}/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Scale className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace"><Badge variant="outline">{r.namespace}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="types">
                        <div className="flex flex-wrap gap-1">
                          {r.types.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                          {r.types.length === 0 && <span className="text-muted-foreground">–</span>}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="defaultCpu" className="font-mono text-sm">{r.defaultCpu}</ResizableTableCell>
                      <ResizableTableCell columnId="defaultMemory" className="font-mono text-sm">{r.defaultMemory}</ResizableTableCell>
                      <ResizableTableCell columnId="minCpu" className="font-mono text-sm">{r.minCpu}</ResizableTableCell>
                      <ResizableTableCell columnId="maxCpu" className="font-mono text-sm">{r.maxCpu}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Limit range actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/limitranges/${r.namespace}/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/limitranges/${r.namespace}/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="LimitRange"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
