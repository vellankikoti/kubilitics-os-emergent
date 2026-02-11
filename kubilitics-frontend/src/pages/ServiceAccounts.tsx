import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCircle, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
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

interface ServiceAccountResource extends KubernetesResource {
  secrets?: Array<{ name?: string }>;
  imagePullSecrets?: Array<{ name?: string }>;
  automountServiceAccountToken?: boolean;
}

interface ServiceAccount {
  name: string;
  namespace: string;
  secrets: number;
  imagePullSecrets: number;
  usedByPods: string;
  roles: string;
  clusterRoles: string;
  permissions: string;
  automountToken: boolean;
  age: string;
  isSystem: boolean;
  hasSecrets: boolean;
}

function transformServiceAccount(sa: ServiceAccountResource): ServiceAccount {
  const ns = sa.metadata.namespace || '';
  const name = sa.metadata.name || '';
  const isSystem = ns === 'kube-system' || name.startsWith('system:');
  const secretsCount = sa.secrets?.length ?? 0;
  return {
    name,
    namespace: ns || 'default',
    secrets: secretsCount,
    imagePullSecrets: sa.imagePullSecrets?.length ?? 0,
    usedByPods: '–',
    roles: '–',
    clusterRoles: '–',
    permissions: '–',
    automountToken: sa.automountServiceAccountToken !== false,
    age: calculateAge(sa.metadata.creationTimestamp),
    isSystem,
    hasSecrets: secretsCount > 0,
  };
}

const SA_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 180, minWidth: 100 },
  { id: 'namespace', defaultWidth: 130, minWidth: 80 },
  { id: 'secrets', defaultWidth: 80, minWidth: 50 },
  { id: 'imagePullSecrets', defaultWidth: 120, minWidth: 80 },
  { id: 'usedByPods', defaultWidth: 90, minWidth: 60 },
  { id: 'roles', defaultWidth: 70, minWidth: 50 },
  { id: 'clusterRoles', defaultWidth: 90, minWidth: 60 },
  { id: 'permissions', defaultWidth: 100, minWidth: 70 },
  { id: 'automountToken', defaultWidth: 110, minWidth: 80 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function ServiceAccounts() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<ServiceAccountResource>('serviceaccounts');
  const deleteResource = useDeleteK8sResource('serviceaccounts');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ServiceAccount | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as ServiceAccountResource[];
  const items: ServiceAccount[] = useMemo(() => (isConnected ? allItems.map(transformServiceAccount) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<ServiceAccount>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((sa) => sa.name.toLowerCase().includes(q) || sa.namespace.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const system = items.filter((s) => s.isSystem).length;
    const custom = total - system;
    const withSecrets = items.filter((s) => s.hasSecrets).length;
    const overPrivileged = 0;
    return { total, system, custom, withSecrets, overPrivileged };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No service accounts',
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
    filenamePrefix: 'serviceaccounts',
    resourceLabel: 'Service Accounts',
    getExportData: (sa: ServiceAccount) => ({ name: sa.name, namespace: sa.namespace, secrets: sa.secrets, imagePullSecrets: sa.imagePullSecrets, automountToken: sa.automountToken, age: sa.age }),
    csvColumns: [
      { label: 'Name', getValue: (sa: ServiceAccount) => sa.name },
      { label: 'Namespace', getValue: (sa: ServiceAccount) => sa.namespace },
      { label: 'Secrets', getValue: (sa: ServiceAccount) => sa.secrets },
      { label: 'Age', getValue: (sa: ServiceAccount) => sa.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ServiceAccount"
        defaultYaml={DEFAULT_YAMLS.ServiceAccount}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('ServiceAccount created');
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
              <UserCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Service Accounts</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} service accounts
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Connect cluster
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown items={searchFiltered} selectedKeys={new Set()} getKey={(sa) => `${sa.namespace}/${sa.name}`} config={exportConfig} selectionLabel="All visible" onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))} />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreator(true)}><Plus className="h-4 w-4" /> Create</Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total Service Accounts" value={stats.total} icon={UserCircle} iconColor="text-primary" />
          <ListPageStatCard label="System Accounts" value={stats.system} icon={UserCircle} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Custom Accounts" value={stats.custom} icon={UserCircle} iconColor="text-muted-foreground" />
          <ListPageStatCard label="With Secrets" value={stats.withSecrets} icon={UserCircle} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Over-Privileged" value={stats.overPrivileged} icon={UserCircle} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">All</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search service accounts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search service accounts" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="serviceaccounts" columnConfig={SA_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1100 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="namespace"><TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} /></ResizableTableHead>
                  <ResizableTableHead columnId="secrets"><span className="text-sm font-medium">Secrets</span></ResizableTableHead>
                  <ResizableTableHead columnId="imagePullSecrets"><span className="text-sm font-medium">Image Pull Secrets</span></ResizableTableHead>
                  <ResizableTableHead columnId="usedByPods"><span className="text-sm font-medium">Used By Pods</span></ResizableTableHead>
                  <ResizableTableHead columnId="roles"><span className="text-sm font-medium">Roles</span></ResizableTableHead>
                  <ResizableTableHead columnId="clusterRoles"><span className="text-sm font-medium">Cluster Roles</span></ResizableTableHead>
                  <ResizableTableHead columnId="permissions"><span className="text-sm font-medium">Permissions</span></ResizableTableHead>
                  <ResizableTableHead columnId="automountToken"><span className="text-sm font-medium">Auto-Mount Token</span></ResizableTableHead>
                  <ResizableTableHead columnId="age"><TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : searchFiltered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <UserCircle className="h-8 w-8 opacity-50" />
                        <p>No service accounts found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((sa, idx) => (
                    <motion.tr key={`${sa.namespace}/${sa.name}`} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}>
                      <ResizableTableCell columnId="name">
                        <Link to={`/serviceaccounts/${sa.namespace}/${sa.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{sa.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace"><Badge variant="outline">{sa.namespace}</Badge></ResizableTableCell>
                      <ResizableTableCell columnId="secrets" className="font-mono text-sm">{sa.secrets}</ResizableTableCell>
                      <ResizableTableCell columnId="imagePullSecrets" className="font-mono text-sm">{sa.imagePullSecrets}</ResizableTableCell>
                      <ResizableTableCell columnId="usedByPods" className="text-muted-foreground">{sa.usedByPods}</ResizableTableCell>
                      <ResizableTableCell columnId="roles" className="text-muted-foreground">{sa.roles}</ResizableTableCell>
                      <ResizableTableCell columnId="clusterRoles" className="text-muted-foreground">{sa.clusterRoles}</ResizableTableCell>
                      <ResizableTableCell columnId="permissions" className="text-muted-foreground">{sa.permissions}</ResizableTableCell>
                      <ResizableTableCell columnId="automountToken">{sa.automountToken ? 'Yes' : 'No'}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{sa.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Service account actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/serviceaccounts/${sa.namespace}/${sa.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/serviceaccounts/${sa.namespace}/${sa.name}?tab=permissions`)} className="gap-2">View Permissions</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/pods?namespace=${encodeURIComponent(sa.namespace)}`)} className="gap-2">View Pods</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info('Create Token not implemented')} className="gap-2">Create Token</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/serviceaccounts/${sa.namespace}/${sa.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item: sa })} disabled={!isConnected}>Delete</DropdownMenuItem>
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
        resourceType="ServiceAccount"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
