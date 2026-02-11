import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter,
  RefreshCw, 
  MoreHorizontal,
  Download,
  Shield,
  Loader2,
  WifiOff,
  Plus,
  Trash2,
  ChevronDown,
  CheckSquare,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
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
import { ResizableTableProvider, ResizableTableHead, ResizableTableCell, type ResizableColumnConfig } from '@/components/ui/resizable-table';
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
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { DeleteConfirmDialog } from '@/components/resources';
import { NetworkPolicyWizard } from '@/components/wizards';
import { ResourceExportDropdown, ResourceCommandBar, ListPageStatCard, TableColumnHeaderWithFilterAndSort, ListPagination, PAGE_SIZE_OPTIONS, resourceTableRowClassName, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface K8sNetworkPolicy extends KubernetesResource {
  spec?: {
    podSelector?: { matchLabels?: Record<string, string> };
    policyTypes?: string[];
    ingress?: Array<{ from?: unknown[]; ports?: unknown[] }>;
    egress?: Array<{ to?: unknown[]; ports?: unknown[] }>;
  };
}

interface NetworkPolicy {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string[];
  ingressRules: number;
  egressRules: number;
  allowedSources: number;
  allowedDestinations: number;
  affectedPods: number;
  age: string;
}

const NETWORKPOLICIES_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 200, minWidth: 120 },
  { id: 'namespace', defaultWidth: 140, minWidth: 90 },
  { id: 'podSelector', defaultWidth: 180, minWidth: 100 },
  { id: 'affectedPods', defaultWidth: 110, minWidth: 80 },
  { id: 'policyTypes', defaultWidth: 140, minWidth: 90 },
  { id: 'ingressRules', defaultWidth: 110, minWidth: 80 },
  { id: 'egressRules', defaultWidth: 110, minWidth: 80 },
  { id: 'allowedSources', defaultWidth: 120, minWidth: 85 },
  { id: 'allowedDestinations', defaultWidth: 140, minWidth: 95 },
  { id: 'age', defaultWidth: 90, minWidth: 60 },
];

function podMatchesSelector(podLabels: Record<string, string> | undefined, matchLabels: Record<string, string> | undefined): boolean {
  if (!matchLabels || Object.keys(matchLabels).length === 0) return true;
  if (!podLabels) return false;
  return Object.entries(matchLabels).every(([k, v]) => podLabels[k] === v);
}

export default function NetworkPolicies() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: NetworkPolicy | null; bulk?: boolean }>({ open: false, item: null });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = useK8sResourceList<K8sNetworkPolicy>('networkpolicies', undefined, { limit: 5000 });
  const { data: podsData } = useK8sResourceList<KubernetesResource>('pods', undefined, { limit: 10000, enabled: isConnected });
  const deleteResource = useDeleteK8sResource('networkpolicies');

  const podsByNamespace = useMemo(() => {
    const map = new Map<string, Array<{ labels?: Record<string, string> }>>();
    if (!podsData?.items?.length) return map;
    (podsData.items as KubernetesResource[]).forEach((p) => {
      const ns = p.metadata?.namespace ?? '';
      const list = map.get(ns) ?? [];
      list.push({ labels: p.metadata?.labels as Record<string, string> | undefined });
      map.set(ns, list);
    });
    return map;
  }, [podsData?.items]);

  const networkpolicies: NetworkPolicy[] = useMemo(() => {
    if (!isConnected || !data?.items?.length) return [];
    const matchLabelsByKey = new Map<string, Record<string, string> | undefined>();
    return (data.items as K8sNetworkPolicy[]).map((np) => {
      const labels = np.spec?.podSelector?.matchLabels;
      const podSelector = labels 
        ? Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ') 
        : 'All Pods';
      const ingress = np.spec?.ingress ?? [];
      const egress = np.spec?.egress ?? [];
      const allowedSources = ingress.reduce((sum, r) => sum + (Array.isArray(r.from) ? r.from.length : 0), 0);
      const allowedDestinations = egress.reduce((sum, r) => sum + (Array.isArray(r.to) ? r.to.length : 0), 0);
      const ns = np.metadata.namespace || 'default';
      const podsInNs = podsByNamespace.get(ns) ?? [];
      const affectedPods = podsInNs.filter((p) => podMatchesSelector(p.labels, labels)).length;
      return {
        name: np.metadata.name,
        namespace: ns,
        podSelector,
        policyTypes: np.spec?.policyTypes || ['Ingress'],
        ingressRules: ingress.length,
        egressRules: egress.length,
        allowedSources,
        allowedDestinations,
        affectedPods,
        age: calculateAge(np.metadata.creationTimestamp),
      };
    });
  }, [isConnected, data?.items, podsByNamespace]);

  const stats = useMemo(() => {
    let unprotectedPods = 0;
    const npList = (data?.items ?? []) as K8sNetworkPolicy[];
    if (npList.length > 0 && podsByNamespace.size > 0) {
      podsByNamespace.forEach((pods, ns) => {
        const policiesInNs = npList.filter((np) => (np.metadata?.namespace ?? 'default') === ns);
        pods.forEach((p) => {
          const covered = policiesInNs.some((np) => podMatchesSelector(p.labels, np.spec?.podSelector?.matchLabels));
          if (!covered) unprotectedPods += 1;
        });
      });
    }
    return {
      total: networkpolicies.length,
      withIngress: networkpolicies.filter((np) => np.ingressRules > 0 || np.policyTypes.includes('Ingress')).length,
      withEgress: networkpolicies.filter((np) => np.egressRules > 0 || np.policyTypes.includes('Egress')).length,
      defaultDeny: networkpolicies.filter(
        (np) =>
          (np.policyTypes.includes('Ingress') && np.ingressRules === 0) ||
          (np.policyTypes.includes('Egress') && np.egressRules === 0)
      ).length,
      unprotectedPods,
    };
  }, [networkpolicies, data?.items, podsByNamespace]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(networkpolicies.map(np => np.namespace)))];
  }, [networkpolicies]);

  const itemsAfterSearchAndNs = useMemo(() => {
    return networkpolicies.filter(np => {
      const matchesSearch = np.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           np.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           np.podSelector.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || np.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });
  }, [networkpolicies, searchQuery, selectedNamespace]);

  const policyTypeValue = (np: NetworkPolicy) =>
    np.policyTypes.includes('Ingress') && np.policyTypes.includes('Egress') ? 'Both' : np.policyTypes.includes('Ingress') ? 'Ingress' : 'Egress';

  const networkPoliciesTableConfig: ColumnConfig<NetworkPolicy>[] = useMemo(() => [
    { columnId: 'name', getValue: (np) => np.name, sortable: true, filterable: false },
    { columnId: 'namespace', getValue: (np) => np.namespace, sortable: true, filterable: true },
    { columnId: 'podSelector', getValue: (np) => np.podSelector, sortable: true, filterable: false },
    { columnId: 'affectedPods', getValue: (np) => np.affectedPods, sortable: true, filterable: false },
    { columnId: 'policyType', getValue: policyTypeValue, sortable: false, filterable: true },
    { columnId: 'ingressRules', getValue: (np) => np.ingressRules, sortable: true, filterable: false },
    { columnId: 'egressRules', getValue: (np) => np.egressRules, sortable: true, filterable: false },
    { columnId: 'allowedSources', getValue: (np) => np.allowedSources, sortable: true, filterable: false },
    { columnId: 'allowedDestinations', getValue: (np) => np.allowedDestinations, sortable: true, filterable: false },
    { columnId: 'age', getValue: (np) => np.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredPolicies, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(itemsAfterSearchAndNs, { columns: networkPoliciesTableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const totalFiltered = filteredPolicies.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = filteredPolicies.slice(start, start + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) {
      for (const key of selectedItems) {
        const [namespace, name] = key.split('/');
        if (isConnected) {
          await deleteResource.mutateAsync({ name, namespace });
        }
      }
      toast.success(`Deleted ${selectedItems.size} network policies`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (isConnected) {
        await deleteResource.mutateAsync({
          name: deleteDialog.item.name,
          namespace: deleteDialog.item.namespace,
        });
      } else {
        toast.success(`NetworkPolicy ${deleteDialog.item.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, item: null });
  };

  const networkPolicyExportConfig = {
    filenamePrefix: 'networkpolicies',
    resourceLabel: 'network policies',
    getExportData: (np: NetworkPolicy) => ({ name: np.name, namespace: np.namespace, podSelector: np.podSelector, affectedPods: np.affectedPods, policyTypes: np.policyTypes.join(', '), ingressRules: np.ingressRules, egressRules: np.egressRules, allowedSources: np.allowedSources, allowedDestinations: np.allowedDestinations, age: np.age }),
    csvColumns: [
      { label: 'Name', getValue: (np: NetworkPolicy) => np.name },
      { label: 'Namespace', getValue: (np: NetworkPolicy) => np.namespace },
      { label: 'Pod Selector', getValue: (np: NetworkPolicy) => np.podSelector },
      { label: 'Affected Pods', getValue: (np: NetworkPolicy) => np.affectedPods },
      { label: 'Policy Types', getValue: (np: NetworkPolicy) => np.policyTypes.join(', ') },
      { label: 'Ingress Rules', getValue: (np: NetworkPolicy) => np.ingressRules },
      { label: 'Egress Rules', getValue: (np: NetworkPolicy) => np.egressRules },
      { label: 'Allowed Sources', getValue: (np: NetworkPolicy) => np.allowedSources },
      { label: 'Allowed Destinations', getValue: (np: NetworkPolicy) => np.allowedDestinations },
      { label: 'Age', getValue: (np: NetworkPolicy) => np.age },
    ],
    toK8sYaml: (np: NetworkPolicy) => `---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${np.name}
  namespace: ${np.namespace}
spec:
  podSelector: {}
  policyTypes: [${np.policyTypes.map(t => `"${t}"`).join(', ')}]
  ingress: []
  egress: []
`,
  };

  const toggleSelection = (item: NetworkPolicy) => {
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
    if (selectedItems.size === filteredPolicies.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredPolicies.map(np => `${np.namespace}/${np.name}`)));
    }
  };

  const isAllSelected = filteredPolicies.length > 0 && selectedItems.size === filteredPolicies.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredPolicies.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Network Policies</h1>
            <p className="text-sm text-muted-foreground">
              {filteredPolicies.length} policies across {namespaces.length - 1} namespaces
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
            items={filteredPolicies}
            selectedKeys={selectedItems}
            getKey={(np) => `${np.namespace}/${np.name}`}
            config={networkPolicyExportConfig}
            selectionLabel={selectedItems.size > 0 ? 'Selected network policies' : 'All visible network policies'}
            onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
          />
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}>
            <Plus className="h-4 w-4" />
            Create Policy
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
              items={filteredPolicies}
              selectedKeys={selectedItems}
              getKey={(np) => `${np.namespace}/${np.name}`}
              config={networkPolicyExportConfig}
              selectionLabel={selectedItems.size > 0 ? 'Selected network policies' : 'All visible network policies'}
              onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
              triggerLabel={selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}
            />
            <Button 
              variant="destructive" 
              size="sm" 
              className="gap-1.5"
              onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
              Clear
            </Button>
          </div>
        </motion.div>
      )}

      {/* Stats Cards - Design 3.6: Total, Ingress Rules, Egress Rules, Default Deny, Unprotected Pods */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ListPageStatCard size="sm" label="Total Policies" value={stats.total} selected={!hasActiveFilters} onClick={clearAllFilters} className={cn(!hasActiveFilters && 'ring-2 ring-primary')} />
        <ListPageStatCard size="sm" label="Ingress Rules" value={stats.withIngress} valueClassName="text-blue-600" icon={ArrowDownToLine} iconColor="text-blue-600" />
        <ListPageStatCard size="sm" label="Egress Rules" value={stats.withEgress} valueClassName="text-orange-600" icon={ArrowUpFromLine} iconColor="text-orange-600" />
        <ListPageStatCard size="sm" label="Default Deny" value={stats.defaultDeny} valueClassName="text-purple-600" />
        <ListPageStatCard size="sm" label="Unprotected Pods" value={stats.unprotectedPods} valueClassName="text-[hsl(45,93%,47%)]" />
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
              placeholder="Search network policies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
              aria-label="Search network policies"
            />
          </div>
        }
        footer={hasActiveFilters || searchQuery ? (
          <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
        ) : undefined}
      />

      {/* Table */}
      <Card>
        <ResizableTableProvider tableId="kubilitics-resizable-table-networkpolicies" columnConfig={NETWORKPOLICIES_TABLE_COLUMNS}>
          <div className="border border-border rounded-xl overflow-x-auto bg-card">
            <Table className="table-fixed" style={{ minWidth: 1340 }}>
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
                  <ResizableTableHead columnId="podSelector">
                    <TableColumnHeaderWithFilterAndSort columnId="podSelector" label="Pod Selector" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="affectedPods">Affected Pods</ResizableTableHead>
                  <ResizableTableHead columnId="policyTypes">Policy Types</ResizableTableHead>
                  <ResizableTableHead columnId="ingressRules">Ingress Rules</ResizableTableHead>
                  <ResizableTableHead columnId="egressRules">Egress Rules</ResizableTableHead>
                  <ResizableTableHead columnId="allowedSources">Allowed Sources</ResizableTableHead>
                  <ResizableTableHead columnId="allowedDestinations">Allowed Destinations</ResizableTableHead>
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
                        <Shield className="h-8 w-8 opacity-50" />
                        <p>No network policies found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  itemsOnPage.map((np, idx) => {
                    const isSelected = selectedItems.has(`${np.namespace}/${np.name}`);
                    return (
                      <motion.tr
                        key={`${np.namespace}/${np.name}`}
                        initial={ROW_MOTION.initial}
                        animate={ROW_MOTION.animate}
                        transition={ROW_MOTION.transition(idx)}
                        className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}
                      >
                        <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(np)} aria-label={`Select ${np.name}`} /></TableCell>
                        <ResizableTableCell columnId="name"><Link to={`/networkpolicies/${np.namespace}/${np.name}`} className="font-medium text-primary hover:underline truncate block">{np.name}</Link></ResizableTableCell>
                        <ResizableTableCell columnId="namespace"><Badge variant="outline">{np.namespace}</Badge></ResizableTableCell>
                        <ResizableTableCell columnId="podSelector"><span className="font-mono text-sm truncate block" title={np.podSelector}>{np.podSelector}</span></ResizableTableCell>
                        <ResizableTableCell columnId="affectedPods"><span className="font-mono">{np.affectedPods > 0 ? np.affectedPods : '—'}</span></ResizableTableCell>
                        <ResizableTableCell columnId="policyTypes">
                          <div className="flex gap-1 flex-wrap">
                            {np.policyTypes.map((type) => (
                              <Badge key={type} variant="secondary" className={cn("text-xs", type === 'Ingress' && "bg-blue-500/10 text-blue-600", type === 'Egress' && "bg-orange-500/10 text-orange-600")}>{type}</Badge>
                            ))}
                          </div>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="ingressRules"><span className="font-mono">{np.ingressRules}</span></ResizableTableCell>
                        <ResizableTableCell columnId="egressRules"><span className="font-mono">{np.egressRules}</span></ResizableTableCell>
                        <ResizableTableCell columnId="allowedSources"><span className="font-mono">{np.allowedSources}</span></ResizableTableCell>
                        <ResizableTableCell columnId="allowedDestinations"><span className="font-mono">{np.allowedDestinations}</span></ResizableTableCell>
                        <ResizableTableCell columnId="age"><span className="text-muted-foreground">{np.age}</span></ResizableTableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => navigate(`/networkpolicies/${np.namespace}/${np.name}`)}><ExternalLink className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/networkpolicies/${np.namespace}/${np.name}?tab=simulation`)}>Simulate Policy</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/networkpolicies/${np.namespace}/${np.name}?tab=pods`)}>View Affected Pods</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/networkpolicies/${np.namespace}/${np.name}?tab=yaml`)}><Download className="h-4 w-4 mr-2" />Download YAML</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteDialog({ open: true, item: np })}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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
            <span className="text-sm text-muted-foreground">{totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No network policies'}</span>
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

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="NetworkPolicy"
        resourceName={deleteDialog.bulk ? `${selectedItems.size} policies` : deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
      />

      {showCreateWizard && (
        <NetworkPolicyWizard
          onClose={() => setShowCreateWizard(false)}
          onSubmit={() => { setShowCreateWizard(false); refetch(); }}
        />
      )}
    </motion.div>
  );
}
