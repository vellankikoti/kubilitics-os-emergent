import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, Search, RefreshCw, MoreHorizontal, Loader2, WifiOff, ChevronDown, CheckCircle2, AlertTriangle, XCircle, ExternalLink } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { usePaginatedResourceList } from '@/hooks/useKubernetes';
import { getEvents, type BackendEvent } from '@/services/backendApiClient';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  ResourceCommandBar,
  ListPagination,
  ListPageStatCard,
  resourceTableRowClassName,
  ROW_MOTION,
  PAGE_SIZE_OPTIONS,
} from '@/components/list';

const typeConfig = {
  Normal: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
  Warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  Error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

function getObjectLink(kind: string, name: string, namespace: string): string {
  const kindMap: Record<string, string> = {
    Pod: 'pods',
    Deployment: 'deployments',
    ReplicaSet: 'replicasets',
    StatefulSet: 'statefulsets',
    DaemonSet: 'daemonsets',
    Job: 'jobs',
    CronJob: 'cronjobs',
    Service: 'services',
    Ingress: 'ingresses',
    ConfigMap: 'configmaps',
    Secret: 'secrets',
    PersistentVolumeClaim: 'persistentvolumeclaims',
    PersistentVolume: 'persistentvolumes',
    Node: 'nodes',
    Namespace: 'namespaces',
    HorizontalPodAutoscaler: 'horizontalpodautoscalers',
    ServiceAccount: 'serviceaccounts',
  };
  const path = kindMap[kind];
  if (!path) return '#';
  if (kind === 'Node' || kind === 'PersistentVolume' || kind === 'Namespace') {
    return `/${path}/${name}`;
  }
  return `/${path}/${namespace}/${name}`;
}

function formatEventTime(iso: string): string {
  if (!iso) return '–';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    const min = Math.floor(sec / 60);
    const h = Math.floor(min / 60);
    const d_ = Math.floor(h / 24);
    if (d_ > 0) return `${d_}d ago`;
    if (h > 0) return `${h}h ago`;
    if (min > 0) return `${min}m ago`;
    return `${sec}s ago`;
  } catch {
    return iso;
  }
}

interface EventRow {
  id: string;
  name: string;
  eventNamespace: string;
  type: 'Normal' | 'Warning' | 'Error';
  reason: string;
  message: string;
  objectKind: string;
  objectName: string;
  objectNamespace: string;
  source: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

function backendEventToRow(ev: BackendEvent): EventRow {
  return {
    id: ev.id,
    name: ev.name || ev.id,
    eventNamespace: ev.event_namespace ?? ev.namespace ?? '',
    type: (ev.type === 'Warning' || ev.type === 'Error' ? ev.type : 'Normal') as 'Normal' | 'Warning' | 'Error',
    reason: ev.reason || '–',
    message: ev.message || '–',
    objectKind: ev.resource_kind || '–',
    objectName: ev.resource_name || '–',
    objectNamespace: ev.namespace || '',
    source: ev.source_component || '–',
    count: typeof ev.count === 'number' ? ev.count : 1,
    firstSeen: formatEventTime(ev.first_timestamp),
    lastSeen: formatEventTime(ev.last_timestamp),
  };
}

const EVENTS_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'type', defaultWidth: 90, minWidth: 70 },
  { id: 'reason', defaultWidth: 140, minWidth: 80 },
  { id: 'message', defaultWidth: 220, minWidth: 100 },
  { id: 'involved', defaultWidth: 180, minWidth: 100 },
  { id: 'namespace', defaultWidth: 120, minWidth: 80 },
  { id: 'source', defaultWidth: 120, minWidth: 80 },
  { id: 'count', defaultWidth: 70, minWidth: 50 },
  { id: 'firstSeen', defaultWidth: 90, minWidth: 70 },
  { id: 'lastSeen', defaultWidth: 90, minWidth: 70 },
];

export default function Events() {
  const navigate = useNavigate();
  const { isConnected } = useConnectionStatus();
  const storedUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedUrl);
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const activeCluster = useClusterStore((s) => s.activeCluster);
  const clusterId = activeCluster?.id;
  const useBackend = isBackendConfigured() && !!clusterId;

  const [namespaceFilter, setNamespaceFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Normal' | 'Warning' | 'Error'>('all');
  const [pageSize, setPageSize] = useState(20);
  const [pageIndex, setPageIndex] = useState(0);

  const nsParam = namespaceFilter === 'all' ? '*' : namespaceFilter;
  const eventsQuery = useQuery({
    queryKey: ['events', clusterId, nsParam],
    queryFn: () => getEvents(backendBaseUrl, clusterId!, { namespace: nsParam, limit: 300 }),
    enabled: useBackend && !!clusterId,
  });

  const { data: namespacesData } = usePaginatedResourceList('namespaces');
  const namespaceOptions = useMemo(() => {
    const items = (namespacesData?.allItems ?? []) as Array<{ metadata: { name: string } }>;
    return ['all', ...items.map((r) => r.metadata.name).filter(Boolean)];
  }, [namespacesData?.allItems]);

  const rawRows: EventRow[] = useMemo(() => (eventsQuery.data ?? []).map(backendEventToRow), [eventsQuery.data]);

  const filteredRows = useMemo(() => {
    let list = rawRows;
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.reason.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q) ||
          e.objectName.toLowerCase().includes(q) ||
          e.objectKind.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawRows, typeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = rawRows.length;
    const normal = rawRows.filter((e) => e.type === 'Normal').length;
    const warning = rawRows.filter((e) => e.type === 'Warning').length;
    const uniqueReasons = new Set(rawRows.map((e) => e.reason)).size;
    const involvedResources = new Set(rawRows.map((e) => `${e.objectKind}/${e.objectNamespace}/${e.objectName}`)).size;
    return { total, normal, warning, uniqueReasons, involvedResources };
  }, [rawRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const start = pageIndex * pageSize;
  const itemsOnPage = filteredRows.slice(start, start + pageSize);

  useEffect(() => {
    if (pageIndex >= totalPages && totalPages > 0) setPageIndex(totalPages - 1);
  }, [pageIndex, totalPages]);

  const pagination = {
    rangeLabel: filteredRows.length > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, filteredRows.length)} of ${filteredRows.length}` : 'No events',
    hasPrev: pageIndex > 0,
    hasNext: start + pageSize < filteredRows.length,
    onPrev: () => setPageIndex((i) => Math.max(0, i - 1)),
    onNext: () => setPageIndex((i) => Math.min(totalPages - 1, i + 1)),
    currentPage: pageIndex + 1,
    totalPages,
    onPageChange: (p: number) => setPageIndex(Math.max(0, Math.min(p - 1, totalPages - 1))),
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
            <p className="text-sm text-muted-foreground">
              Cluster events from all namespaces
              {!isConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                  <WifiOff className="h-3 w-3" /> Connect cluster
                </span>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => eventsQuery.refetch()} disabled={eventsQuery.isLoading}>
          {eventsQuery.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className={cn('grid grid-cols-2 sm:grid-cols-5 gap-4', !isConnected && 'opacity-60')}>
        <ListPageStatCard label="Total" value={stats.total} icon={Bell} iconColor="text-primary" />
        <ListPageStatCard label="Normal" value={stats.normal} icon={CheckCircle2} iconColor="text-muted-foreground" />
        <ListPageStatCard label="Warning" value={stats.warning} icon={AlertTriangle} iconColor="text-warning" />
        <ListPageStatCard label="Unique Reasons" value={stats.uniqueReasons} icon={Bell} iconColor="text-muted-foreground" />
        <ListPageStatCard label="Involved Resources" value={stats.involvedResources} icon={Bell} iconColor="text-muted-foreground" />
      </div>

      <ResourceCommandBar
        scope={
          <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
            <SelectTrigger className="w-[180px] h-10 rounded-lg border border-border bg-background text-sm font-medium shadow-sm">
              <SelectValue placeholder="Namespace" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All namespaces</SelectItem>
              {namespaceOptions.filter((n) => n !== 'all').map((ns) => (
                <SelectItem key={ns} value={ns}>{ns}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
        search={
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Search events"
            />
          </div>
        }
        className="mb-2"
      />

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground">Type:</span>
        <Button variant={typeFilter === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('all')}>All</Button>
        <Button variant={typeFilter === 'Normal' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('Normal')}>Normal</Button>
        <Button variant={typeFilter === 'Warning' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('Warning')}>Warning</Button>
        <Button variant={typeFilter === 'Error' ? 'secondary' : 'ghost'} size="sm" onClick={() => setTypeFilter('Error')}>Error</Button>
      </div>

      <div className="border border-border rounded-xl overflow-x-auto bg-card">
        <ResizableTableProvider tableId="events" columnConfig={EVENTS_TABLE_COLUMNS}>
          <Table className="table-fixed" style={{ minWidth: 1000 }}>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                <ResizableTableHead columnId="type"><span className="text-sm font-medium">Type</span></ResizableTableHead>
                <ResizableTableHead columnId="reason"><span className="text-sm font-medium">Reason</span></ResizableTableHead>
                <ResizableTableHead columnId="message"><span className="text-sm font-medium">Message</span></ResizableTableHead>
                <ResizableTableHead columnId="involved"><span className="text-sm font-medium">Involved Object</span></ResizableTableHead>
                <ResizableTableHead columnId="namespace"><span className="text-sm font-medium">Namespace</span></ResizableTableHead>
                <ResizableTableHead columnId="source"><span className="text-sm font-medium">Source</span></ResizableTableHead>
                <ResizableTableHead columnId="count"><span className="text-sm font-medium">Count</span></ResizableTableHead>
                <ResizableTableHead columnId="firstSeen"><span className="text-sm font-medium">First Seen</span></ResizableTableHead>
                <ResizableTableHead columnId="lastSeen"><span className="text-sm font-medium">Last Seen</span></ResizableTableHead>
                <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!useBackend || !clusterId ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    Connect a cluster to view events.
                  </TableCell>
                </TableRow>
              ) : eventsQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading events...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Bell className="h-8 w-8 opacity-50" />
                      <p>No events match your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                itemsOnPage.map((ev, idx) => {
                  const config = typeConfig[ev.type];
                  const EventIcon = config.icon;
                  const objectLink = getObjectLink(ev.objectKind, ev.objectName, ev.objectNamespace);
                  return (
                    <motion.tr
                      key={ev.id}
                      initial={ROW_MOTION.initial}
                      animate={ROW_MOTION.animate}
                      transition={ROW_MOTION.transition(idx)}
                      className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5')}
                    >
                      <ResizableTableCell columnId="type">
                        <Link to={`/events/${encodeURIComponent(ev.eventNamespace)}/${encodeURIComponent(ev.name)}`} className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:opacity-90', config.bg)}>
                          <EventIcon className={cn('h-3.5 w-3.5', config.color)} />
                          <span className="text-xs font-medium">{ev.type}</span>
                        </Link>
                      </ResizableTableCell>
                      <ResizableTableCell columnId="reason" className="font-medium">{ev.reason}</ResizableTableCell>
                      <ResizableTableCell columnId="message" className="text-muted-foreground truncate max-w-[200px]" title={ev.message}>{ev.message}</ResizableTableCell>
                      <ResizableTableCell columnId="involved">
                        {objectLink !== '#' ? (
                          <Link to={objectLink} className="font-mono text-sm text-primary hover:underline flex items-center gap-1 truncate">
                            {ev.objectKind}/{ev.objectName}
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </Link>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">{ev.objectKind}/{ev.objectName}</span>
                        )}
                      </ResizableTableCell>
                      <ResizableTableCell columnId="namespace" className="text-muted-foreground">{ev.eventNamespace || '–'}</ResizableTableCell>
                      <ResizableTableCell columnId="source" className="text-muted-foreground">{ev.source}</ResizableTableCell>
                      <ResizableTableCell columnId="count" className="font-mono text-sm">{ev.count}</ResizableTableCell>
                      <ResizableTableCell columnId="firstSeen" className="text-muted-foreground whitespace-nowrap">{ev.firstSeen}</ResizableTableCell>
                      <ResizableTableCell columnId="lastSeen" className="text-muted-foreground whitespace-nowrap">{ev.lastSeen}</ResizableTableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="Event actions">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => navigate(`/events/${encodeURIComponent(ev.eventNamespace)}/${encodeURIComponent(ev.name)}`)} className="gap-2">
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate(`/events/${encodeURIComponent(ev.eventNamespace)}/${encodeURIComponent(ev.name)}?tab=yaml`)} className="gap-2">
                              Download YAML
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </motion.tr>
                  );
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
                {PAGE_SIZE_OPTIONS.filter((s) => s <= 100).map((size) => (
                  <DropdownMenuItem key={size} onClick={() => { setPageSize(size); setPageIndex(0); }} className={cn(pageSize === size && 'bg-accent')}>
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
  );
}
