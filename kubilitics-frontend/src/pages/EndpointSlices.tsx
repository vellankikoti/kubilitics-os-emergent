import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter,
  RefreshCw, 
  MoreHorizontal,
  Download,
  Network,
  Loader2,
  WifiOff,
  ChevronDown,
  CheckSquare,
  ExternalLink,
  Link2,
  Plus,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { ResourceExportDropdown, ResourceCommandBar, ListPageStatCard, TableColumnHeaderWithFilterAndSort, ListPagination, PAGE_SIZE_OPTIONS, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { ResizableTableProvider, ResizableTableHead, ResizableTableCell, type ResizableColumnConfig } from '@/components/ui/resizable-table';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';

interface K8sEndpointSlice extends KubernetesResource {
  addressType?: string;
  endpoints?: Array<{ addresses: string[]; conditions?: { ready?: boolean; serving?: boolean; terminating?: boolean } }>;
  ports?: Array<{ port: number; name?: string; protocol?: string }>;
  metadata?: { labels?: Record<string, string> };
}

interface EndpointSlice {
  name: string;
  namespace: string;
  addressType: string;
  endpoints: number;
  ready: number;
  serving: number;
  terminating: number;
  ports: string;
  serviceName: string;
  age: string;
}

const ENDPOINTSLICES_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 120 },
  { id: 'namespace', defaultWidth: 140, minWidth: 90 },
  { id: 'addressType', defaultWidth: 100, minWidth: 80 },
  { id: 'endpoints', defaultWidth: 90, minWidth: 70 },
  { id: 'serviceName', defaultWidth: 160, minWidth: 100 },
  { id: 'age', defaultWidth: 90, minWidth: 60 },
];

export default function EndpointSlices() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = useK8sResourceList<K8sEndpointSlice>('endpointslices', undefined, { limit: 5000 });

  const endpointslices: EndpointSlice[] = isConnected && data?.items
    ? (data.items as K8sEndpointSlice[]).map((es) => {
        const endpoints = es.endpoints ?? [];
        const ready = endpoints.filter((e) => e.conditions?.ready !== false).length;
        const serving = endpoints.filter((e) => e.conditions?.serving !== false).length;
        const terminating = endpoints.filter((e) => e.conditions?.terminating === true).length;
        const portsStr = (es.ports ?? []).map((p) => `${p.port}/${p.protocol ?? 'TCP'}`).join(', ') || '-';
        return {
          name: es.metadata.name,
          namespace: es.metadata.namespace || 'default',
          addressType: es.addressType || 'IPv4',
          endpoints: endpoints.length,
          ready,
          serving,
          terminating,
          ports: portsStr,
          serviceName: es.metadata?.labels?.['kubernetes.io/service-name'] ?? '-',
          age: calculateAge(es.metadata.creationTimestamp),
        };
      })
    : [];

  const stats = useMemo(() => ({
    total: endpointslices.length,
    ipv4: endpointslices.filter((es) => es.addressType === 'IPv4').length,
    ipv6: endpointslices.filter((es) => es.addressType === 'IPv6').length,
    fqdn: endpointslices.filter((es) => es.addressType === 'FQDN').length,
  }), [endpointslices]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(endpointslices.map(es => es.namespace)))];
  }, [endpointslices]);

  const itemsAfterSearchAndNs = useMemo(() => {
    return endpointslices.filter(es => {
      const matchesSearch = es.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           es.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || es.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });
  }, [endpointslices, searchQuery, selectedNamespace]);

  const endpointSlicesTableConfig: ColumnConfig<EndpointSlice>[] = useMemo(() => [
    { columnId: 'name', getValue: (es) => es.name, sortable: true, filterable: false },
    { columnId: 'namespace', getValue: (es) => es.namespace, sortable: true, filterable: true },
    { columnId: 'addressType', getValue: (es) => es.addressType, sortable: true, filterable: true },
    { columnId: 'endpoints', getValue: (es) => es.endpoints, sortable: true, filterable: false },
    { columnId: 'age', getValue: (es) => es.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredSlices, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(itemsAfterSearchAndNs, { columns: endpointSlicesTableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const totalFiltered = filteredSlices.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = filteredSlices.slice(start, start + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const endpointSliceExportConfig = {
    filenamePrefix: 'endpointslices',
    resourceLabel: 'endpoint slices',
    getExportData: (es: EndpointSlice) => ({ name: es.name, namespace: es.namespace, addressType: es.addressType, endpoints: es.endpoints, ready: es.ready, serving: es.serving, terminating: es.terminating, serviceName: es.serviceName, ports: es.ports, age: es.age }),
    csvColumns: [
      { label: 'Name', getValue: (es: EndpointSlice) => es.name },
      { label: 'Namespace', getValue: (es: EndpointSlice) => es.namespace },
      { label: 'Address Type', getValue: (es: EndpointSlice) => es.addressType },
      { label: 'Endpoints', getValue: (es: EndpointSlice) => es.endpoints },
      { label: 'Ready', getValue: (es: EndpointSlice) => es.ready },
      { label: 'Serving', getValue: (es: EndpointSlice) => es.serving },
      { label: 'Terminating', getValue: (es: EndpointSlice) => es.terminating },
      { label: 'Service', getValue: (es: EndpointSlice) => es.serviceName },
      { label: 'Ports', getValue: (es: EndpointSlice) => es.ports },
      { label: 'Age', getValue: (es: EndpointSlice) => es.age },
    ],
    toK8sYaml: (es: EndpointSlice) => `---
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: ${es.name}
  namespace: ${es.namespace}
addressType: ${es.addressType}
endpoints: []
ports: []
`,
  };

  const toggleSelection = (item: EndpointSlice) => {
    const key = `${item.namespace}/${item.name}`;
    const newSelection = new Set(selectedItems);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    setSelectedItems(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedItems.size === filteredSlices.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredSlices.map(es => `${es.namespace}/${es.name}`)));
    }
  };

  const isAllSelected = filteredSlices.length > 0 && selectedItems.size === filteredSlices.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredSlices.length;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Network className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Endpoint Slices</h1>
              <p className="text-sm text-muted-foreground">
                {filteredSlices.length} slices across {namespaces.length - 1} namespaces
                {!isConnected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                    <WifiOff className="h-3 w-3" /> Demo mode
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ResourceExportDropdown
              items={filteredSlices}
              selectedKeys={selectedItems}
              getKey={(es) => `${es.namespace}/${es.name}`}
              config={endpointSliceExportConfig}
              selectionLabel={selectedItems.size > 0 ? 'Selected slices' : 'All visible slices'}
              onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
            />
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateWizard(true)}>
              <Plus className="h-4 w-4" />
              Create Slice
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedItems.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
          >
            <Badge variant="secondary" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedItems.size} selected
            </Badge>
            <div className="flex items-center gap-2">
              <ResourceExportDropdown
                items={filteredSlices}
                selectedKeys={selectedItems}
                getKey={(es) => `${es.namespace}/${es.name}`}
                config={endpointSliceExportConfig}
                selectionLabel={selectedItems.size > 0 ? 'Selected slices' : 'All visible slices'}
                onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
                triggerLabel={selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}
              />
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                Clear
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stats Cards - Design 3.5: Total Slices, IPv4, IPv6, FQDN */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ListPageStatCard size="sm" label="Total Slices" value={stats.total} selected={!hasActiveFilters} onClick={clearAllFilters} className={cn(!hasActiveFilters && 'ring-2 ring-primary')} />
          <ListPageStatCard size="sm" label="IPv4 Slices" value={stats.ipv4} valueClassName="text-blue-600" selected={columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('IPv4')} onClick={() => setColumnFilter('addressType', new Set(['IPv4']))} className={cn(columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('IPv4') && 'ring-2 ring-primary')} />
          <ListPageStatCard size="sm" label="IPv6 Slices" value={stats.ipv6} valueClassName="text-purple-600" selected={columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('IPv6')} onClick={() => setColumnFilter('addressType', new Set(['IPv6']))} className={cn(columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('IPv6') && 'ring-2 ring-primary')} />
          <ListPageStatCard size="sm" label="FQDN Slices" value={stats.fqdn} valueClassName="text-cyan-600" selected={columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('FQDN')} onClick={() => setColumnFilter('addressType', new Set(['FQDN']))} className={cn(columnFilters.addressType?.size === 1 && columnFilters.addressType?.has('FQDN') && 'ring-2 ring-primary')} />
        </div>

        <ResourceCommandBar
          scope={
            <div className="w-full min-w-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full min-w-0 h-10 gap-2 justify-between truncate rounded-lg border border-border bg-background font-medium shadow-sm hover:bg-muted/50 hover:border-primary/30 focus-visible:ring-2 focus-visible:ring-primary/20">
                    <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search endpoint slices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
                aria-label="Search endpoint slices"
              />
            </div>
          }
          footer={hasActiveFilters || searchQuery ? (
            <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
          ) : undefined}
        />

        {/* Table */}
        <Card>
          <ResizableTableProvider tableId="kubilitics-resizable-table-endpointslices" columnConfig={ENDPOINTSLICES_TABLE_COLUMNS}>
            <div className="border border-border rounded-xl overflow-x-auto bg-card">
              <Table className="table-fixed" style={{ minWidth: 1100 }}>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                    <TableHead className="w-12">
                      <Checkbox checked={isAllSelected} onCheckedChange={toggleAllSelection} aria-label="Select all" className={isSomeSelected ? 'opacity-50' : ''} />
                    </TableHead>
                    <ResizableTableHead columnId="name">
                      <TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                    </ResizableTableHead>
                    <ResizableTableHead columnId="namespace">
                      <TableColumnHeaderWithFilterAndSort columnId="namespace" label="Namespace" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.namespace ?? []} selectedFilterValues={columnFilters.namespace ?? new Set()} onFilterChange={setColumnFilter} />
                    </ResizableTableHead>
                    <ResizableTableHead columnId="addressType">
                      <TableColumnHeaderWithFilterAndSort columnId="addressType" label="Address Type" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.addressType ?? []} selectedFilterValues={columnFilters.addressType ?? new Set()} onFilterChange={setColumnFilter} />
                    </ResizableTableHead>
                    <ResizableTableHead columnId="endpoints">
                      <TableColumnHeaderWithFilterAndSort columnId="endpoints" label="Endpoints" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                    </ResizableTableHead>
                    <TableHead>Ready</TableHead>
                    <TableHead>Serving</TableHead>
                    <TableHead>Terminating</TableHead>
                    <TableHead>Ports</TableHead>
                    <ResizableTableHead columnId="serviceName">Service</ResizableTableHead>
                    <ResizableTableHead columnId="age">
                      <TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                    </ResizableTableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemsOnPage.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={13} className="h-32 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Network className="h-8 w-8 opacity-50" />
                          <p>No endpoint slices found</p>
                          {(searchQuery || hasActiveFilters) && (
                            <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemsOnPage.map((es, idx) => {
                      const isSelected = selectedItems.has(`${es.namespace}/${es.name}`);
                      return (
                        <motion.tr
                          key={`${es.namespace}/${es.name}`}
                          initial={ROW_MOTION.initial}
                          animate={ROW_MOTION.animate}
                          transition={ROW_MOTION.transition(idx)}
                          className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}
                        >
                          <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(es)} aria-label={`Select ${es.name}`} /></TableCell>
                          <ResizableTableCell columnId="name"><Link to={`/endpointslices/${es.namespace}/${es.name}`} className="font-medium text-primary hover:underline truncate block">{es.name}</Link></ResizableTableCell>
                          <ResizableTableCell columnId="namespace"><Badge variant="outline">{es.namespace}</Badge></ResizableTableCell>
                          <ResizableTableCell columnId="addressType"><Badge variant="secondary">{es.addressType}</Badge></ResizableTableCell>
                          <ResizableTableCell columnId="endpoints"><span className="font-mono">{es.endpoints}</span></ResizableTableCell>
                          <TableCell><span className={cn('font-mono', es.ready > 0 ? 'text-[hsl(142,76%,36%)]' : 'text-muted-foreground')}>{es.ready}</span></TableCell>
                          <TableCell><span className="font-mono">{es.serving}</span></TableCell>
                          <TableCell><span className="font-mono">{es.terminating}</span></TableCell>
                          <TableCell><span className="font-mono text-xs truncate block">{es.ports}</span></TableCell>
                          <ResizableTableCell columnId="serviceName">
                            {es.serviceName !== '-' ? <Link to={`/services/${es.namespace}/${es.serviceName}`} className="text-primary hover:underline text-sm truncate block">{es.serviceName}</Link> : <span className="text-muted-foreground">—</span>}
                          </ResizableTableCell>
                          <ResizableTableCell columnId="age"><span className="text-muted-foreground">{es.age}</span></ResizableTableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => navigate(`/endpointslices/${es.namespace}/${es.name}`)}><ExternalLink className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                                {es.serviceName !== '-' && <DropdownMenuItem onClick={() => navigate(`/services/${es.namespace}/${es.serviceName}`)}><Link2 className="h-4 w-4 mr-2" />View Service</DropdownMenuItem>}
                                <DropdownMenuItem onClick={() => navigate(`/endpointslices/${es.namespace}/${es.name}?tab=yaml`)}><Download className="h-4 w-4 mr-2" />Download YAML</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </ResizableTableProvider>
        </Card>

        <div className="pt-4 pb-2 border-t border-border mt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">{totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No endpoint slices'}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="gap-2">{pageSize} per page<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <DropdownMenuItem key={size} onClick={() => { setPageSize(size); setPageIndex(0); }} className={cn(pageSize === size && 'bg-accent')}>{size} per page</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <ListPagination hasPrev={safePageIndex > 0} hasNext={start + pageSize < totalFiltered} onPrev={() => setPageIndex((i) => Math.max(0, i - 1))} onNext={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))} currentPage={safePageIndex + 1} totalPages={Math.max(1, totalPages)} onPageChange={(p) => setPageIndex(Math.max(0, p - 1))} />
          </div>
        </div>
      </motion.div>

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="EndpointSlice"
          defaultYaml={DEFAULT_YAMLS.EndpointSlice}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('EndpointSlice created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}