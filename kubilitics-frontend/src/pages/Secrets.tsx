import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Filter,
  RefreshCw,
  MoreHorizontal,
  KeyRound,
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
import { useQueries } from '@tanstack/react-query';
import { ResourceCommandBar, ResourceExportDropdown, ListViewSegmentedControl, ListPagination, PAGE_SIZE_OPTIONS, ListPageStatCard, TableColumnHeaderWithFilterAndSort, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { usePaginatedResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { getSecretConsumers } from '@/services/backendApiClient';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { DeleteConfirmDialog } from '@/components/resources';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface Secret {
  name: string;
  namespace: string;
  type: string;
  dataKeys: number;
  immutable: boolean;
  age: string;
}

interface K8sSecret extends KubernetesResource {
  type?: string;
  data?: Record<string, string>;
  immutable?: boolean;
}

const typeLabel = (t: string): string => {
  if (t === 'kubernetes.io/service-account-token') return 'SA Token';
  if (t === 'kubernetes.io/dockerconfigjson') return 'Docker Config';
  if (t === 'kubernetes.io/tls') return 'TLS';
  return t || 'Opaque';
};

const SECRETS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 220, minWidth: 120 },
  { id: 'namespace', defaultWidth: 130, minWidth: 80 },
  { id: 'type', defaultWidth: 120, minWidth: 80 },
  { id: 'dataKeys', defaultWidth: 90, minWidth: 70 },
  { id: 'usedBy', defaultWidth: 90, minWidth: 70 },
  { id: 'immutable', defaultWidth: 100, minWidth: 70 },
  { id: 'age', defaultWidth: 90, minWidth: 56 },
];

type ListView = 'flat' | 'byNamespace';

function mapSecret(s: K8sSecret): Secret {
  return {
    name: s.metadata?.name ?? '',
    namespace: s.metadata?.namespace || 'default',
    type: s.type || 'Opaque',
    dataKeys: s.data ? Object.keys(s.data).length : 0,
    immutable: !!s.immutable,
    age: calculateAge(s.metadata?.creationTimestamp),
  };
}

export default function Secrets() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = usePaginatedResourceList<K8sSecret>('secrets');
  const deleteResource = useDeleteK8sResource('secrets');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Secret | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [listView, setListView] = useState<ListView>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const backendBaseUrl = getEffectiveBackendBaseUrl(useBackendConfigStore((s) => s.backendBaseUrl));
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const clusterId = useClusterStore((s) => s.activeCluster)?.id ?? useBackendConfigStore((s) => s.currentClusterId);

  const allItems = (data?.allItems ?? []) as K8sSecret[];
  const items: Secret[] = useMemo(() => (isConnected ? allItems.map(mapSecret) : []), [isConnected, allItems]);

  const stats = useMemo(() => {
    const fullList = isConnected ? allItems.map(mapSecret) : [];
    return {
      total: fullList.length,
      opaque: fullList.filter((s) => !s.type || s.type === 'Opaque').length,
      tls: fullList.filter((s) => s.type === 'kubernetes.io/tls').length,
      docker: fullList.filter((s) => s.type === 'kubernetes.io/dockerconfigjson').length,
      sa: fullList.filter((s) => s.type === 'kubernetes.io/service-account-token').length,
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

  const tableConfig: ColumnConfig<Secret>[] = useMemo(
    () => [
      { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
      { columnId: 'namespace', getValue: (i) => i.namespace, sortable: true, filterable: true },
      { columnId: 'type', getValue: (i) => typeLabel(i.type), sortable: true, filterable: true },
      { columnId: 'dataKeys', getValue: (i) => i.dataKeys, sortable: true, filterable: false },
      { columnId: 'usedBy', getValue: () => '', sortable: false, filterable: false },
      { columnId: 'immutable', getValue: (i) => (i.immutable ? 'Yes' : 'No'), sortable: true, filterable: true },
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

  const consumersQueries = useQueries({
    queries: itemsOnPage.map((s) => ({
      queryKey: ['secret-consumers', clusterId, s.namespace, s.name],
      queryFn: () => getSecretConsumers(backendBaseUrl!, clusterId!, s.namespace, s.name),
      enabled: !!(isBackendConfigured() && clusterId && s.name && s.namespace),
      staleTime: 60_000,
    })),
  });
  const consumersCountByKey = useMemo(() => {
    const m: Record<string, number> = {};
    consumersQueries.forEach((q, i) => {
      if (q.data && itemsOnPage[i]) {
        const c = q.data;
        const total =
          (c.pods?.length ?? 0) +
          (c.deployments?.length ?? 0) +
          (c.statefulSets?.length ?? 0) +
          (c.daemonSets?.length ?? 0) +
          (c.jobs?.length ?? 0) +
          (c.cronJobs?.length ?? 0);
        const key = `${itemsOnPage[i].namespace}/${itemsOnPage[i].name}`;
        m[key] = total;
      }
    });
    return m;
  }, [consumersQueries, itemsOnPage]);

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPageIndex(0);
  };

  const pagination = {
    rangeLabel:
      totalFiltered > 0
        ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}`
        : 'No secrets',
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
    const map = new Map<string, Secret[]>();
    for (const item of itemsOnPage) {
      const list = map.get(item.namespace) ?? [];
      list.push(item);
      map.set(item.namespace, list);
    }
    return Array.from(map.entries())
      .map(([label, secrets]) => ({ groupKey: `ns:${label}`, label, secrets }))
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
      toast.success('Secret deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const exportConfig = {
    filenamePrefix: 'secrets',
    resourceLabel: 'secrets',
    getExportData: (s: Secret) => ({ name: s.name, namespace: s.namespace, type: typeLabel(s.type), dataKeys: s.dataKeys, age: s.age }),
    csvColumns: [
      { label: 'Name', getValue: (s: Secret) => s.name },
      { label: 'Namespace', getValue: (s: Secret) => s.namespace },
      { label: 'Type', getValue: (s: Secret) => typeLabel(s.type) },
      { label: 'Data Keys', getValue: (s: Secret) => String(s.dataKeys) },
      { label: 'Age', getValue: (s: Secret) => s.age },
    ],
    toK8sYaml: (s: Secret) => `---
apiVersion: v1
kind: Secret
metadata:
  name: ${s.name}
  namespace: ${s.namespace}
type: ${s.type}
data: {}
`,
  };

  const namespaceCount = useMemo(() => new Set(filteredItems.map((i) => i.namespace)).size, [filteredItems]);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Secrets</h1>
              <p className="text-sm text-muted-foreground">
                {filteredItems.length} secrets across {namespaceCount} namespaces
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
              getKey={(s) => `${s.namespace}/${s.name}`}
              config={exportConfig}
              selectionLabel="All visible secrets"
              onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
            />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateWizard(true)}>
              <Plus className="h-4 w-4" /> Create
            </Button>
          </div>
        </div>

        <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
          <ListPageStatCard label="Total" value={stats.total} icon={KeyRound} iconColor="text-primary" />
          <ListPageStatCard label="Opaque" value={stats.opaque} icon={KeyRound} iconColor="text-muted-foreground" />
          <ListPageStatCard label="TLS" value={stats.tls} icon={KeyRound} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Docker Config" value={stats.docker} icon={KeyRound} iconColor="text-muted-foreground" />
          <ListPageStatCard label="Service Account" value={stats.sa} icon={KeyRound} iconColor="text-muted-foreground" />
        </div>

        <ResourceCommandBar
          scope={
            <div className="w-full min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full min-w-0 justify-between h-10 gap-2 rounded-lg border border-border bg-background font-medium shadow-sm hover:bg-muted/50 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/20"
                  >
                    <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  {namespaces.map((ns) => (
                    <DropdownMenuItem
                      key={ns}
                      onClick={() => setSelectedNamespace(ns)}
                      className={cn(selectedNamespace === ns && 'bg-accent')}
                    >
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
              <Input
                placeholder="Search secrets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
                aria-label="Search secrets"
              />
            </div>
          }
          structure={
            <ListViewSegmentedControl
              value={listView}
              onChange={(v) => setListView(v as ListView)}
              options={[
                { id: 'flat', label: 'Flat', icon: List },
                { id: 'byNamespace', label: 'By Namespace', icon: Layers },
              ]}
              label=""
              ariaLabel="List structure"
            />
          }
          className="mb-2"
        />

        <div className="border border-border rounded-xl overflow-x-auto bg-card">
          <ResizableTableProvider tableId="secrets" columnConfig={SECRETS_TABLE_COLUMNS}>
            <Table className="table-fixed" style={{ minWidth: 900 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <ResizableTableHead columnId="name">
                    <TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="namespace">
                    <TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="type">
                    <TableColumnHeaderWithFilterAndSort columnId="type" label="Type" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.type ?? []} selectedFilterValues={columnFilters.type ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="dataKeys">
                    <TableColumnHeaderWithFilterAndSort columnId="dataKeys" label="Data Keys" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="usedBy" title="Used By">
                    <span className="text-xs font-medium text-muted-foreground">Used By</span>
                  </ResizableTableHead>
                  <ResizableTableHead columnId="immutable">
                    <TableColumnHeaderWithFilterAndSort columnId="immutable" label="Immutable" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={['Yes', 'No']} selectedFilterValues={columnFilters.immutable ?? new Set()} onFilterChange={setColumnFilter} />
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
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <KeyRound className="h-8 w-8 opacity-50" />
                        <p>No secrets found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>
                            Clear filters
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : listView === 'flat' ? (
                  itemsOnPage.map((item, idx) => {
                    const key = `${item.namespace}/${item.name}`;
                    const usedByCount = consumersCountByKey[key];
                    const usedByNode =
                      !isBackendConfigured() || !clusterId ? (
                        <span className="text-muted-foreground">—</span>
                      ) : usedByCount !== undefined ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono text-sm">{usedByCount}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{usedByCount} workload(s) use this Secret</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    return (
                      <motion.tr
                        key={key}
                        initial={ROW_MOTION.initial}
                        animate={ROW_MOTION.animate}
                        transition={ROW_MOTION.transition(idx)}
                        className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}
                      >
                        <ResizableTableCell columnId="name">
                          <Link to={`/secrets/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                            <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{item.name}</span>
                          </Link>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="namespace">
                          <Badge variant="outline" className="font-normal truncate block w-fit max-w-full">
                            {item.namespace}
                          </Badge>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="type">
                          <Badge variant="secondary" className="font-mono text-xs truncate block w-fit max-w-full">
                            {typeLabel(item.type)}
                          </Badge>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="dataKeys" className="font-mono text-sm">
                          {item.dataKeys}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="usedBy">{usedByNode}</ResizableTableCell>
                        <ResizableTableCell columnId="immutable">
                          {item.immutable ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}
                        </ResizableTableCell>
                        <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">
                          {item.age}
                        </ResizableTableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="Secret actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}`)} className="gap-2">
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=data`)} className="gap-2">
                                View Keys
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=used-by`)} className="gap-2">
                                View Consumers
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2">
                                Download YAML
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}>
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                ) : (
                  groupedOnPage.flatMap((group) => {
                    const isCollapsed = collapsedGroups.has(group.groupKey);
                    return [
                      <TableRow
                        key={group.groupKey}
                        className="bg-muted/30 hover:bg-muted/40 cursor-pointer border-b border-border/60 transition-all duration-200"
                        onClick={() => toggleGroup(group.groupKey)}
                      >
                        <TableCell colSpan={8} className="py-2">
                          <div className="flex items-center gap-2 font-medium">
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                            Namespace: {group.label}
                            <span className="text-muted-foreground font-normal">({group.secrets.length})</span>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...(isCollapsed
                        ? []
                        : group.secrets.map((item, idx) => {
                            const key = `${item.namespace}/${item.name}`;
                            const usedByCount = consumersCountByKey[key];
                            const usedByNode =
                              !isBackendConfigured() || !clusterId ? (
                                <span className="text-muted-foreground">—</span>
                              ) : usedByCount !== undefined ? (
                                <span className="font-mono text-sm">{usedByCount}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              );
                            return (
                              <motion.tr
                                key={key}
                                initial={ROW_MOTION.initial}
                                animate={ROW_MOTION.animate}
                                transition={ROW_MOTION.transition(idx)}
                                className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}
                              >
                                <ResizableTableCell columnId="name">
                                  <Link to={`/secrets/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate">
                                    <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                    <span className="truncate">{item.name}</span>
                                  </Link>
                                </ResizableTableCell>
                                <ResizableTableCell columnId="namespace">
                                  <Badge variant="outline" className="font-normal truncate block w-fit max-w-full">
                                    {item.namespace}
                                  </Badge>
                                </ResizableTableCell>
                                <ResizableTableCell columnId="type">
                                  <Badge variant="secondary" className="font-mono text-xs truncate block w-fit max-w-full">
                                    {typeLabel(item.type)}
                                  </Badge>
                                </ResizableTableCell>
                                <ResizableTableCell columnId="dataKeys" className="font-mono text-sm">
                                  {item.dataKeys}
                                </ResizableTableCell>
                                <ResizableTableCell columnId="usedBy">{usedByNode}</ResizableTableCell>
                                <ResizableTableCell columnId="immutable">
                                  {item.immutable ? <Badge variant="default">Yes</Badge> : <Badge variant="outline">No</Badge>}
                                </ResizableTableCell>
                                <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">
                                  {item.age}
                                </ResizableTableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="Secret actions">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}`)} className="gap-2">
                                        View Details
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=data`)} className="gap-2">
                                        View Keys
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=used-by`)} className="gap-2">
                                        View Consumers
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => navigate(`/secrets/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2">
                                        Download YAML
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setDeleteDialog({ open: true, item })} disabled={!isConnected}>
                                        <Trash2 className="h-4 w-4" /> Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </motion.tr>
                            );
                          })),
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
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    {pageSize} per page
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <DropdownMenuItem
                      key={size}
                      onClick={() => handlePageSizeChange(size)}
                      className={cn(pageSize === size && 'bg-accent')}
                    >
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
        <p className="text-xs text-muted-foreground mt-1">
          {listView === 'flat' ? 'flat list' : 'grouped by namespace'}
        </p>
      </motion.div>

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Secret"
          defaultYaml={DEFAULT_YAMLS.Secret}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => {
            toast.success('Secret created');
            setShowCreateWizard(false);
            refetch();
          }}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Secret"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
