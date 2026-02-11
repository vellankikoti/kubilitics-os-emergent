import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
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

interface PriorityClassResource extends KubernetesResource {
  value?: number;
  globalDefault?: boolean;
  preemptionPolicy?: string;
  description?: string;
}

interface PriorityClassRow {
  name: string;
  value: number;
  globalDefault: boolean;
  preemptionPolicy: string;
  podsUsing: string;
  description: string;
  age: string;
  isSystem: boolean;
  preemptionEnabled: boolean;
}

const SYSTEM_PRIORITY_NAMES = ['system-node-critical', 'system-cluster-critical'];

function transformPriorityClass(r: PriorityClassResource): PriorityClassRow {
  const name = r.metadata.name;
  const preemptionPolicy = r.preemptionPolicy || 'PreemptLowerPriority';
  return {
    name,
    value: typeof r.value === 'number' ? r.value : 0,
    globalDefault: !!r.globalDefault,
    preemptionPolicy,
    podsUsing: '–',
    description: (r.description || '').slice(0, 60) + ((r.description?.length ?? 0) > 60 ? '…' : ''),
    age: calculateAge(r.metadata.creationTimestamp),
    isSystem: SYSTEM_PRIORITY_NAMES.includes(name),
    preemptionEnabled: preemptionPolicy !== 'Never',
  };
}

const PRIORITY_CLASS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'value', defaultWidth: 100, minWidth: 60 },
  { id: 'globalDefault', defaultWidth: 100, minWidth: 70 },
  { id: 'preemptionPolicy', defaultWidth: 140, minWidth: 90 },
  { id: 'podsUsing', defaultWidth: 90, minWidth: 50 },
  { id: 'description', defaultWidth: 200, minWidth: 100 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function PriorityClasses() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<PriorityClassResource>('priorityclasses');
  const deleteResource = useDeleteK8sResource('priorityclasses');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: PriorityClassRow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as PriorityClassResource[];
  const items: PriorityClassRow[] = useMemo(() => (isConnected ? allItems.map(transformPriorityClass) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<PriorityClassRow>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.preemptionPolicy.toLowerCase().includes(q)
    );
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const systemClasses = items.filter((r) => r.isSystem).length;
    const defaultCount = items.filter((r) => r.globalDefault).length;
    const preemptionEnabled = items.filter((r) => r.preemptionEnabled).length;
    return { total, systemClasses, defaultCount, preemptionEnabled };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No priority classes',
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
      await deleteResource.mutateAsync({ name: deleteDialog.item.name });
      setDeleteDialog({ open: false, item: null });
      refetch();
    } else {
      toast.info('Connect cluster to delete resources');
    }
  };

  const exportConfig = {
    filenamePrefix: 'priority-classes',
    resourceLabel: 'Priority Classes',
    getExportData: (r: PriorityClassRow) => ({ name: r.name, value: r.value, globalDefault: r.globalDefault, preemptionPolicy: r.preemptionPolicy, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: PriorityClassRow) => r.name },
      { label: 'Value', getValue: (r: PriorityClassRow) => r.value },
      { label: 'Global Default', getValue: (r: PriorityClassRow) => (r.globalDefault ? 'Yes' : 'No') },
      { label: 'Preemption Policy', getValue: (r: PriorityClassRow) => r.preemptionPolicy },
      { label: 'Age', getValue: (r: PriorityClassRow) => r.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="PriorityClass"
        defaultYaml={DEFAULT_YAMLS.PriorityClass}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('PriorityClass created');
          setShowCreator(false);
          refetch();
        }}
      />
    );
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <AlertTriangle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Priority Classes</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} priority classes
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(r) => r.name} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Priority Classes" value={stats.total} icon={AlertTriangle} iconColor="text-primary" />
          <ListPageStatCard label="System Classes" value={stats.systemClasses} icon={AlertTriangle} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Default" value={stats.defaultCount} icon={AlertTriangle} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Preemption Enabled" value={stats.preemptionEnabled} icon={AlertTriangle} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">Cluster</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search priority classes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search priority classes" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="priorityclasses" columnConfig={PRIORITY_CLASS_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 850 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="value"><span className="text-sm font-medium">Value</span></ResizableTableHead>
                  <ResizableTableHead columnId="globalDefault"><span className="text-sm font-medium">Global Default</span></ResizableTableHead>
                  <ResizableTableHead columnId="preemptionPolicy"><span className="text-sm font-medium">Preemption Policy</span></ResizableTableHead>
                  <ResizableTableHead columnId="podsUsing"><span className="text-sm font-medium">Pods Using</span></ResizableTableHead>
                  <ResizableTableHead columnId="description"><span className="text-sm font-medium">Description</span></ResizableTableHead>
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
                        <AlertTriangle className="h-8 w-8 opacity-50" />
                        <p>No priority classes found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((r, idx) => (
                    <motion.tr key={r.name} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/priorityclasses/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <AlertTriangle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="value" className="font-mono text-sm">{r.value}</ResizableTableCell>
                      <ResizableTableCell columnId="globalDefault">{r.globalDefault ? 'Yes' : 'No'}</ResizableTableCell>
                      <ResizableTableCell columnId="preemptionPolicy">
                        <Badge variant={r.preemptionPolicy === 'Never' ? 'secondary' : 'default'}>{r.preemptionPolicy}</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="podsUsing" className="text-muted-foreground">{r.podsUsing}</ResizableTableCell>
                      <ResizableTableCell columnId="description" className="text-muted-foreground text-sm truncate" title={r.description}>{r.description || '–'}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Priority class actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/priorityclasses/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/priorityclasses/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="PriorityClass"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
