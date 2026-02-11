import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, ChevronDown, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

interface LeaseResource extends KubernetesResource {
  spec?: {
    holderIdentity?: string;
    leaseDurationSeconds?: number;
    acquireTime?: string;
    renewTime?: string;
    leaseTransitions?: number;
  };
}

interface Lease {
  id: string;
  name: string;
  namespace: string;
  holder: string;
  duration: string;
  age: string;
  acquireTime: string;
  renewTime: string;
  leaseType: string;
  isHeld: boolean;
  isExpired: boolean;
}

function inferLeaseType(name: string, namespace: string): string {
  if (namespace === 'kube-system' && (name.startsWith('kube-') || name.includes('controller') || name.includes('scheduler'))) {
    return 'Leader election';
  }
  if (namespace === 'kube-node-lease') return 'Kubelet';
  return 'Custom';
}

function transformLease(item: LeaseResource): Lease {
  const holder = item.spec?.holderIdentity ?? '';
  const renewTime = item.spec?.renewTime;
  const now = Date.now();
  const renewMs = renewTime ? new Date(renewTime).getTime() : 0;
  const durationSec = item.spec?.leaseDurationSeconds;
  const isExpired = durationSec != null && renewMs > 0 && now - renewMs > durationSec * 1000;
  return {
    id: item.metadata.uid,
    name: item.metadata.name,
    namespace: item.metadata.namespace || 'default',
    holder: holder || '–',
    duration: durationSec != null ? `${durationSec}s` : '–',
    age: calculateAge(item.metadata.creationTimestamp),
    acquireTime: item.spec?.acquireTime ? formatLeaseTime(item.spec.acquireTime) : '–',
    renewTime: item.spec?.renewTime ? formatLeaseTime(item.spec.renewTime) : '–',
    leaseType: inferLeaseType(item.metadata.name, item.metadata.namespace || ''),
    isHeld: !!holder,
    isExpired,
  };
}

function formatLeaseTime(iso: string): string {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    return d.toISOString();
  } catch {
    return iso;
  }
}

const LEASE_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'namespace', defaultWidth: 140, minWidth: 80 },
  { id: 'holder', defaultWidth: 160, minWidth: 80 },
  { id: 'acquireTime', defaultWidth: 180, minWidth: 120 },
  { id: 'renewTime', defaultWidth: 180, minWidth: 120 },
  { id: 'leaseType', defaultWidth: 140, minWidth: 90 },
  { id: 'duration', defaultWidth: 90, minWidth: 60 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function Leases() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<LeaseResource>('leases');
  const deleteResource = useDeleteK8sResource('leases');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Lease | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as LeaseResource[];
  const items: Lease[] = useMemo(() => (isConnected ? allItems.map(transformLease) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<Lease>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
      { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
    ],
    []
  );

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((i) => i.name.toLowerCase().includes(q) || i.namespace.toLowerCase().includes(q) || i.holder.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const held = items.filter((i) => i.isHeld).length;
    const expired = items.filter((i) => i.isExpired).length;
    const leaderElection = items.filter((i) => i.leaseType === 'Leader election').length;
    return { total, held, expired, leaderElection };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No leases',
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
    filenamePrefix: 'leases',
    resourceLabel: 'Leases',
    getExportData: (i: Lease) => ({ name: i.name, namespace: i.namespace, holder: i.holder, duration: i.duration, acquireTime: i.acquireTime, renewTime: i.renewTime, leaseType: i.leaseType, age: i.age }),
    csvColumns: [
      { label: 'Name', getValue: (i: Lease) => i.name },
      { label: 'Namespace', getValue: (i: Lease) => i.namespace },
      { label: 'Holder', getValue: (i: Lease) => i.holder },
      { label: 'Acquire Time', getValue: (i: Lease) => i.acquireTime },
      { label: 'Renew Time', getValue: (i: Lease) => i.renewTime },
      { label: 'Lease Type', getValue: (i: Lease) => i.leaseType },
      { label: 'Age', getValue: (i: Lease) => i.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="Lease"
        defaultYaml={DEFAULT_YAMLS.Lease}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('Lease created');
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
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Leases</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} leases
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(i) => `${i.namespace}/${i.name}`} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Leases" value={stats.total} icon={Activity} iconColor="text-primary" />
          <ListPageStatCard label="Held" value={stats.held} icon={Activity} iconColor="text-[hsl(142,76%,36%)]" />
          <ListPageStatCard label="Expired" value={stats.expired} icon={Activity} iconColor="text-[hsl(0,72%,51%)]" />
          <ListPageStatCard label="Leader Election" value={stats.leaderElection} icon={Activity} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search leases..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search leases" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="leases" columnConfig={LEASE_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1000 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="holder"><span className="text-sm font-medium">Holder</span></ResizableTableHead>
                  <ResizableTableHead columnId="acquireTime"><span className="text-sm font-medium">Acquire Time</span></ResizableTableHead>
                  <ResizableTableHead columnId="renewTime"><span className="text-sm font-medium">Renew Time</span></ResizableTableHead>
                  <ResizableTableHead columnId="leaseType"><span className="text-sm font-medium">Lease Type</span></ResizableTableHead>
                  <ResizableTableHead columnId="duration"><span className="text-sm font-medium">Duration</span></ResizableTableHead>
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
                        <Activity className="h-8 w-8 opacity-50" />
                        <p>No leases found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((item, idx) => (
                    <motion.tr key={item.id} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/leases/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Activity className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace">{item.namespace}</ResizableTableCell>
                      <ResizableTableCell columnId="holder" className="font-mono text-sm">{item.holder}</ResizableTableCell>
                      <ResizableTableCell columnId="acquireTime" className="text-muted-foreground text-sm whitespace-nowrap">{item.acquireTime}</ResizableTableCell>
                      <ResizableTableCell columnId="renewTime" className="text-muted-foreground text-sm whitespace-nowrap">{item.renewTime}</ResizableTableCell>
                      <ResizableTableCell columnId="leaseType">{item.leaseType}</ResizableTableCell>
                      <ResizableTableCell columnId="duration" className="font-mono text-sm">{item.duration}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Lease actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/leases/${item.namespace}/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/leases/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="Lease"
        resourceName={deleteDialog.item ? `${deleteDialog.item.namespace}/${deleteDialog.item.name}` : ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
