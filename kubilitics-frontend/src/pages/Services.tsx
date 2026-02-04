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
  GitCompare,
  CheckSquare,
  Square,
  Minus,
  ExternalLink,
  Link2,
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
import { DeleteConfirmDialog, PortForwardDialog } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface ServiceResource extends KubernetesResource {
  spec: {
    type: string;
    clusterIP: string;
    ports?: Array<{ port: number; protocol: string; targetPort?: number; nodePort?: number }>;
    externalIPs?: string[];
    selector?: Record<string, string>;
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

interface Service {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  clusterIP: string;
  externalIP: string;
  ports: string;
  selector: string;
  age: string;
  status: 'Healthy' | 'Pending' | 'Error';
  containers: Array<{ name: string; ports?: Array<{ containerPort: number; name?: string; protocol?: string }> }>;
}

const mockServices: Service[] = [
  { name: 'nginx-svc', namespace: 'production', type: 'ClusterIP', clusterIP: '10.96.0.100', externalIP: '-', ports: '80/TCP', selector: 'app=nginx', age: '30d', status: 'Healthy', containers: [{ name: 'nginx', ports: [{ containerPort: 80, name: 'http' }] }] },
  { name: 'api-gateway', namespace: 'production', type: 'LoadBalancer', clusterIP: '10.96.0.101', externalIP: '34.120.10.50', ports: '443/TCP', selector: 'app=gateway', age: '14d', status: 'Healthy', containers: [{ name: 'gateway', ports: [{ containerPort: 443, name: 'https' }] }] },
  { name: 'frontend', namespace: 'production', type: 'LoadBalancer', clusterIP: '10.96.0.102', externalIP: '34.120.10.51', ports: '80/TCP,443/TCP', selector: 'app=frontend', age: '7d', status: 'Healthy', containers: [{ name: 'frontend', ports: [{ containerPort: 80 }, { containerPort: 443 }] }] },
  { name: 'redis', namespace: 'production', type: 'ClusterIP', clusterIP: '10.96.0.103', externalIP: '-', ports: '6379/TCP', selector: 'app=redis', age: '60d', status: 'Healthy', containers: [{ name: 'redis', ports: [{ containerPort: 6379, name: 'redis' }] }] },
  { name: 'pending-lb', namespace: 'staging', type: 'LoadBalancer', clusterIP: '10.96.0.201', externalIP: '<pending>', ports: '80/TCP', selector: 'app=pending', age: '1h', status: 'Pending', containers: [{ name: 'app', ports: [{ containerPort: 80 }] }] },
  { name: 'kubernetes', namespace: 'default', type: 'ClusterIP', clusterIP: '10.96.0.1', externalIP: '-', ports: '443/TCP', selector: '-', age: '180d', status: 'Healthy', containers: [{ name: 'apiserver', ports: [{ containerPort: 443, name: 'https' }] }] },
  { name: 'kube-dns', namespace: 'kube-system', type: 'ClusterIP', clusterIP: '10.96.0.10', externalIP: '-', ports: '53/UDP,53/TCP', selector: 'k8s-app=kube-dns', age: '180d', status: 'Healthy', containers: [{ name: 'coredns', ports: [{ containerPort: 53, name: 'dns' }] }] },
  { name: 'postgres-headless', namespace: 'production', type: 'ClusterIP', clusterIP: 'None', externalIP: '-', ports: '5432/TCP', selector: 'app=postgres', age: '45d', status: 'Healthy', containers: [{ name: 'postgres', ports: [{ containerPort: 5432, name: 'postgres' }] }] },
  { name: 'metrics-server', namespace: 'kube-system', type: 'ClusterIP', clusterIP: '10.96.0.50', externalIP: '-', ports: '443/TCP', selector: 'k8s-app=metrics-server', age: '90d', status: 'Healthy', containers: [{ name: 'metrics-server', ports: [{ containerPort: 443, name: 'https' }] }] },
  { name: 'grafana', namespace: 'monitoring', type: 'NodePort', clusterIP: '10.96.0.60', externalIP: '-', ports: '3000:32000/TCP', selector: 'app=grafana', age: '30d', status: 'Healthy', containers: [{ name: 'grafana', ports: [{ containerPort: 3000, name: 'http' }] }] },
];

const statusConfig = {
  Healthy: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Pending: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Error: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

const typeColors: Record<string, string> = {
  ClusterIP: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  NodePort: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  LoadBalancer: 'bg-green-500/10 text-green-600 dark:text-green-400',
  ExternalName: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

function transformServiceResource(resource: ServiceResource): Service {
  const ports = resource.spec?.ports?.map(p => {
    const portStr = p.nodePort ? `${p.port}:${p.nodePort}/${p.protocol}` : `${p.port}/${p.protocol}`;
    return portStr;
  }).join(',') || '-';

  let externalIP = '-';
  if (resource.spec?.type === 'LoadBalancer') {
    const ingress = resource.status?.loadBalancer?.ingress;
    if (ingress && ingress.length > 0) {
      externalIP = ingress[0].ip || ingress[0].hostname || '-';
    } else {
      externalIP = '<pending>';
    }
  } else if (resource.spec?.externalIPs?.length) {
    externalIP = resource.spec.externalIPs.join(',');
  }

  const status: Service['status'] = externalIP === '<pending>' ? 'Pending' : 'Healthy';
  const selector = resource.spec?.selector 
    ? Object.entries(resource.spec.selector).map(([k, v]) => `${k}=${v}`).join(',')
    : '-';

  const containers = resource.spec?.ports?.map(p => ({
    name: 'service',
    ports: [{ containerPort: p.targetPort || p.port, name: p.protocol, protocol: p.protocol }],
  })) || [];

  return {
    name: resource.metadata.name,
    namespace: resource.metadata.namespace || 'default',
    type: resource.spec?.type as Service['type'] || 'ClusterIP',
    clusterIP: resource.spec?.clusterIP || '-',
    externalIP,
    ports,
    selector,
    age: calculateAge(resource.metadata.creationTimestamp),
    status,
    containers,
  };
}

type SortKey = 'name' | 'namespace' | 'type' | 'status' | 'age';

export default function Services() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Service | null; bulk?: boolean }>({ open: false, item: null });
  const [portForwardDialog, setPortForwardDialog] = useState<{ open: boolean; item: Service | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<ServiceResource>('services');
  const deleteResource = useDeleteK8sResource('services');

  const services: Service[] = config.isConnected && data?.items
    ? data.items.map(transformServiceResource)
    : mockServices;

  // Calculate stats
  const stats = useMemo(() => ({
    total: services.length,
    healthy: services.filter(s => s.status === 'Healthy').length,
    pending: services.filter(s => s.status === 'Pending').length,
    clusterIP: services.filter(s => s.type === 'ClusterIP').length,
    loadBalancer: services.filter(s => s.type === 'LoadBalancer').length,
    nodePort: services.filter(s => s.type === 'NodePort').length,
  }), [services]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(services.map(s => s.namespace)))];
  }, [services]);

  const filteredServices = useMemo(() => {
    let result = services.filter(svc => {
      const matchesSearch = svc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           svc.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           svc.clusterIP.includes(searchQuery);
      const matchesNamespace = selectedNamespace === 'all' || svc.namespace === selectedNamespace;
      const matchesType = typeFilter === 'all' || svc.type === typeFilter;
      return matchesSearch && matchesNamespace && matchesType;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'namespace': comparison = a.namespace.localeCompare(b.namespace); break;
        case 'type': comparison = a.type.localeCompare(b.type); break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [services, searchQuery, selectedNamespace, typeFilter, sortKey, sortOrder]);

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
      toast.success(`Deleted ${selectedItems.size} services`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (config.isConnected) {
        await deleteResource.mutateAsync({
          name: deleteDialog.item.name,
          namespace: deleteDialog.item.namespace,
        });
      } else {
        toast.success(`Service ${deleteDialog.item.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExportAll = () => {
    const itemsToExport = selectedItems.size > 0 
      ? filteredServices.filter(s => selectedItems.has(`${s.namespace}/${s.name}`))
      : filteredServices;
    const exportData = itemsToExport.map(s => ({
      name: s.name,
      namespace: s.namespace,
      type: s.type,
      clusterIP: s.clusterIP,
      externalIP: s.externalIP,
      ports: s.ports,
      age: s.age,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'services-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} services`);
  };

  const toggleSelection = (item: Service) => {
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
    if (selectedItems.size === filteredServices.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredServices.map(s => `${s.namespace}/${s.name}`)));
    }
  };

  const isAllSelected = filteredServices.length > 0 && selectedItems.size === filteredServices.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredServices.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
            <p className="text-sm text-muted-foreground">
              {filteredServices.length} services across {namespaces.length - 1} namespaces
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
            Create Service
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
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <CheckSquare className="h-3.5 w-3.5" />
              {selectedItems.size} selected
            </Badge>
          </div>
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setTypeFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Services</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setTypeFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.healthy}</div>
            <div className="text-xs text-muted-foreground">Healthy</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setTypeFilter('all')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", typeFilter === 'ClusterIP' && "border-primary")} onClick={() => setTypeFilter(typeFilter === 'ClusterIP' ? 'all' : 'ClusterIP')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.clusterIP}</div>
            <div className="text-xs text-muted-foreground">ClusterIP</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", typeFilter === 'LoadBalancer' && "border-primary")} onClick={() => setTypeFilter(typeFilter === 'LoadBalancer' ? 'all' : 'LoadBalancer')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.loadBalancer}</div>
            <div className="text-xs text-muted-foreground">LoadBalancer</div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:border-primary/50 transition-colors", typeFilter === 'NodePort' && "border-primary")} onClick={() => setTypeFilter(typeFilter === 'NodePort' ? 'all' : 'NodePort')}>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">{stats.nodePort}</div>
            <div className="text-xs text-muted-foreground">NodePort</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search services by name, namespace, or IP..."
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
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('type')}>
                <div className="flex items-center gap-1">Type <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead>Cluster IP</TableHead>
              <TableHead>External IP</TableHead>
              <TableHead>Ports</TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredServices.map((svc) => {
              const StatusIcon = statusConfig[svc.status].icon;
              const isSelected = selectedItems.has(`${svc.namespace}/${svc.name}`);
              return (
                <TableRow key={`${svc.namespace}/${svc.name}`} className={cn(isSelected && "bg-primary/5")}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(svc)}
                      aria-label={`Select ${svc.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/services/${svc.namespace}/${svc.name}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {svc.name}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant="outline">{svc.namespace}</Badge></TableCell>
                  <TableCell>
                    <Badge className={cn('font-medium', typeColors[svc.type])}>{svc.type}</Badge>
                  </TableCell>
                  <TableCell><span className="font-mono text-sm">{svc.clusterIP}</span></TableCell>
                  <TableCell>
                    <span className={cn('font-mono text-sm', svc.externalIP === '<pending>' && 'text-[hsl(45,93%,47%)]')}>
                      {svc.externalIP}
                    </span>
                  </TableCell>
                  <TableCell><span className="font-mono text-xs">{svc.ports}</span></TableCell>
                  <TableCell><span className="text-muted-foreground">{svc.age}</span></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/services/${svc.namespace}/${svc.name}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/endpoints/${svc.namespace}/${svc.name}`)}>
                          <Link2 className="h-4 w-4 mr-2" />
                          View Endpoints
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setPortForwardDialog({ open: true, item: svc })}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Port Forward
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteDialog({ open: true, item: svc })}
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

      {/* Create Wizard Dialog */}
      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Service"
          defaultYaml={DEFAULT_YAMLS.Service}
          onClose={() => setShowCreateWizard(false)}
          onApply={(yaml) => {
            console.log('Creating Service with YAML:', yaml);
            toast.success('Service created successfully (demo mode)');
            setShowCreateWizard(false);
            refetch();
          }}
          clusterName="docker-desktop"
        />
      )}

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Service"
        resourceName={deleteDialog.bulk ? `${selectedItems.size} services` : deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
      />

      {/* Port Forward Dialog */}
      {portForwardDialog.item && (
        <PortForwardDialog
          open={portForwardDialog.open}
          onOpenChange={(open) => setPortForwardDialog({ open, item: open ? portForwardDialog.item : null })}
          podName={portForwardDialog.item.name}
          namespace={portForwardDialog.item.namespace}
          containers={portForwardDialog.item.containers}
        />
      )}
    </motion.div>
  );
}
