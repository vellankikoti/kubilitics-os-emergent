import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  HardDrive,
  Loader2,
  WifiOff,
  Plus,
  ChevronDown,
  Trash2,
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
  ResizableTableProvider,
  ResizableTableHead,
  ResizableTableCell,
  type ResizableColumnConfig,
} from '@/components/ui/resizable-table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { ResourceCommandBar, ResourceExportDropdown, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, StatusPill, type StatusPillVariant, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { DeleteConfirmDialog } from '@/components/resources';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface PersistentVolume {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim: string;
  claimNamespace?: string;
  claimName?: string;
  storageClass: string;
  volumeMode: string;
  age: string;
}

interface K8sPersistentVolume extends KubernetesResource {
  spec?: {
    capacity?: { storage?: string };
    accessModes?: string[];
    persistentVolumeReclaimPolicy?: string;
    storageClassName?: string;
    claimRef?: { namespace?: string; name?: string };
    volumeMode?: string;
  };
  status?: { phase?: string };
}

const pvStatusVariant: Record<string, StatusPillVariant> = {
  Bound: 'success',
  Available: 'neutral',
  Released: 'warning',
  Failed: 'error',
};

function formatAccessMode(mode: string): string {
  const modeMap: Record<string, string> = {
    ReadWriteOnce: 'RWO',
    ReadOnlyMany: 'ROX',
    ReadWriteMany: 'RWX',
    ReadWriteOncePod: 'RWOP',
  };
  return modeMap[mode] || mode;
}

const PV_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'status', defaultWidth: 110, minWidth: 80 },
  { id: 'capacity', defaultWidth: 100, minWidth: 70 },
  { id: 'accessModes', defaultWidth: 120, minWidth: 80 },
  { id: 'reclaimPolicy', defaultWidth: 110, minWidth: 80 },
  { id: 'storageClass', defaultWidth: 130, minWidth: 90 },
  { id: 'claim', defaultWidth: 180, minWidth: 100 },
  { id: 'volumeMode', defaultWidth: 100, minWidth: 70 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

function mapPV(pv: K8sPersistentVolume): PersistentVolume {
  const claimRef = pv.spec?.claimRef;
  return {
    name: pv.metadata?.name ?? '',
    capacity: pv.spec?.capacity?.storage || '—',
    accessModes: (pv.spec?.accessModes || []).map(formatAccessMode),
    reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy || '—',
    status: pv.status?.phase || 'Unknown',
    claim: claimRef ? `${claimRef.namespace}/${claimRef.name}` : '—',
    claimNamespace: claimRef?.namespace,
    claimName: claimRef?.name,
    storageClass: pv.spec?.storageClassName || '—',
    volumeMode: pv.spec?.volumeMode || 'Filesystem',
    age: calculateAge(pv.metadata?.creationTimestamp),
  };
}

export default function PersistentVolumes() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<K8sPersistentVolume>('persistentvolumes');
  const [showCreator, setShowCreator] = useState(false);
  const [pvToDelete, setPvToDelete] = useState<PersistentVolume | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const deletePV = useDeleteK8sResource('persistentvolumes');

  const allItems = (data?.allItems ?? []) as K8sPersistentVolume[];
  const items: PersistentVolume[] = useMemo(() => (isConnected ? allItems.map(mapPV) : []), [isConnected, allItems]);

  const stats = useMemo(() => {
    const fullList = isConnected ? allItems.map(mapPV) : [];
    return {
      total: fullList.length,
      bound: fullList.filter((p) => p.status === 'Bound').length,
      available: fullList.filter((p) => p.status === 'Available').length,
      released: fullList.filter((p) => p.status === 'Released').length,
      failed: fullList.filter((p) => p.status === 'Failed').length,
    };
  }, [isConnected, allItems]);

  const itemsAfterSearch = useMemo(() => {
    return items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.status.toLowerCase().includes(searchQuery.toLowerCase()) || item.storageClass.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [items, searchQuery]);

  const tableConfig: ColumnConfig<PersistentVolume>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
      { columnId: 'capacity', getValue: (i) => i.capacity, sortable: true, filterable: false },
      { columnId: 'accessModes', getValue: (i) => i.accessModes.join(', '), sortable: true, filterable: false },
      { columnId: 'reclaimPolicy', getValue: (i) => i.reclaimPolicy, sortable: true, filterable: true },
      { columnId: 'storageClass', getValue: (i) => i.storageClass, sortable: true, filterable: true },
      { columnId: 'claim', getValue: (i) => i.claim, sortable: true, filterable: false },
      { columnId: 'volumeMode', getValue: (i) => i.volumeMode, sortable: true, filterable: true },
      { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
    ],
    []
  );

  const {
    filteredAndSortedItems: filteredItems,
    distinctValuesByColumn,
    columnFilters,
    setColumnFilter,
    sortKey,
    sortOrder,
    setSort,
    clearAllFilters,
    hasActiveFilters,
  } = useTableFiltersAndSort(itemsAfterSearch, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = filteredItems.slice(start, start + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const pagination = {
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No persistent volumes',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const handleAction = (action: string, pv: PersistentVolume) => {
    if (action === 'View Details') navigate(`/persistentvolumes/${pv.name}`);
    if (action === 'View Claim' && pv.claimNamespace && pv.claimName) navigate(`/persistentvolumeclaims/${pv.claimNamespace}/${pv.claimName}`);
    if (action === 'View Storage Class' && pv.storageClass !== '—') navigate(`/storageclasses/${pv.storageClass}`);
    if (action === 'Download YAML') navigate(`/persistentvolumes/${pv.name}?tab=yaml`);
    if (action === 'Delete') setPvToDelete(pv);
  };

  const exportConfig = {
    filenamePrefix: 'persistentvolumes',
    resourceLabel: 'PVs',
    getExportData: (pv: PersistentVolume) => ({ name: pv.name, status: pv.status, capacity: pv.capacity, claim: pv.claim, storageClass: pv.storageClass, age: pv.age }),
    csvColumns: [
      { label: 'Name', getValue: (pv: PersistentVolume) => pv.name },
      { label: 'Status', getValue: (pv: PersistentVolume) => pv.status },
      { label: 'Capacity', getValue: (pv: PersistentVolume) => pv.capacity },
      { label: 'Claim', getValue: (pv: PersistentVolume) => pv.claim },
      { label: 'Storage Class', getValue: (pv: PersistentVolume) => pv.storageClass },
      { label: 'Age', getValue: (pv: PersistentVolume) => pv.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="PersistentVolume"
        defaultYaml={DEFAULT_YAMLS.PersistentVolume}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('PersistentVolume created');
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
              <HardDrive className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Persistent Volumes</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} persistent volumes
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown
              items={filteredItems}
              selectedKeys={new Set()}
              getKey={(pv) => pv.name}
              config={exportConfig}
              selectionLabel="All visible PVs"
              onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
            />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total PVs" value={stats.total} icon={HardDrive} iconColor="text-primary" />
          <ListPageStatCard label="Bound" value={stats.bound} icon={HardDrive} iconColor="text-green-600" />
          <ListPageStatCard label="Available" value={stats.available} icon={HardDrive} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Released" value={stats.released} icon={HardDrive} iconColor="text-amber-600" />
          <ListPageStatCard label="Failed" value={stats.failed} icon={HardDrive} iconColor="text-destructive" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search persistent volumes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
                aria-label="Search persistent volumes"
              />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="persistentvolumes" columnConfig={PV_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name">
                    <TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="status">
                    <TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="capacity">
                    <TableColumnHeaderWithFilterAndSort columnId="capacity" label="Capacity" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="accessModes" title="Access Modes">
                    <TableColumnHeaderWithFilterAndSort columnId="accessModes" label="Access Modes" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="reclaimPolicy">
                    <TableColumnHeaderWithFilterAndSort columnId="reclaimPolicy" label="Reclaim" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.reclaimPolicy ?? []} selectedFilterValues={columnFilters.reclaimPolicy ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="storageClass">
                    <TableColumnHeaderWithFilterAndSort columnId="storageClass" label="Storage Class" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.storageClass ?? []} selectedFilterValues={columnFilters.storageClass ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="claim" title="Claim">
                    <TableColumnHeaderWithFilterAndSort columnId="claim" label="Claim" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="volumeMode">
                    <TableColumnHeaderWithFilterAndSort columnId="volumeMode" label="Volume Mode" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.volumeMode ?? []} selectedFilterValues={columnFilters.volumeMode ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="age">
                    <TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <TableHead className="w-12 text-center">
                    <span className="sr-only">Actions</span>
                    <MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <HardDrive className="h-8 w-8 opacity-50" />
                        <p>No persistent volumes found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((item, idx) => {
                    const key = item.name;
                    return (
                      <motion.tr
                        key={key}
                        initial={ROW_MOTION.initial}
                        animate={ROW_MOTION.animate}
                        transition={ROW_MOTION.transition(idx)}
                        className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}
                      >
                        <ResizableTableCell columnId="name">
                          <Link to={`/persistentvolumes/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                            <HardDrive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="status">
                          <StatusPill label={item.status} variant={pvStatusVariant[item.status] || 'neutral'} />
                        </ResizableTableCell>
                        <ResizableTableCell columnId="capacity">
                          <Badge variant="secondary" className="font-mono text-xs">{item.capacity}</Badge>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="accessModes" className="font-mono text-sm">
                          {item.accessModes.join(', ') || '—'}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="reclaimPolicy" className="text-sm">
                          {item.reclaimPolicy}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="storageClass">
                          {item.storageClass !== '—' ? (
                            <button type="button" className="font-mono text-xs text-primary hover:underline" onClick={() => navigate(`/storageclasses/${item.storageClass}`)}>
                              {item.storageClass}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="claim" className="font-mono text-sm">
                          {item.claimNamespace && item.claimName ? (
                            <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/persistentvolumeclaims/${item.claimNamespace}/${item.claimName}`)}>
                              {item.claim}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">{item.claim}</span>
                          )}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="volumeMode" className="text-sm">
                          {item.volumeMode}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">
                          {item.age}
                        </ResizableTableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="PV actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleAction('View Details', item)} className="gap-2">
                                View Details
                              </DropdownMenuItem>
                              {item.claimNamespace && item.claimName && (
                                <DropdownMenuItem onClick={() => handleAction('View Claim', item)} className="gap-2">
                                  View Claim
                                </DropdownMenuItem>
                              )}
                              {item.storageClass !== '—' && (
                                <DropdownMenuItem onClick={() => handleAction('View Storage Class', item)} className="gap-2">
                                  View Storage Class
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleAction('Download YAML', item)} className="gap-2">
                                Download YAML
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleAction('Delete', item)} className="gap-2 text-destructive focus:text-destructive">
                                Delete
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
      </motion.div>
      <DeleteConfirmDialog
        open={!!pvToDelete}
        onOpenChange={(open) => !open && setPvToDelete(null)}
        resourceType="PersistentVolume"
        resourceName={pvToDelete?.name ?? ''}
        onConfirm={async () => {
          if (pvToDelete) {
            await deletePV.mutateAsync({ name: pvToDelete.name });
            toast.success(`PersistentVolume ${pvToDelete.name} deleted`);
            setPvToDelete(null);
            refetch();
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
