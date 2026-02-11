import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  RefreshCw,
  MoreHorizontal,
  Database,
  Loader2,
  WifiOff,
  Plus,
  ChevronDown,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { ResourceCommandBar, ResourceExportDropdown, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, StatusPill, type StatusPillVariant, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { DeleteConfirmDialog } from '@/components/resources';
import { toast } from 'sonner';

interface VolumeAttachment {
  id: string;
  name: string;
  attacher: string;
  node: string;
  volume: string;
  attached: boolean;
  attachError: string;
  age: string;
}

interface K8sVolumeAttachment {
  metadata?: { name?: string; uid?: string; creationTimestamp?: string };
  spec?: {
    attacher?: string;
    nodeName?: string;
    source?: { persistentVolumeName?: string; inlineVolumeSpec?: { csi?: { volumeHandle?: string } } };
  };
  status?: { attached?: boolean; attachError?: { message?: string }; detachError?: { message?: string } };
}

const VA_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 220, minWidth: 120 },
  { id: 'attacher', defaultWidth: 180, minWidth: 100 },
  { id: 'node', defaultWidth: 140, minWidth: 90 },
  { id: 'volume', defaultWidth: 160, minWidth: 90 },
  { id: 'attached', defaultWidth: 100, minWidth: 70 },
  { id: 'attachError', defaultWidth: 140, minWidth: 80 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

function mapVA(item: K8sVolumeAttachment): VolumeAttachment {
  return {
    id: item.metadata?.uid ?? item.metadata?.name ?? '',
    name: item.metadata?.name ?? '',
    attacher: item.spec?.attacher ?? '—',
    node: item.spec?.nodeName ?? '—',
    volume: item.spec?.source?.persistentVolumeName ?? item.spec?.source?.inlineVolumeSpec?.csi?.volumeHandle ?? '—',
    attached: !!item.status?.attached,
    attachError: item.status?.attachError?.message ?? item.status?.detachError?.message ?? '—',
    age: calculateAge(item.metadata?.creationTimestamp),
  };
}

export default function VolumeAttachments() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<K8sVolumeAttachment>('volumeattachments');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [vaToDelete, setVaToDelete] = useState<VolumeAttachment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const deleteVA = useDeleteK8sResource('volumeattachments');

  const allItems = (data?.allItems ?? []) as K8sVolumeAttachment[];
  const items: VolumeAttachment[] = useMemo(() => (isConnected ? allItems.map(mapVA) : []), [isConnected, allItems]);

  const stats = useMemo(() => {
    const fullList = isConnected ? allItems.map(mapVA) : [];
    return {
      total: fullList.length,
      attached: fullList.filter((i) => i.attached).length,
      detaching: fullList.filter((i) => !i.attached && i.attachError === '—').length,
      error: fullList.filter((i) => i.attachError !== '—').length,
    };
  }, [isConnected, allItems]);

  const itemsAfterSearch = useMemo(
    () => items.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.node.toLowerCase().includes(searchQuery.toLowerCase()) || item.volume.toLowerCase().includes(searchQuery.toLowerCase())),
    [items, searchQuery]
  );

  const tableConfig: ColumnConfig<VolumeAttachment>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'attacher', getValue: (i) => i.attacher, sortable: true, filterable: true },
      { columnId: 'node', getValue: (i) => i.node, sortable: true, filterable: true },
      { columnId: 'volume', getValue: (i) => i.volume, sortable: true, filterable: false },
      { columnId: 'attached', getValue: (i) => (i.attached ? 'Yes' : 'No'), sortable: true, filterable: true },
      { columnId: 'attachError', getValue: (i) => i.attachError, sortable: true, filterable: false },
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No volume attachments',
    hasPrev: safePageIndex > 0,
    hasNext: start + pageSize < totalFiltered,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: safePageIndex + 1,
    totalPages: Math.max(1, totalPages),
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  const handleAction = (action: string, item: VolumeAttachment) => {
    if (action === 'View Details') navigate(`/volumeattachments/${item.name}`);
    if (action === 'View Node' && item.node !== '—') navigate(`/nodes/${item.node}`);
    if (action === 'View Volume' && item.volume !== '—') navigate(`/persistentvolumes/${item.volume}`);
    if (action === 'Download YAML') navigate(`/volumeattachments/${item.name}?tab=yaml`);
    if (action === 'Delete') setVaToDelete(item);
  };

  const exportConfig = {
    filenamePrefix: 'volumeattachments',
    resourceLabel: 'VolumeAttachments',
    getExportData: (item: VolumeAttachment) => ({ name: item.name, attacher: item.attacher, node: item.node, volume: item.volume, attached: item.attached, age: item.age }),
    csvColumns: [
      { label: 'Name', getValue: (item: VolumeAttachment) => item.name },
      { label: 'Attacher', getValue: (item: VolumeAttachment) => item.attacher },
      { label: 'Node', getValue: (item: VolumeAttachment) => item.node },
      { label: 'Volume', getValue: (item: VolumeAttachment) => item.volume },
      { label: 'Attached', getValue: (item: VolumeAttachment) => (item.attached ? 'Yes' : 'No') },
      { label: 'Age', getValue: (item: VolumeAttachment) => item.age },
    ],
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10"><Database className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Volume Attachments</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} volume attachments
                {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={filteredItems} selectedKeys={new Set()} getKey={(item) => item.id} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Attachments" value={stats.total} icon={Database} iconColor="text-primary" />
          <ListPageStatCard label="Attached" value={stats.attached} icon={Database} iconColor="text-green-600" />
          <ListPageStatCard label="Detaching" value={stats.detaching} icon={Database} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Error" value={stats.error} icon={Database} iconColor="text-destructive" valueClassName={stats.error > 0 ? 'text-destructive' : undefined} />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search volume attachments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search volume attachments" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="volumeattachments" columnConfig={VA_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1000 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="attacher"><TableColumnHeaderWithFilterAndSort columnId="attacher" label="Attacher" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.attacher ?? []} selectedFilterValues={columnFilters.attacher ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="node"><TableColumnHeaderWithFilterAndSort columnId="node" label="Node" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.node ?? []} selectedFilterValues={columnFilters.node ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="volume" title="PV"><TableColumnHeaderWithFilterAndSort columnId="volume" label="PV" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="attached"><TableColumnHeaderWithFilterAndSort columnId="attached" label="Attached" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={['Yes', 'No']} selectedFilterValues={columnFilters.attached ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="attachError" title="Attach Error"><TableColumnHeaderWithFilterAndSort columnId="attachError" label="Attach Error" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Database className="h-8 w-8 opacity-50" /><p>No volume attachments found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
                ) : (
                  itemsOnPage.map((item, idx) => (
                    <motion.tr key={item.id} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/volumeattachments/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Database className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="attacher" className="font-mono text-sm">{item.attacher}</ResizableTableCell>
                      <ResizableTableCell columnId="node">
                        {item.node !== '—' ? <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/nodes/${item.node}`)}>{item.node}</button> : <span className="text-muted-foreground">—</span>}
                      </ResizableTableCell>
                      <ResizableTableCell columnId="volume" className="font-mono text-sm">
                        {item.volume !== '—' ? <button type="button" className="text-primary hover:underline" onClick={() => navigate(`/persistentvolumes/${item.volume}`)}>{item.volume}</button> : <span className="text-muted-foreground">—</span>}
                      </ResizableTableCell>
                      <ResizableTableCell columnId="attached"><StatusPill label={item.attached ? 'Yes' : 'No'} variant={(item.attached ? 'success' : 'neutral') as StatusPillVariant} /></ResizableTableCell>
                      <ResizableTableCell columnId="attachError" className={item.attachError !== '—' ? 'text-destructive text-sm' : 'text-muted-foreground'}>{item.attachError}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="VolumeAttachment actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => handleAction('View Details', item)} className="gap-2">View Details</DropdownMenuItem>
                            {item.node !== '—' && <DropdownMenuItem onClick={() => handleAction('View Node', item)} className="gap-2">View Node</DropdownMenuItem>}
                            {item.volume !== '—' && <DropdownMenuItem onClick={() => handleAction('View Volume', item)} className="gap-2">View Volume</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => handleAction('Download YAML', item)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleAction('Delete', item)} disabled={!isConnected}>Delete</DropdownMenuItem>
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

      {showCreateWizard && <ResourceCreator resourceKind="VolumeAttachment" defaultYaml={DEFAULT_YAMLS.VolumeAttachment} onClose={() => setShowCreateWizard(false)} onApply={() => { toast.success('VolumeAttachment created'); setShowCreateWizard(false); refetch(); }} />}
      <DeleteConfirmDialog
        open={!!vaToDelete}
        onOpenChange={(open) => !open && setVaToDelete(null)}
        resourceType="VolumeAttachment"
        resourceName={vaToDelete?.name ?? ''}
        onConfirm={async () => {
          if (vaToDelete) {
            await deleteVA.mutateAsync({ name: vaToDelete.name });
            toast.success(`VolumeAttachment ${vaToDelete.name} deleted`);
            setVaToDelete(null);
            refetch();
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
