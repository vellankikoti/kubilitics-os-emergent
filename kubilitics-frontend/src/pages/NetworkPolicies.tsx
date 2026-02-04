import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  RefreshCw, 
  MoreHorizontal,
  Download,
  Shield,
  Loader2,
  WifiOff,
  Plus,
  Trash2,
  ArrowUpDown,
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
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { DeleteConfirmDialog } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface K8sNetworkPolicy extends KubernetesResource {
  spec?: {
    podSelector?: { matchLabels?: Record<string, string> };
    policyTypes?: string[];
    ingress?: Array<unknown>;
    egress?: Array<unknown>;
  };
}

interface NetworkPolicy {
  name: string;
  namespace: string;
  podSelector: string;
  policyTypes: string[];
  ingressRules: number;
  egressRules: number;
  age: string;
}

const mockNetworkPolicies: NetworkPolicy[] = [
  { name: 'deny-all-ingress', namespace: 'production', podSelector: 'All Pods', policyTypes: ['Ingress'], ingressRules: 0, egressRules: 0, age: '60d' },
  { name: 'allow-frontend', namespace: 'production', podSelector: 'app=frontend', policyTypes: ['Ingress'], ingressRules: 3, egressRules: 0, age: '60d' },
  { name: 'allow-api-to-db', namespace: 'production', podSelector: 'app=postgres', policyTypes: ['Ingress'], ingressRules: 2, egressRules: 0, age: '60d' },
  { name: 'restrict-egress', namespace: 'production', podSelector: 'tier=backend', policyTypes: ['Egress'], ingressRules: 0, egressRules: 5, age: '30d' },
  { name: 'allow-monitoring', namespace: 'monitoring', podSelector: 'All Pods', policyTypes: ['Ingress', 'Egress'], ingressRules: 2, egressRules: 3, age: '45d' },
  { name: 'staging-default', namespace: 'staging', podSelector: 'All Pods', policyTypes: ['Ingress'], ingressRules: 1, egressRules: 0, age: '14d' },
  { name: 'database-isolation', namespace: 'production', podSelector: 'app=redis', policyTypes: ['Ingress', 'Egress'], ingressRules: 1, egressRules: 1, age: '90d' },
  { name: 'external-access', namespace: 'production', podSelector: 'tier=frontend', policyTypes: ['Ingress'], ingressRules: 4, egressRules: 0, age: '25d' },
];

type SortKey = 'name' | 'namespace' | 'podSelector' | 'age';

export default function NetworkPolicies() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: NetworkPolicy | null; bulk?: boolean }>({ open: false, item: null });
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [policyTypeFilter, setPolicyTypeFilter] = useState<string>('all');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sNetworkPolicy>('networkpolicies');
  const deleteResource = useDeleteK8sResource('networkpolicies');

  const networkpolicies: NetworkPolicy[] = config.isConnected && data?.items
    ? data.items.map((np) => {
        const labels = np.spec?.podSelector?.matchLabels;
        const podSelector = labels 
          ? Object.entries(labels).map(([k, v]) => `${k}=${v}`).join(', ') 
          : 'All Pods';
        return {
          name: np.metadata.name,
          namespace: np.metadata.namespace || 'default',
          podSelector,
          policyTypes: np.spec?.policyTypes || ['Ingress'],
          ingressRules: np.spec?.ingress?.length || 0,
          egressRules: np.spec?.egress?.length || 0,
          age: calculateAge(np.metadata.creationTimestamp),
        };
      })
    : mockNetworkPolicies;

  const stats = useMemo(() => ({
    total: networkpolicies.length,
    ingress: networkpolicies.filter(np => np.policyTypes.includes('Ingress')).length,
    egress: networkpolicies.filter(np => np.policyTypes.includes('Egress')).length,
    both: networkpolicies.filter(np => np.policyTypes.includes('Ingress') && np.policyTypes.includes('Egress')).length,
  }), [networkpolicies]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(networkpolicies.map(np => np.namespace)))];
  }, [networkpolicies]);

  const filteredPolicies = useMemo(() => {
    let result = networkpolicies.filter(np => {
      const matchesSearch = np.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           np.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           np.podSelector.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || np.namespace === selectedNamespace;
      const matchesType = policyTypeFilter === 'all' || np.policyTypes.includes(policyTypeFilter);
      return matchesSearch && matchesNamespace && matchesType;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'namespace': comparison = a.namespace.localeCompare(b.namespace); break;
        case 'podSelector': comparison = a.podSelector.localeCompare(b.podSelector); break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [networkpolicies, searchQuery, selectedNamespace, policyTypeFilter, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) {
      for (const key of selectedItems) {
        const [namespace, name] = key.split('/');
        if (config.isConnected) {
          await deleteResource.mutateAsync({ name, namespace });
        }
      }
      toast.success(`Deleted ${selectedItems.size} network policies`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (config.isConnected) {
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

  const handleExportAll = () => {
    const itemsToExport = selectedItems.size > 0 
      ? filteredPolicies.filter(np => selectedItems.has(`${np.namespace}/${np.name}`))
      : filteredPolicies;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'networkpolicies-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} network policies`);
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
              {!config.isConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                  <WifiOff className="h-3 w-3" /> Demo mode
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportAll}>
            <Download className="h-4 w-4" />
            {selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}
          </Button>
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
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportAll}>
              <Download className="h-3.5 w-3.5" />
              Export YAML
            </Button>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setPolicyTypeFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Policies</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", policyTypeFilter === 'Ingress' && "border-primary")} onClick={() => setPolicyTypeFilter(policyTypeFilter === 'Ingress' ? 'all' : 'Ingress')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-blue-600">{stats.ingress}</div>
              <ArrowDownToLine className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-xs text-muted-foreground">Ingress Policies</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", policyTypeFilter === 'Egress' && "border-primary")} onClick={() => setPolicyTypeFilter(policyTypeFilter === 'Egress' ? 'all' : 'Egress')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-orange-600">{stats.egress}</div>
              <ArrowUpFromLine className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-xs text-muted-foreground">Egress Policies</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.both}</div>
            <div className="text-xs text-muted-foreground">Both Types</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search network policies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[140px]">
              {selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {namespaces.map((ns) => (
              <DropdownMenuItem key={ns} onClick={() => setSelectedNamespace(ns)}>
                {ns === 'all' ? 'All Namespaces' : ns}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleAllSelection}
                  aria-label="Select all"
                  className={isSomeSelected ? 'opacity-50' : ''}
                />
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">Name <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('namespace')}>
                <div className="flex items-center gap-1">Namespace <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('podSelector')}>
                <div className="flex items-center gap-1">Pod Selector <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead>Policy Types</TableHead>
              <TableHead>Ingress Rules</TableHead>
              <TableHead>Egress Rules</TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPolicies.map((np) => {
              const isSelected = selectedItems.has(`${np.namespace}/${np.name}`);
              return (
                <TableRow key={`${np.namespace}/${np.name}`} className={cn(isSelected && "bg-primary/5")}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(np)}
                      aria-label={`Select ${np.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/networkpolicies/${np.namespace}/${np.name}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {np.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{np.namespace}</Badge></TableCell>
                  <TableCell><span className="font-mono text-sm">{np.podSelector}</span></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {np.policyTypes.map((type) => (
                        <Badge 
                          key={type} 
                          variant="secondary" 
                          className={cn(
                            "text-xs",
                            type === 'Ingress' && "bg-blue-500/10 text-blue-600",
                            type === 'Egress' && "bg-orange-500/10 text-orange-600"
                          )}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{np.ingressRules}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{np.egressRules}</span>
                  </TableCell>
                  <TableCell><span className="text-muted-foreground">{np.age}</span></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/networkpolicies/${np.namespace}/${np.name}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Download YAML
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteDialog({ open: true, item: np })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

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
        <ResourceCreator
          resourceKind="NetworkPolicy"
          defaultYaml={DEFAULT_YAMLS.NetworkPolicy}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('NetworkPolicy created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </motion.div>
  );
}
