import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link2, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown, Globe } from 'lucide-react';
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

interface Subject {
  kind: string;
  name: string;
  namespace?: string;
}

interface ClusterRoleBindingResource extends KubernetesResource {
  roleRef?: { kind?: string; name?: string; apiGroup?: string };
  subjects?: Subject[];
}

interface ClusterRoleBindingRow {
  name: string;
  clusterRoleName: string;
  subjectsSummary: string;
  subjectKinds: string[];
  subjectCount: number;
  age: string;
  hasUser: boolean;
  hasGroup: boolean;
  hasServiceAccount: boolean;
}

function transformClusterRoleBinding(r: ClusterRoleBindingResource): ClusterRoleBindingRow {
  const subjects = r.subjects || [];
  const roleName = r.roleRef?.name || '–';
  const kinds = [...new Set(subjects.map((s) => s.kind || 'Unknown'))];
  const summary = subjects.length
    ? subjects.slice(0, 2).map((s) => (s.namespace ? `${s.kind}/${s.namespace}/${s.name}` : `${s.kind}/${s.name}`)).join(', ') + (subjects.length > 2 ? '…' : '')
    : '–';
  return {
    name: r.metadata.name,
    clusterRoleName: roleName,
    subjectsSummary: summary,
    subjectKinds: kinds,
    subjectCount: subjects.length,
    age: calculateAge(r.metadata.creationTimestamp),
    hasUser: subjects.some((s) => s.kind === 'User'),
    hasGroup: subjects.some((s) => s.kind === 'Group'),
    hasServiceAccount: subjects.some((s) => s.kind === 'ServiceAccount'),
  };
}

const CLUSTER_ROLE_BINDING_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'clusterRole', defaultWidth: 160, minWidth: 90 },
  { id: 'subjects', defaultWidth: 220, minWidth: 100 },
  { id: 'subjectKinds', defaultWidth: 140, minWidth: 90 },
  { id: 'subjectCount', defaultWidth: 90, minWidth: 50 },
  { id: 'scope', defaultWidth: 110, minWidth: 80 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function ClusterRoleBindings() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<ClusterRoleBindingResource>('clusterrolebindings');
  const deleteResource = useDeleteK8sResource('clusterrolebindings');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ClusterRoleBindingRow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as ClusterRoleBindingResource[];
  const items: ClusterRoleBindingRow[] = useMemo(() => (isConnected ? allItems.map(transformClusterRoleBinding) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<ClusterRoleBindingRow>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      r.clusterRoleName.toLowerCase().includes(q) ||
      r.subjectsSummary.toLowerCase().includes(q)
    );
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const userBindings = items.filter((r) => r.hasUser).length;
    const groupBindings = items.filter((r) => r.hasGroup).length;
    const saBindings = items.filter((r) => r.hasServiceAccount).length;
    return { total, userBindings, groupBindings, saBindings };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No cluster role bindings',
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
    filenamePrefix: 'cluster-role-bindings',
    resourceLabel: 'Cluster Role Bindings',
    getExportData: (r: ClusterRoleBindingRow) => ({ name: r.name, clusterRole: r.clusterRoleName, subjectCount: r.subjectCount, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: ClusterRoleBindingRow) => r.name },
      { label: 'Cluster Role', getValue: (r: ClusterRoleBindingRow) => r.clusterRoleName },
      { label: 'Subject Count', getValue: (r: ClusterRoleBindingRow) => r.subjectCount },
      { label: 'Age', getValue: (r: ClusterRoleBindingRow) => r.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ClusterRoleBinding"
        defaultYaml={DEFAULT_YAMLS.ClusterRoleBinding}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('ClusterRoleBinding created');
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
              <Link2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Cluster Role Bindings</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} cluster role bindings
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
          <ListPageStatCard label="Total Cluster Role Bindings" value={stats.total} icon={Link2} iconColor="text-primary" />
          <ListPageStatCard label="User Bindings" value={stats.userBindings} icon={Link2} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Group Bindings" value={stats.groupBindings} icon={Link2} iconColor="text-muted-foreground" />
          <ListPageStatCard label="SA Bindings" value={stats.saBindings} icon={Link2} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">Cluster</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search cluster role bindings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search cluster role bindings" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="clusterrolebindings" columnConfig={CLUSTER_ROLE_BINDING_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="clusterRole"><span className="text-sm font-medium">Cluster Role</span></ResizableTableHead>
                  <ResizableTableHead columnId="subjects"><span className="text-sm font-medium">Subjects</span></ResizableTableHead>
                  <ResizableTableHead columnId="subjectKinds"><span className="text-sm font-medium">Subject Kinds</span></ResizableTableHead>
                  <ResizableTableHead columnId="subjectCount"><span className="text-sm font-medium">Subject Count</span></ResizableTableHead>
                  <ResizableTableHead columnId="scope"><span className="text-sm font-medium">Scope</span></ResizableTableHead>
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
                        <Link2 className="h-8 w-8 opacity-50" />
                        <p>No cluster role bindings found</p>
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
                        <Link to={`/clusterrolebindings/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="clusterRole">
                        <Link to={`/clusterroles/${r.clusterRoleName}`} className="text-primary hover:underline font-mono text-sm truncate block">{r.clusterRoleName}</Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="subjects" className="text-muted-foreground text-sm truncate" title={r.subjectsSummary}>{r.subjectsSummary}</ResizableTableCell>
                      <ResizableTableCell columnId="subjectKinds">
                        <div className="flex flex-wrap gap-1">
                          {r.subjectKinds.map((k) => (
                            <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                          ))}
                          {r.subjectKinds.length === 0 && <span className="text-muted-foreground">–</span>}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="subjectCount" className="font-mono text-sm">{r.subjectCount}</ResizableTableCell>
                      <ResizableTableCell columnId="scope">
                        <Badge variant="secondary" className="gap-1"><Globe className="h-3 w-3" /> Cluster-wide</Badge>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Cluster role binding actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/clusterrolebindings/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/clusterrolebindings/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="ClusterRoleBinding"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
