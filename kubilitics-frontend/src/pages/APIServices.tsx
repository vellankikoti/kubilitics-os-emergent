import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileCode, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, ChevronDown } from 'lucide-react';
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
import { DeleteConfirmDialog } from '@/components/resources';
import { StatusPill } from '@/components/list';
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

interface APIServiceResource extends KubernetesResource {
  spec?: {
    service?: { namespace?: string; name?: string };
    group?: string;
    version?: string;
    insecureSkipTLSVerify?: boolean;
  };
  status?: {
    conditions?: Array<{ type: string; status: string }>;
  };
}

interface APIService {
  id: string;
  name: string;
  service: string;
  group: string;
  version: string;
  status: string;
  age: string;
  insecureSkipTLS: boolean;
}

function transformAPIService(item: APIServiceResource): APIService {
  const condition = item.status?.conditions?.find((c) => c.type === 'Available');
  return {
    id: item.metadata.uid,
    name: item.metadata.name,
    service: item.spec?.service ? `${item.spec.service.namespace}/${item.spec.service.name}` : 'Local',
    group: item.spec?.group || '',
    version: item.spec?.version || '-',
    status: condition?.status === 'True' ? 'Available' : 'Unavailable',
    age: calculateAge(item.metadata.creationTimestamp),
    insecureSkipTLS: !!item.spec?.insecureSkipTLSVerify,
  };
}

const API_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'service', defaultWidth: 160, minWidth: 80 },
  { id: 'group', defaultWidth: 140, minWidth: 80 },
  { id: 'version', defaultWidth: 90, minWidth: 60 },
  { id: 'status', defaultWidth: 110, minWidth: 80 },
  { id: 'insecureSkipTLS', defaultWidth: 120, minWidth: 90 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function APIServices() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<APIServiceResource>('apiservices');
  const deleteResource = useDeleteK8sResource('apiservices');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: APIService | null }>({ open: false, item: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as APIServiceResource[];
  const items: APIService[] = useMemo(() => (isConnected ? allItems.map(transformAPIService) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<APIService>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
      { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
    ],
    []
  );

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((i) => i.name.toLowerCase().includes(q) || i.group.toLowerCase().includes(q) || i.service.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const available = items.filter((i) => i.status === 'Available').length;
    const unavailable = items.filter((i) => i.status !== 'Available').length;
    const local = items.filter((i) => i.service === 'Local').length;
    return { total, available, unavailable, local };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No API services',
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
    filenamePrefix: 'apiservices',
    resourceLabel: 'API Services',
    getExportData: (i: APIService) => ({ name: i.name, service: i.service, group: i.group, version: i.version, status: i.status, insecureSkipTLS: i.insecureSkipTLS, age: i.age }),
    csvColumns: [
      { label: 'Name', getValue: (i: APIService) => i.name },
      { label: 'Service', getValue: (i: APIService) => i.service },
      { label: 'Group', getValue: (i: APIService) => i.group },
      { label: 'Version', getValue: (i: APIService) => i.version },
      { label: 'Status', getValue: (i: APIService) => i.status },
      { label: 'Insecure Skip TLS', getValue: (i: APIService) => (i.insecureSkipTLS ? 'Yes' : 'No') },
      { label: 'Age', getValue: (i: APIService) => i.age },
    ],
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileCode className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">API Services</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} API services
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(i) => i.name} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total API Services" value={stats.total} icon={FileCode} iconColor="text-primary" />
          <ListPageStatCard label="Available" value={stats.available} icon={FileCode} iconColor="text-[hsl(142,76%,36%)]" />
          <ListPageStatCard label="Unavailable" value={stats.unavailable} icon={FileCode} iconColor="text-[hsl(0,72%,51%)]" />
          <ListPageStatCard label="Local" value={stats.local} icon={FileCode} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search API services..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search API services" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="apiservices" columnConfig={API_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 800 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="service"><span className="text-sm font-medium">Service</span></ResizableTableHead>
                  <ResizableTableHead columnId="group"><span className="text-sm font-medium">Group</span></ResizableTableHead>
                  <ResizableTableHead columnId="version"><span className="text-sm font-medium">Version</span></ResizableTableHead>
                  <ResizableTableHead columnId="status"><TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="insecureSkipTLS"><span className="text-sm font-medium">Insecure Skip TLS</span></ResizableTableHead>
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
                        <FileCode className="h-8 w-8 opacity-50" />
                        <p>No API services found</p>
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
                        <Link to={`/apiservices/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <FileCode className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="service" className="font-mono text-sm">{item.service}</ResizableTableCell>
                      <ResizableTableCell columnId="group" className="text-muted-foreground">{item.group || '–'}</ResizableTableCell>
                      <ResizableTableCell columnId="version" className="font-mono text-sm">{item.version}</ResizableTableCell>
                      <ResizableTableCell columnId="status">
                        <StatusPill label={item.status} variant={item.status === 'Available' ? 'success' : 'error'} />
                      </ResizableTableCell>
                      <ResizableTableCell columnId="insecureSkipTLS">{item.insecureSkipTLS ? 'Yes' : 'No'}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{item.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="API Service actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/apiservices/${item.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/apiservices/${item.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="APIService"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
