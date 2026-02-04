import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  RefreshCw, 
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Globe,
  Loader2,
  WifiOff,
  Plus,
  Trash2,
  ArrowUpDown,
  ChevronDown,
  CheckSquare,
  ExternalLink,
  Route,
  Lock,
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

interface K8sIngress extends KubernetesResource {
  spec?: {
    ingressClassName?: string;
    rules?: Array<{ host?: string }>;
    tls?: Array<{ hosts?: string[] }>;
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

interface Ingress {
  name: string;
  namespace: string;
  class: string;
  hosts: string;
  address: string;
  ports: string;
  tls: boolean;
  age: string;
  status: 'Healthy' | 'Pending' | 'Error';
}

const mockIngresses: Ingress[] = [
  { name: 'main-ingress', namespace: 'production', class: 'nginx', hosts: 'app.example.com', address: '34.120.10.100', ports: '80, 443', tls: true, age: '30d', status: 'Healthy' },
  { name: 'api-ingress', namespace: 'production', class: 'nginx', hosts: 'api.example.com', address: '34.120.10.100', ports: '80, 443', tls: true, age: '14d', status: 'Healthy' },
  { name: 'admin-ingress', namespace: 'production', class: 'nginx', hosts: 'admin.example.com', address: '34.120.10.100', ports: '443', tls: true, age: '60d', status: 'Healthy' },
  { name: 'staging-ingress', namespace: 'staging', class: 'nginx', hosts: 'staging.example.com', address: '<pending>', ports: '80, 443', tls: true, age: '1d', status: 'Pending' },
  { name: 'grafana-ingress', namespace: 'monitoring', class: 'nginx', hosts: 'grafana.example.com', address: '34.120.10.100', ports: '443', tls: true, age: '45d', status: 'Healthy' },
  { name: 'docs-ingress', namespace: 'production', class: 'nginx', hosts: 'docs.example.com', address: '34.120.10.100', ports: '80', tls: false, age: '20d', status: 'Healthy' },
  { name: 'multi-host', namespace: 'production', class: 'traefik', hosts: 'a.example.com, b.example.com', address: '34.120.10.101', ports: '80, 443', tls: true, age: '7d', status: 'Healthy' },
];

const statusConfig = {
  Healthy: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Pending: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Error: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

type SortKey = 'name' | 'namespace' | 'class' | 'status' | 'age';

export default function Ingresses() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Ingress | null; bulk?: boolean }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sIngress>('ingresses');
  const deleteResource = useDeleteK8sResource('ingresses');

  const ingresses: Ingress[] = config.isConnected && data?.items
    ? data.items.map((ing) => {
        const hosts = ing.spec?.rules?.map(r => r.host).filter(Boolean).join(', ') || '*';
        const lbIngress = ing.status?.loadBalancer?.ingress?.[0];
        const address = lbIngress?.ip || lbIngress?.hostname || '<pending>';
        const hasTLS = (ing.spec?.tls?.length ?? 0) > 0;
        return {
          name: ing.metadata.name,
          namespace: ing.metadata.namespace || 'default',
          class: ing.spec?.ingressClassName || '-',
          hosts,
          address,
          ports: hasTLS ? '80, 443' : '80',
          tls: hasTLS,
          age: calculateAge(ing.metadata.creationTimestamp),
          status: address === '<pending>' ? 'Pending' as const : 'Healthy' as const,
        };
      })
    : mockIngresses;

  const stats = useMemo(() => ({
    total: ingresses.length,
    healthy: ingresses.filter(i => i.status === 'Healthy').length,
    pending: ingresses.filter(i => i.status === 'Pending').length,
    withTLS: ingresses.filter(i => i.tls).length,
  }), [ingresses]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(ingresses.map(i => i.namespace)))];
  }, [ingresses]);

  const filteredIngresses = useMemo(() => {
    let result = ingresses.filter(ing => {
      const matchesSearch = ing.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ing.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ing.hosts.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || ing.namespace === selectedNamespace;
      const matchesStatus = statusFilter === 'all' || ing.status === statusFilter;
      return matchesSearch && matchesNamespace && matchesStatus;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'namespace': comparison = a.namespace.localeCompare(b.namespace); break;
        case 'class': comparison = a.class.localeCompare(b.class); break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [ingresses, searchQuery, selectedNamespace, statusFilter, sortKey, sortOrder]);

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
      toast.success(`Deleted ${selectedItems.size} ingresses`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (config.isConnected) {
        await deleteResource.mutateAsync({
          name: deleteDialog.item.name,
          namespace: deleteDialog.item.namespace,
        });
      } else {
        toast.success(`Ingress ${deleteDialog.item.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExportAll = () => {
    const itemsToExport = selectedItems.size > 0 
      ? filteredIngresses.filter(i => selectedItems.has(`${i.namespace}/${i.name}`))
      : filteredIngresses;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ingresses-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} ingresses`);
  };

  const toggleSelection = (item: Ingress) => {
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
    if (selectedItems.size === filteredIngresses.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredIngresses.map(i => `${i.namespace}/${i.name}`)));
    }
  };

  const isAllSelected = filteredIngresses.length > 0 && selectedItems.size === filteredIngresses.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredIngresses.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ingresses</h1>
            <p className="text-sm text-muted-foreground">
              {filteredIngresses.length} ingresses across {namespaces.length - 1} namespaces
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
            Create Ingress
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
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Ingresses</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", statusFilter === 'Healthy' && "border-primary")} onClick={() => setStatusFilter(statusFilter === 'Healthy' ? 'all' : 'Healthy')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.healthy}</div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", statusFilter === 'Pending' && "border-primary")} onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'all' : 'Pending')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-600">{stats.withTLS}</div>
              <Lock className="h-4 w-4 text-green-600" />
            </div>
            <div className="text-xs text-muted-foreground">With TLS</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingresses by name, namespace, or host..."
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
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-1">Status <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('class')}>
                <div className="flex items-center gap-1">Class <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead>Hosts</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>TLS</TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIngresses.map((ing) => {
              const StatusIcon = statusConfig[ing.status].icon;
              const isSelected = selectedItems.has(`${ing.namespace}/${ing.name}`);
              return (
                <TableRow key={`${ing.namespace}/${ing.name}`} className={cn(isSelected && "bg-primary/5")}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(ing)}
                      aria-label={`Select ${ing.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/ingresses/${ing.namespace}/${ing.name}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {ing.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{ing.namespace}</Badge></TableCell>
                  <TableCell>
                    <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', statusConfig[ing.status].bg, statusConfig[ing.status].color)}>
                      <StatusIcon className="h-3 w-3" />
                      {ing.status}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{ing.class}</Badge></TableCell>
                  <TableCell><span className="font-mono text-sm max-w-[200px] truncate block">{ing.hosts}</span></TableCell>
                  <TableCell>
                    <span className={cn('font-mono text-sm', ing.address === '<pending>' && 'text-[hsl(45,93%,47%)]')}>
                      {ing.address}
                    </span>
                  </TableCell>
                  <TableCell>
                    {ing.tls ? (
                      <Lock className="h-4 w-4 text-green-600" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell><span className="text-muted-foreground">{ing.age}</span></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/ingresses/${ing.namespace}/${ing.name}`)}>
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
                          onClick={() => setDeleteDialog({ open: true, item: ing })}
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

      {/* Create Wizard */}
      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Ingress"
          defaultYaml={DEFAULT_YAMLS.Ingress}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('Ingress created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Ingress"
        resourceName={deleteDialog.bulk ? `${selectedItems.size} ingresses` : deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
      />
    </motion.div>
  );
}
