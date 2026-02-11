import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  Database,
  Loader2,
  WifiOff,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  List,
  Layers,
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
import { ResourceCommandBar, ResourceExportDropdown, ListViewSegmentedControl, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, StatusPill, type StatusPillVariant, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { DeleteConfirmDialog } from '@/components/resources';
import { toast } from 'sonner';

interface PVC {
  name: string;
  namespace: string;
  status: string;
  volume: string;
  capacity: string;
  used: string;
  accessModes: string[];
  storageClass: string;
  age: string;
}

interface K8sPVC extends KubernetesResource {
  spec?: {
    volumeName?: string;
    storageClassName?: string;
    accessModes?: string[];
    resources?: { requests?: { storage?: string } };
  };
  status?: {
    phase?: string;
    capacity?: { storage?: string };
  };
}

const pvcStatusVariant: Record<string, StatusPillVariant> = {
  Bound: 'success',
  Pending: 'warning',
  Lost: 'error',
  Expanding: 'neutral',
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

const PVC_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 220, minWidth: 120 },
  { id: 'namespace', defaultWidth: 130, minWidth: 80 },
  { id: 'status', defaultWidth: 100, minWidth: 80 },
  { id: 'capacity', defaultWidth: 100, minWidth: 70 },
  { id: 'used', defaultWidth: 90, minWidth: 70 },
  { id: 'accessModes', defaultWidth: 120, minWidth: 80 },
  { id: 'storageClass', defaultWidth: 130, minWidth: 90 },
  { id: 'volume', defaultWidth: 160, minWidth: 90 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

type ListView = 'flat' | 'byNamespace';

function mapPVC(pvc: K8sPVC): PVC {
  return {
    name: pvc.metadata?.name ?? '',
    namespace: pvc.metadata?.namespace || 'default',
    status: pvc.status?.phase || 'Unknown',
    volume: pvc.spec?.volumeName || '—',
    capacity: pvc.spec?.resources?.requests?.storage || '—',
    used: pvc.status?.capacity?.storage || '—',
    accessModes: (pvc.spec?.accessModes || []).map(formatAccessMode),
    storageClass: pvc.spec?.storageClassName || '—',
    age: calculateAge(pvc.metadata?.creationTimestamp),
  };
}

export default function PersistentVolumeClaims() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<K8sPVC>('persistentvolumeclaims');
  const deleteResource = useDeleteK8sResource('persistentvolumeclaims');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: PVC | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [listView, setListView] = useState<ListView>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as K8sPVC[];
  const items: PVC[] = useMemo(() => (isConnected ? allItems.map(mapPVC) : []), [isConnected, allItems]);

  const stats = useMemo(() => {
    const fullList = isConnected ? allItems.map(mapPVC) : [];
    return {
      total: fullList.length,
      bound: fullList.filter((p) => p.status === 'Bound').length,
      pending: fullList.filter((p) => p.status === 'Pending').length,
      lost: fullList.filter((p) => p.status === 'Lost').length,
      expanding: fullList.filter((p) => p.status === 'Expanding').length,
    };
  }, [isConnected, allItems]);

  const namespaces = useMemo(() => ['all', ...Array.from(new Set(items.map((i) => i.namespace)))], [items]);

  const itemsAfterSearchAndNs = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || item.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });
  }, [items, searchQuery, selectedNamespace]);

  const tableConfig: ColumnConfig<PVC>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
      { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
      { columnId: 'capacity', getValue: (i) => i.capacity, sortable: true, filterable: false },
      { columnId: 'used', getValue: (i) => i.used, sortable: true, filterable: false },
      { columnId: 'accessModes', getValue: (i) => i.accessModes.join(', '), sortable: true, filterable: false },
      { columnId: 'storageClass', getValue: (i) => i.storageClass, sortable: true, filterable: true },
      { columnId: 'volume', getValue: (i) => i.volume, sortable: true, filterable: false },
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
  } = useTableFiltersAndSort(itemsAfterSearchAndNs, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No PVCs',
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
    const map = new Map<string, PVC[]>();
    for (const item of itemsOnPage) {
      const list = map.get(item.namespace) ?? [];
      list.push(item);
      map.set(item.namespace, list);
    }
    return Array.from(map.entries())
      .map(([label, pvcs]) => ({ groupKey: `ns:${label}`, label, pvcs }))
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
    if (!deleteDialog.item) return;
    try {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
        namespace: deleteDialog.item.namespace,
      });
      setDeleteDialog({ open: false, item: null });
      refetch();
      toast.success('PersistentVolumeClaim deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleAction = (action: string, item: PVC) => {
    if (action === 'Delete') setDeleteDialog({ open: true, item });
    if (action === 'View Details') navigate(`/persistentvolumeclaims/${item.namespace}/${item.name}`);
    if (action === 'View Volume' && item.volume !== '—') navigate(`/persistentvolumes/${item.volume}`);
    if (action === 'View Pods') navigate(`/persistentvolumeclaims/${item.namespace}/${item.name}?tab=used-by`);
    if (action === 'View Storage Class' && item.storageClass !== '—') navigate(`/storageclasses/${item.storageClass}`);
    if (action === 'Download YAML') navigate(`/persistentvolumeclaims/${item.namespace}/${item.name}?tab=yaml`);
  };

  const exportConfig = {
    filenamePrefix: 'persistentvolumeclaims',
    resourceLabel: 'PVCs',
    getExportData: (pvc: PVC) => ({ name: pvc.name, namespace: pvc.namespace, status: pvc.status, volume: pvc.volume, capacity: pvc.capacity, storageClass: pvc.storageClass, age: pvc.age }),
    csvColumns: [
      { label: 'Name', getValue: (pvc: PVC) => pvc.name },
      { label: 'Namespace', getValue: (pvc: PVC) => pvc.namespace },
      { label: 'Status', getValue: (pvc: PVC) => pvc.status },
      { label: 'Volume', getValue: (pvc: PVC) => pvc.volume },
      { label: 'Capacity', getValue: (pvc: PVC) => pvc.capacity },
      { label: 'Storage Class', getValue: (pvc: PVC) => pvc.storageClass },
      { label: 'Age', getValue: (pvc: PVC) => pvc.age },
    ],
  };

  const namespaceCount = useMemo(() => new Set(filteredItems.map((i) => i.namespace)).size, [filteredItems]);

  const renderRow = (item: PVC, idx: number) => {
    const key = `${item.namespace}/${item.name}`;
    return (
      <motion.tr
        key={key}
        initial={ROW_MOTION.initial}
        animate={ROW_MOTION.animate}
        transition={ROW_MOTION.transition(idx)}
        className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}
      >
        <ResizableTableCell columnId="name">
          <Link to={`/persistentvolumeclaims/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
            <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{item.name}</span>
          </Link>
        </ResizableTableCell>
        <ResizableTableCell columnId="namespace">
          <Badge variant="outline" className="font-normal truncate block w-fit max-w-full">{item.namespace}</Badge>
        </ResizableTableCell>
        <ResizableTableCell columnId="status">
          <StatusPill label={item.status} variant={pvcStatusVariant[item.status] || 'neutral'} />
        </ResizableTableCell>
        <ResizableTableCell columnId="capacity">
          <Badge variant="secondary" className="font-mono text-xs">{item.capacity}</Badge>
        </ResizableTableCell>
        <ResizableTableCell columnId="used" className="font-mono text-sm">{item.used}</ResizableTableCell>
        <ResizableTableCell columnId="accessModes" className="font-mono text-sm">{item.accessModes.join(', ') || '—'}</ResizableTableCell>
        <ResizableTableCell columnId="storageClass">
          {item.storageClass !== '—' ? (
            <button type="button" className="font-mono text-xs text-primary hover:underline" onClick={() => navigate(`/storageclasses/${item.storageClass}`)}>{item.storageClass}</button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </ResizableTableCell>
        <ResizableTableCell columnId="volume" className="font-mono text-sm">
          {item.volume !== '—' ? (
            <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/persistentvolumes/${item.volume}`)}>{item.volume}</button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </ResizableTableCell>
        <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="PVC actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleAction('View Details', item)} className="gap-2">View Details</DropdownMenuItem>
              {item.volume !== '—' && <DropdownMenuItem onClick={() => handleAction('View Volume', item)} className="gap-2">View Volume</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => handleAction('View Pods', item)} className="gap-2">View Pods</DropdownMenuItem>
              {item.storageClass !== '—' && <DropdownMenuItem onClick={() => handleAction('View Storage Class', item)} className="gap-2">View Storage Class</DropdownMenuItem>}
              <DropdownMenuItem onClick={() => handleAction('Download YAML', item)} className="gap-2">Download YAML</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </motion.tr>
    );
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10"><Database className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Persistent Volume Claims</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} PVCs across {namespaceCount} namespaces
                {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={filteredItems} selectedKeys={new Set()} getKey={(pvc) => `${pvc.namespace}/${pvc.name}`} config={exportConfig} selectionLabel="All visible PVCs" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total PVCs" value={stats.total} icon={Database} iconColor="text-primary" />
          <ListPageStatCard label="Bound" value={stats.bound} icon={Database} iconColor="text-green-600" />
          <ListPageStatCard label="Pending" value={stats.pending} icon={Database} iconColor="text-amber-600" />
          <ListPageStatCard label="Lost" value={stats.lost} icon={Database} iconColor="text-destructive" />
          <ListPageStatCard label="Expanding" value={stats.expanding} icon={Database} iconColor="text-muted-foreground" />
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
                    <DropdownMenuItem key={ns} onClick={() => setSelectedNamespace(ns)} className={cn(selectedNamespace === ns && 'bg-accent')}>
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
              <Input placeholder="Search PVCs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search PVCs" />
            </div>
          }
          structure={
            <ListViewSegmentedControl value={listView} onChange={(v) => setListView(v as ListView)} options={[{ id: 'flat', label: 'Flat', icon: List }, { id: 'byNamespace', label: 'By Namespace', icon: Layers }]} label="" ariaLabel="List structure" />
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="persistentvolumeclaims" columnConfig={PVC_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="status"><TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="capacity"><TableColumnHeaderWithFilterAndSort columnId="capacity" label="Capacity" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="used"><TableColumnHeaderWithFilterAndSort columnId="used" label="Used" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="accessModes" title="Access Modes"><TableColumnHeaderWithFilterAndSort columnId="accessModes" label="Access Modes" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="storageClass"><TableColumnHeaderWithFilterAndSort columnId="storageClass" label="Storage Class" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.storageClass ?? []} selectedFilterValues={columnFilters.storageClass ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="volume"><TableColumnHeaderWithFilterAndSort columnId="volume" label="Volume" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow><TableCell colSpan={10} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Database className="h-8 w-8 opacity-50" /><p>No PVCs found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
                ) : listView === 'flat' ? (
                  itemsOnPage.map((item, idx) => renderRow(item, idx))
                ) : (
                  groupedOnPage.flatMap((group) => {
                    const isCollapsed = collapsedGroups.has(group.groupKey);
                    return [
                      <TableRow key={group.groupKey} className="bg-muted/30 hover:bg-muted/40 cursor-pointer border-b border-border/60" onClick={() => toggleGroup(group.groupKey)}>
                        <TableCell colSpan={10} className="py-2">
                          <div className="flex items-center gap-2 font-medium">
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                            Namespace: {group.label}
                            <span className="text-muted-foreground font-normal">({group.pvcs.length})</span>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...(isCollapsed ? [] : group.pvcs.map((item, idx) => renderRow(item, idx))),
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
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2">{pageSize} per page<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PAGE_SIZE_OPTIONS.map((size) => <DropdownMenuItem key={size} onClick={() => handlePageSizeChange(size)} className={cn(pageSize === size && 'bg-accent')}>{size} per page</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ListPagination hasPrev={pagination.hasPrev} hasNext={pagination.hasNext} onPrev={pagination.onPrev} onNext={pagination.onNext} rangeLabel={undefined} currentPage={pagination.currentPage} totalPages={pagination.totalPages} onPageChange={pagination.onPageChange} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{listView === 'flat' ? 'flat list' : 'grouped by namespace'}</p>
      </motion.div>

      {showCreateWizard && <ResourceCreator resourceKind="PersistentVolumeClaim" defaultYaml={DEFAULT_YAMLS.PersistentVolumeClaim} onClose={() => setShowCreateWizard(false)} onApply={() => { toast.success('PersistentVolumeClaim created'); setShowCreateWizard(false); refetch(); }} />}
      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })} resourceType="PersistentVolumeClaim" resourceName={deleteDialog.item?.name || ''} namespace={deleteDialog.item?.namespace} onConfirm={handleDelete} requireNameConfirmation />
    </>
  );
}
