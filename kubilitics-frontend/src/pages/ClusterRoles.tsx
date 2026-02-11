import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, Plus, ChevronDown } from 'lucide-react';
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

interface ClusterRoleRule {
  apiGroups?: string[];
  resources?: string[];
  resourceNames?: string[];
  verbs?: string[];
  nonResourceURLs?: string[];
}

interface AggregationRule {
  clusterRoleSelectors?: Array<{ matchLabels?: Record<string, string>; matchExpressions?: unknown[] }>;
}

interface ClusterRoleResource extends KubernetesResource {
  rules?: ClusterRoleRule[];
  aggregationRule?: AggregationRule;
}

interface ClusterRoleRow {
  name: string;
  rulesCount: number;
  apiGroups: string;
  resources: string;
  verbs: string;
  nonResourceURLsCount: number;
  aggregation: string;
  bindings: string;
  age: string;
  isSystem: boolean;
  isAggregated: boolean;
}

function getUniqueApiGroups(rules: ClusterRoleRule[]): string[] {
  const set = new Set<string>();
  (rules || []).forEach((r) => (r.apiGroups || []).forEach((g) => set.add(g || '')));
  return Array.from(set).filter(Boolean);
}

function getUniqueResources(rules: ClusterRoleRule[]): string[] {
  const set = new Set<string>();
  (rules || []).forEach((r) => (r.resources || []).forEach((res) => set.add(res)));
  return Array.from(set).filter(Boolean);
}

function getUniqueVerbs(rules: ClusterRoleRule[]): string[] {
  const set = new Set<string>();
  (rules || []).forEach((r) => (r.verbs || []).forEach((v) => set.add(v)));
  return Array.from(set).filter(Boolean);
}

function countNonResourceURLs(rules: ClusterRoleRule[]): number {
  return (rules || []).reduce((acc, r) => acc + (r.nonResourceURLs?.length ?? 0), 0);
}

function aggregationLabel(agg?: AggregationRule): string {
  if (!agg?.clusterRoleSelectors?.length) return '–';
  const first = agg.clusterRoleSelectors[0];
  const labels = first?.matchLabels;
  if (labels && Object.keys(labels).length) {
    const parts = Object.entries(labels).map(([k, v]) => `${k}=${v}`);
    return parts.join(', ') + (agg.clusterRoleSelectors.length > 1 ? '…' : '');
  }
  return 'Yes';
}

function transformClusterRole(r: ClusterRoleResource): ClusterRoleRow {
  const rules = r.rules || [];
  const apiGroups = getUniqueApiGroups(rules);
  const resources = getUniqueResources(rules);
  const verbs = getUniqueVerbs(rules);
  const nonResourceURLsCount = countNonResourceURLs(rules);
  const name = r.metadata.name;
  return {
    name,
    rulesCount: rules.length,
    apiGroups: apiGroups.length ? apiGroups.slice(0, 3).join(', ') + (apiGroups.length > 3 ? '…' : '') : '–',
    resources: resources.length ? resources.slice(0, 4).join(', ') + (resources.length > 4 ? '…' : '') : '–',
    verbs: verbs.length ? verbs.join(', ') : '–',
    nonResourceURLsCount,
    aggregation: r.aggregationRule ? aggregationLabel(r.aggregationRule) : '–',
    bindings: '–',
    age: calculateAge(r.metadata.creationTimestamp),
    isSystem: name.startsWith('system:'),
    isAggregated: !!r.aggregationRule,
  };
}

const CLUSTER_ROLE_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 100 },
  { id: 'rules', defaultWidth: 80, minWidth: 50 },
  { id: 'apiGroups', defaultWidth: 140, minWidth: 80 },
  { id: 'resources', defaultWidth: 160, minWidth: 90 },
  { id: 'verbs', defaultWidth: 140, minWidth: 80 },
  { id: 'nonResourceURLs', defaultWidth: 100, minWidth: 60 },
  { id: 'aggregation', defaultWidth: 120, minWidth: 60 },
  { id: 'bindings', defaultWidth: 80, minWidth: 50 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

export default function ClusterRoles() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<ClusterRoleResource>('clusterroles');
  const deleteResource = useDeleteK8sResource('clusterroles');

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ClusterRoleRow | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const allItems = (data?.allItems ?? []) as ClusterRoleResource[];
  const items: ClusterRoleRow[] = useMemo(() => (isConnected ? allItems.map(transformClusterRole) : []), [isConnected, allItems]);

  const tableConfig: ColumnConfig<ClusterRoleRow>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredItems, columnFilters, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(items, { columns: tableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return filteredItems;
    const q = searchQuery.toLowerCase();
    return filteredItems.filter((r) => r.name.toLowerCase().includes(q) || r.verbs.toLowerCase().includes(q) || r.aggregation.toLowerCase().includes(q));
  }, [filteredItems, searchQuery]);

  const stats = useMemo(() => {
    const total = items.length;
    const systemRoles = items.filter((r) => r.isSystem).length;
    const custom = total - systemRoles;
    const aggregated = items.filter((r) => r.isAggregated).length;
    return { total, systemRoles, custom, aggregated };
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
    rangeLabel: totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No cluster roles',
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
    filenamePrefix: 'cluster-roles',
    resourceLabel: 'Cluster Roles',
    getExportData: (r: ClusterRoleRow) => ({ name: r.name, rules: r.rulesCount, apiGroups: r.apiGroups, resources: r.resources, verbs: r.verbs, aggregation: r.aggregation, age: r.age }),
    csvColumns: [
      { label: 'Name', getValue: (r: ClusterRoleRow) => r.name },
      { label: 'Rules', getValue: (r: ClusterRoleRow) => r.rulesCount },
      { label: 'Age', getValue: (r: ClusterRoleRow) => r.age },
    ],
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ClusterRole"
        defaultYaml={DEFAULT_YAMLS.ClusterRole}
        onClose={() => setShowCreator(false)}
        onApply={() => {
          toast.success('ClusterRole created');
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
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Cluster Roles</h1>
              <p className="text-sm text-muted-foreground">
                {searchFiltered.length} cluster roles
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
          <ListPageStatCard label="Total Cluster Roles" value={stats.total} icon={ShieldCheck} iconColor="text-primary" />
          <ListPageStatCard label="System Roles" value={stats.systemRoles} icon={ShieldCheck} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Custom" value={stats.custom} icon={ShieldCheck} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Aggregated" value={stats.aggregated} icon={ShieldCheck} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={<span className="text-sm font-medium text-muted-foreground">Cluster</span>}
          search={
            <div className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search cluster roles..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20" aria-label="Search cluster roles" />
            </div>
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="clusterroles" columnConfig={CLUSTER_ROLE_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 1000 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name"><TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} /></ResizableTableHead>
                  <ResizableTableHead columnId="rules"><span className="text-sm font-medium">Rules</span></ResizableTableHead>
                  <ResizableTableHead columnId="apiGroups"><span className="text-sm font-medium">API Groups</span></ResizableTableHead>
                  <ResizableTableHead columnId="resources"><span className="text-sm font-medium">Resources</span></ResizableTableHead>
                  <ResizableTableHead columnId="verbs"><span className="text-sm font-medium">Verbs</span></ResizableTableHead>
                  <ResizableTableHead columnId="nonResourceURLs"><span className="text-sm font-medium">Non-Resource URLs</span></ResizableTableHead>
                  <ResizableTableHead columnId="aggregation"><span className="text-sm font-medium">Aggregation</span></ResizableTableHead>
                  <ResizableTableHead columnId="bindings"><span className="text-sm font-medium">Bindings</span></ResizableTableHead>
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
                        <ShieldCheck className="h-8 w-8 opacity-50" />
                        <p>No cluster roles found</p>
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
                        <Link to={`/clusterroles/${r.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{r.name}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="rules" className="font-mono text-sm">{r.rulesCount}</ResizableTableCell>
                      <ResizableTableCell columnId="apiGroups" className="text-muted-foreground text-sm truncate" title={r.apiGroups}>{r.apiGroups}</ResizableTableCell>
                      <ResizableTableCell columnId="resources" className="text-muted-foreground text-sm truncate" title={r.resources}>{r.resources}</ResizableTableCell>
                      <ResizableTableCell columnId="verbs">
                        <div className="flex flex-wrap gap-1">
                          {r.verbs !== '–' ? r.verbs.split(', ').slice(0, 3).map((v) => (
                            <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
                          )) : <span className="text-muted-foreground">–</span>}
                          {r.verbs !== '–' && r.verbs.split(', ').length > 3 && <Badge variant="outline" className="text-xs">+{r.verbs.split(', ').length - 3}</Badge>}
                        </div>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="nonResourceURLs" className="text-muted-foreground text-sm">{r.nonResourceURLsCount || '–'}</ResizableTableCell>
                      <ResizableTableCell columnId="aggregation" className="text-muted-foreground text-sm truncate" title={r.aggregation}>{r.aggregation}</ResizableTableCell>
                      <ResizableTableCell columnId="bindings" className="text-muted-foreground">{r.bindings}</ResizableTableCell>
                      <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{r.age}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Cluster role actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/clusterroles/${r.name}`)} className="gap-2">View Details</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/clusterroles/${r.name}?tab=yaml`)} className="gap-2">Download YAML</DropdownMenuItem>
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
        resourceType="ClusterRole"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
