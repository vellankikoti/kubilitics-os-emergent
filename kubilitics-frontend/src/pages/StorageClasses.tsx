import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Layers,
  Loader2,
  WifiOff,
  Plus,
  ChevronDown,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { ResourceCommandBar, ResourceExportDropdown, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { DeleteConfirmDialog } from '@/components/resources';
import { toast } from 'sonner';

interface StorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  allowVolumeExpansion: boolean;
  isDefault: boolean;
  age: string;
}

interface K8sStorageClass extends KubernetesResource {
  provisioner?: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
}

const SC_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'provisioner', defaultWidth: 180, minWidth: 100 },
  { id: 'reclaimPolicy', defaultWidth: 120, minWidth: 80 },
  { id: 'volumeBindingMode', defaultWidth: 130, minWidth: 90 },
  { id: 'allowVolumeExpansion', defaultWidth: 100, minWidth: 70 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

function mapSC(sc: K8sStorageClass): StorageClass {
  const isDefault = sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true';
  return {
    name: sc.metadata?.name ?? '',
    provisioner: sc.provisioner || '—',
    reclaimPolicy: sc.reclaimPolicy || 'Delete',
    volumeBindingMode: sc.volumeBindingMode || 'Immediate',
    allowVolumeExpansion: sc.allowVolumeExpansion ?? false,
    isDefault,
    age: calculateAge(sc.metadata?.creationTimestamp),
  };
}

export default function StorageClasses() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<K8sStorageClass>('storageclasses');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [scToDelete, setScToDelete] = useState<StorageClass | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const deleteSC = useDeleteK8sResource('storageclasses');

  const allItems = (data?.allItems ?? []) as K8sStorageClass[];
  const items: StorageClass[] = useMemo(() => (isConnected ? allItems.map(mapSC) : []), [isConnected, allItems]);

  const stats = useMemo(() => {
    const fullList = isConnected ? allItems.map(mapSC) : [];
    return {
      total: fullList.length,
      defaultCount: fullList.filter((sc) => sc.isDefault).length,
      provisioners: new Set(fullList.map((sc) => sc.provisioner)).size,
    };
  }, [isConnected, allItems]);

  const itemsAfterSearch = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.provisioner.toLowerCase().includes(searchQuery.toLowerCase())),
    [items, searchQuery]
  );

  const tableConfig: ColumnConfig<StorageClass>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'provisioner', getValue: (i) => i.provisioner, sortable: true, filterable: true },
      { columnId: 'reclaimPolicy', getValue: (i) => i.reclaimPolicy, sortable: true, filterable: true },
      { columnId: 'volumeBindingMode', getValue: (i) => i.volumeBindingMode, sortable: true, filterable: true },
      { columnId: 'allowVolumeExpansion', getValue: (i) => (i.allowVolumeExpansion ? 'Yes' : 'No'), sortable: true, filterable: true },
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No storage classes',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const exportConfig = {
    filenamePrefix: 'storageclasses',
    resourceLabel: 'StorageClasses',
    getExportData: (sc: StorageClass) => ({ name: sc.name, provisioner: sc.provisioner, reclaimPolicy: sc.reclaimPolicy, volumeBindingMode: sc.volumeBindingMode, allowVolumeExpansion: sc.allowVolumeExpansion, age: sc.age }),
    csvColumns: [
      { label: 'Name', getValue: (sc: StorageClass) => sc.name },
      { label: 'Provisioner', getValue: (sc: StorageClass) => sc.provisioner },
      { label: 'Reclaim Policy', getValue: (sc: StorageClass) => sc.reclaimPolicy },
      { label: 'Volume Binding', getValue: (sc: StorageClass) => sc.volumeBindingMode },
      { label: 'Age', getValue: (sc: StorageClass) => sc.age },
    ],
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10"><Layers className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Storage Classes</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} storage classes
                {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={filteredItems} selectedKeys={new Set()} getKey={(sc) => sc.name} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Classes" value={stats.total} icon={Layers} iconColor="text-primary" />
          <ListPageStatCard label="Default" value={stats.defaultCount} icon={Layers} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Provisioners" value={stats.provisioners} icon={Layers} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search storage classes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search storage classes" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="storageclasses" columnConfig={SC_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="provisioner"><TableColumnHeaderWithFilterAndSort columnId="provisioner" label="Provisioner" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.provisioner ?? []} selectedFilterValues={columnFilters.provisioner ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="reclaimPolicy"><TableColumnHeaderWithFilterAndSort columnId="reclaimPolicy" label="Reclaim Policy" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.reclaimPolicy ?? []} selectedFilterValues={columnFilters.reclaimPolicy ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="volumeBindingMode"><TableColumnHeaderWithFilterAndSort columnId="volumeBindingMode" label="Volume Binding" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.volumeBindingMode ?? []} selectedFilterValues={columnFilters.volumeBindingMode ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="allowVolumeExpansion"><TableColumnHeaderWithFilterAndSort columnId="allowVolumeExpansion" label="Expansion" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={['Yes', 'No']} selectedFilterValues={columnFilters.allowVolumeExpansion ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Layers className="h-8 w-8 opacity-50" /><p>No storage classes found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
                ) : (
                  itemsOnPage.map((item, idx) => (
                    <motion.tr key={item.name} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/storageclasses/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                          {item.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="provisioner" className="font-mono text-sm">{item.provisioner}</ResizableTableCell>
                      <ResizableTableCell columnId="reclaimPolicy"><Badge variant="outline">{item.reclaimPolicy}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="volumeBindingMode" className="text-sm">{item.volumeBindingMode}</ResizableTableCell>
                      <ResizableTableCell columnId="allowVolumeExpansion"><Badge variant={item.allowVolumeExpansion ? 'default' : 'secondary'}>{item.allowVolumeExpansion ? 'Yes' : 'No'}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="StorageClass actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/storageclasses/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/storageclasses/${item.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setScToDelete(item)} disabled={!isConnected}>Delete</DropdownMenuItem>
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

      {showCreateWizard && <ResourceCreator resourceKind="StorageClass" defaultYaml={DEFAULT_YAMLS.StorageClass} onClose={() => setShowCreateWizard(false)} onApply={() => { toast.success('StorageClass created'); setShowCreateWizard(false); refetch(); }} />}
      <DeleteConfirmDialog
        open={!!scToDelete}
        onOpenChange={(open) => !open && setScToDelete(null)}
        resourceType="StorageClass"
        resourceName={scToDelete?.name ?? ''}
        onConfirm={async () => {
          if (scToDelete) {
            await deleteSC.mutateAsync({ name: scToDelete.name });
            toast.success(`StorageClass ${scToDelete.name} deleted`);
            setScToDelete(null);
            refetch();
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
