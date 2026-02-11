import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Folder, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
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
import { StatusPill, type StatusPillVariant } from '@/components/list';
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

interface NamespaceResource extends KubernetesResource {
  status?: {
    phase?: string;
  };
}

interface Namespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  age: string;
  pods: string;
  services: string;
  deployments: string;
  configmaps: string;
  secrets: string;
}

const namespaceStatusVariant: Record<string, StatusPillVariant> = {
  Active: 'success',
  Terminating: 'error',
};

const SYSTEM_NS = new Set(['kube-system', 'kube-public', 'kube-node-lease', 'default']);

function transformNamespaceResource(resource: NamespaceResource): Namespace {
  return {
    name: resource.metadata.name,
    status: resource.status?.phase || 'Active',
    labels: resource.metadata.labels || {},
    age: calculateAge(resource.metadata.creationTimestamp),
    pods: '–',
    services: '–',
    deployments: '–',
    configmaps: '–',
    secrets: '–',
  };
}

const NS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 180, minWidth: 100 },
  { id: 'status', defaultWidth: 110, minWidth: 80 },
  { id: 'pods', defaultWidth: 80, minWidth: 50 },
  { id: 'deployments', defaultWidth: 100, minWidth: 70 },
  { id: 'services', defaultWidth: 90, minWidth: 60 },
  { id: 'configmaps', defaultWidth: 100, minWidth: 70 },
  { id: 'secrets', defaultWidth: 80, minWidth: 50 },
  { id: 'labels', defaultWidth: 160, minWidth: 80 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function Namespaces() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<NamespaceResource>('namespaces');
  const deleteResource = useDeleteK8sResource('namespaces');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Namespace | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as NamespaceResource[];
  const namespaces: Namespace[] = useMemo(() => (isConnected ? allItems.map(transformNamespaceResource) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<Namespace>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'status', getValue: (i) => i.status, sortable: true, filterable: true },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(namespaces, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((ns) => ns.name.toLowerCase().includes(q) || Object.entries(ns.labels).some(([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = namespaces.length;
    const active = namespaces.filter((n) => n.status === 'Active').length;
    const terminating = namespaces.filter((n) => n.status === 'Terminating').length;
    const system = namespaces.filter((n) => SYSTEM_NS.has(n.name)).length;
    return { total, active, terminating, system };
  }, [namespaces]);

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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No namespaces',
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
    filenamePrefix: 'namespaces',
    resourceLabel: 'Namespaces',
    getExportData: (ns: Namespace) => ({ name: ns.name, status: ns.status, age: ns.age, pods: ns.pods, services: ns.services, deployments: ns.deployments, configmaps: ns.configmaps }),
    csvColumns: [
      { label: 'Name', getValue: (ns: Namespace) => ns.name },
      { label: 'Status', getValue: (ns: Namespace) => ns.status },
      { label: 'Pods', getValue: (ns: Namespace) => ns.pods },
      { label: 'Deployments', getValue: (ns: Namespace) => ns.deployments },
      { label: 'Services', getValue: (ns: Namespace) => ns.services },
      { label: 'ConfigMaps', getValue: (ns: Namespace) => ns.configmaps },
      { label: 'Age', getValue: (ns: Namespace) => ns.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="Namespace"
        defaultYaml={DEFAULT_YAMLS.Namespace}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('Namespace created');
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
            <div className="p-2.5 rounded-xl bg-primary/10"><Folder className="h-6 w-6 text-primary" /></div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Namespaces</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} namespaces
                {!isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Connect cluster</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(ns) => ns.name} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Namespaces" value={stats.total} icon={Folder} iconColor="text-primary" />
          <ListPageStatCard label="Active" value={stats.active} icon={Folder} iconColor="text-[hsl(142,76%,36%)]" />
          <ListPageStatCard label="Terminating" value={stats.terminating} icon={Folder} iconColor="text-[hsl(0,72%,51%)]" />
          <ListPageStatCard label="System" value={stats.system} icon={Folder} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search namespaces..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search namespaces" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="namespaces" columnConfig={NS_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="status"><TableColumnHeaderWithFilterAndSort columnId="status" label="Status" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.status ?? []} selectedFilterValues={columnFilters.status ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="pods"><span className="text-sm font-medium">Pods</span></ResizableTableHead>
                  <ResizableTableHead columnId="deployments"><span className="text-sm font-medium">Deployments</span></ResizableTableHead>
                  <ResizableTableHead columnId="services"><span className="text-sm font-medium">Services</span></ResizableTableHead>
                  <ResizableTableHead columnId="configmaps"><span className="text-sm font-medium">ConfigMaps</span></ResizableTableHead>
                  <ResizableTableHead columnId="secrets"><span className="text-sm font-medium">Secrets</span></ResizableTableHead>
                  <ResizableTableHead columnId="labels"><span className="text-sm font-medium">Labels</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow><TableCell colSpan={10} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Folder className="h-8 w-8 opacity-50" /><p>No namespaces found</p>{(searchQuery || hasActiveFilters) && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>}</div></TableCell></TableRow>
                ) : (
                  itemsOnPage.map((ns, idx) => (
                    <motion.tr key={ns.name} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/namespaces/${ns.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{ns.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="status"><StatusPill label={ns.status} variant={namespaceStatusVariant[ns.status] || 'neutral'} /></ResizableTableCell>
                      <ResizableTableCell columnId="pods" className="font-mono text-sm">{ns.pods}</ResizableTableCell>
                      <ResizableTableCell columnId="deployments" className="font-mono text-sm">{ns.deployments}</ResizableTableCell>
                      <ResizableTableCell columnId="services" className="font-mono text-sm">{ns.services}</ResizableTableCell>
                      <ResizableTableCell columnId="configmaps" className="font-mono text-sm">{ns.configmaps}</ResizableTableCell>
                      <ResizableTableCell columnId="secrets" className="font-mono text-sm">{ns.secrets}</ResizableTableCell>
                      <ResizableTableCell columnId="labels">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(ns.labels).slice(0, 2).map(([k, v]) => (
                            <Badge key={k} variant="secondary" className="text-xs font-mono">{k}={v}</Badge>
                          ))}
                          {Object.keys(ns.labels).length > 2 && <Badge variant="outline" className="text-xs">+{Object.keys(ns.labels).length - 2}</Badge>}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{ns.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Namespace actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/namespaces/${ns.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/pods?namespace=${encodeURIComponent(ns.name)}`)} className="gap-2">View All Resources</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/namespaces/${ns.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item: ns })} disabled={!isConnected}>Delete</DropdownMenuItem>
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

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Namespace"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
