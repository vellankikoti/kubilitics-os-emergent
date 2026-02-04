import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  RefreshCw, 
  MoreHorizontal,
  Download,
  Network,
  Loader2,
  WifiOff,
  ArrowUpDown,
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
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';

interface K8sEndpoint extends KubernetesResource {
  subsets?: Array<{
    addresses?: Array<{ ip: string; nodeName?: string; targetRef?: { name: string; namespace: string } }>;
    notReadyAddresses?: Array<{ ip: string }>;
    ports?: Array<{ port: number; name?: string; protocol?: string }>;
  }>;
}

interface Endpoint {
  name: string;
  namespace: string;
  endpoints: string;
  readyCount: number;
  notReadyCount: number;
  ports: string;
  age: string;
}

const mockEndpoints: Endpoint[] = [
  { name: 'nginx-svc', namespace: 'production', endpoints: '10.244.1.45:8080, 10.244.2.46:8080, 10.244.3.47:8080', readyCount: 3, notReadyCount: 0, ports: '8080/TCP', age: '30d' },
  { name: 'api-gateway', namespace: 'production', endpoints: '10.244.1.50:443, 10.244.2.51:443', readyCount: 2, notReadyCount: 0, ports: '443/TCP', age: '14d' },
  { name: 'frontend', namespace: 'production', endpoints: '10.244.1.60:80, 10.244.2.61:80', readyCount: 2, notReadyCount: 0, ports: '80/TCP', age: '7d' },
  { name: 'redis', namespace: 'production', endpoints: '10.244.1.70:6379', readyCount: 1, notReadyCount: 0, ports: '6379/TCP', age: '60d' },
  { name: 'postgres', namespace: 'production', endpoints: '10.244.1.80:5432', readyCount: 1, notReadyCount: 0, ports: '5432/TCP', age: '90d' },
  { name: 'kubernetes', namespace: 'default', endpoints: '192.168.1.10:6443', readyCount: 1, notReadyCount: 0, ports: '6443/TCP', age: '180d' },
  { name: 'kube-dns', namespace: 'kube-system', endpoints: '10.244.0.2:53, 10.244.0.3:53', readyCount: 2, notReadyCount: 0, ports: '53/UDP,53/TCP', age: '180d' },
  { name: 'failing-service', namespace: 'staging', endpoints: '10.244.1.90:8080', readyCount: 1, notReadyCount: 2, ports: '8080/TCP', age: '1d' },
];

type SortKey = 'name' | 'namespace' | 'readyCount' | 'age';

export default function Endpoints() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sEndpoint>('endpoints');

  const endpoints: Endpoint[] = config.isConnected && data?.items
    ? data.items.map((ep) => {
        let readyCount = 0;
        let notReadyCount = 0;
        const endpointsList: string[] = [];
        const portsList: string[] = [];
        
        ep.subsets?.forEach(subset => {
          readyCount += subset.addresses?.length || 0;
          notReadyCount += subset.notReadyAddresses?.length || 0;
          
          subset.addresses?.forEach(addr => {
            subset.ports?.forEach(port => {
              endpointsList.push(`${addr.ip}:${port.port}`);
            });
          });
          
          subset.ports?.forEach(port => {
            portsList.push(`${port.port}/${port.protocol || 'TCP'}`);
          });
        });
        
        return {
          name: ep.metadata.name,
          namespace: ep.metadata.namespace || 'default',
          endpoints: endpointsList.slice(0, 3).join(', ') + (endpointsList.length > 3 ? ` (+${endpointsList.length - 3})` : '') || '<none>',
          readyCount,
          notReadyCount,
          ports: [...new Set(portsList)].join(', ') || '-',
          age: calculateAge(ep.metadata.creationTimestamp),
        };
      })
    : mockEndpoints;

  const stats = useMemo(() => ({
    total: endpoints.length,
    healthy: endpoints.filter(e => e.notReadyCount === 0 && e.readyCount > 0).length,
    partial: endpoints.filter(e => e.notReadyCount > 0 && e.readyCount > 0).length,
    empty: endpoints.filter(e => e.readyCount === 0).length,
    totalReady: endpoints.reduce((sum, e) => sum + e.readyCount, 0),
  }), [endpoints]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(endpoints.map(e => e.namespace)))];
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    let result = endpoints.filter(ep => {
      const matchesSearch = ep.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ep.namespace.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           ep.endpoints.includes(searchQuery);
      const matchesNamespace = selectedNamespace === 'all' || ep.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'namespace': comparison = a.namespace.localeCompare(b.namespace); break;
        case 'readyCount': comparison = a.readyCount - b.readyCount; break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [endpoints, searchQuery, selectedNamespace, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const handleExportAll = () => {
    const itemsToExport = selectedItems.size > 0 
      ? filteredEndpoints.filter(e => selectedItems.has(`${e.namespace}/${e.name}`))
      : filteredEndpoints;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'endpoints-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} endpoints`);
  };

  const toggleSelection = (item: Endpoint) => {
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
    if (selectedItems.size === filteredEndpoints.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredEndpoints.map(e => `${e.namespace}/${e.name}`)));
    }
  };

  const isAllSelected = filteredEndpoints.length > 0 && selectedItems.size === filteredEndpoints.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredEndpoints.length;

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
              <h1 className="text-2xl font-semibold tracking-tight">Endpoints</h1>
              <p className="text-sm text-muted-foreground">
                {filteredEndpoints.length} endpoints across {namespaces.length - 1} namespaces
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
              Create Endpoint
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
                Export
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                Clear
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Endpoints</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.healthy}</div>
              <div className="text-xs text-muted-foreground">Healthy</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.partial}</div>
              <div className="text-xs text-muted-foreground">Partial</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[hsl(0,72%,51%)]">{stats.empty}</div>
              <div className="text-xs text-muted-foreground">Empty</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalReady}</div>
              <div className="text-xs text-muted-foreground">Ready Addresses</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endpoints by name, namespace, or IP..."
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
                <TableHead>Endpoints</TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('readyCount')}>
                  <div className="flex items-center gap-1">Ready <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead>Not Ready</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                  <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEndpoints.map((ep) => {
                const isSelected = selectedItems.has(`${ep.namespace}/${ep.name}`);
                return (
                  <TableRow key={`${ep.namespace}/${ep.name}`} className={cn(isSelected && "bg-primary/5")}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(ep)}
                        aria-label={`Select ${ep.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/endpoints/${ep.namespace}/${ep.name}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ep.name}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{ep.namespace}</Badge></TableCell>
                    <TableCell>
                      <span className="font-mono text-xs max-w-[250px] truncate block">{ep.endpoints}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("font-mono", ep.readyCount > 0 ? "text-[hsl(142,76%,36%)]" : "text-muted-foreground")}>
                        {ep.readyCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("font-mono", ep.notReadyCount > 0 ? "text-[hsl(0,72%,51%)]" : "text-muted-foreground")}>
                        {ep.notReadyCount}
                      </span>
                    </TableCell>
                    <TableCell><span className="font-mono text-xs">{ep.ports}</span></TableCell>
                    <TableCell><span className="text-muted-foreground">{ep.age}</span></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/endpoints/${ep.namespace}/${ep.name}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/services/${ep.namespace}/${ep.name}`)}>
                            <Link2 className="h-4 w-4 mr-2" />
                            View Service
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="h-4 w-4 mr-2" />
                            Download YAML
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
      </motion.div>

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Endpoints"
          defaultYaml={DEFAULT_YAMLS.Endpoints}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('Endpoints created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}