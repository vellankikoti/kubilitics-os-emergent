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

interface K8sEndpointSlice extends KubernetesResource {
  addressType?: string;
  endpoints?: Array<{ addresses: string[]; conditions?: { ready?: boolean } }>;
  ports?: Array<{ port: number; name?: string; protocol?: string }>;
}

interface EndpointSlice {
  name: string;
  namespace: string;
  addressType: string;
  endpoints: number;
  readyEndpoints: number;
  ports: number;
  age: string;
}

const mockEndpointSlices: EndpointSlice[] = [
  { name: 'nginx-svc-abc12', namespace: 'production', addressType: 'IPv4', endpoints: 3, readyEndpoints: 3, ports: 1, age: '30d' },
  { name: 'api-svc-def34', namespace: 'production', addressType: 'IPv4', endpoints: 5, readyEndpoints: 5, ports: 2, age: '15d' },
  { name: 'redis-svc-ghi56', namespace: 'staging', addressType: 'IPv4', endpoints: 1, readyEndpoints: 1, ports: 1, age: '7d' },
  { name: 'kubernetes-jkl78', namespace: 'default', addressType: 'IPv4', endpoints: 3, readyEndpoints: 3, ports: 1, age: '365d' },
  { name: 'postgres-svc-mno90', namespace: 'production', addressType: 'IPv4', endpoints: 2, readyEndpoints: 2, ports: 1, age: '60d' },
  { name: 'frontend-svc-pqr12', namespace: 'production', addressType: 'IPv4', endpoints: 4, readyEndpoints: 3, ports: 2, age: '10d' },
  { name: 'kube-dns-stu34', namespace: 'kube-system', addressType: 'IPv4', endpoints: 2, readyEndpoints: 2, ports: 2, age: '180d' },
  { name: 'metrics-svc-vwx56', namespace: 'monitoring', addressType: 'IPv4', endpoints: 1, readyEndpoints: 1, ports: 1, age: '45d' },
];

type SortKey = 'name' | 'namespace' | 'endpoints' | 'age';

export default function EndpointSlices() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sEndpointSlice>('endpointslices');

  const endpointslices: EndpointSlice[] = config.isConnected && data?.items
    ? data.items.map((es) => {
        const readyEndpoints = es.endpoints?.filter(e => e.conditions?.ready !== false).length || 0;
        return {
          name: es.metadata.name,
          namespace: es.metadata.namespace || 'default',
          addressType: es.addressType || 'IPv4',
          endpoints: es.endpoints?.length || 0,
          readyEndpoints,
          ports: es.ports?.length || 0,
          age: calculateAge(es.metadata.creationTimestamp),
        };
      })
    : mockEndpointSlices;

  const stats = useMemo(() => ({
    total: endpointslices.length,
    totalEndpoints: endpointslices.reduce((sum, es) => sum + es.endpoints, 0),
    totalReady: endpointslices.reduce((sum, es) => sum + es.readyEndpoints, 0),
    ipv4: endpointslices.filter(es => es.addressType === 'IPv4').length,
    ipv6: endpointslices.filter(es => es.addressType === 'IPv6').length,
  }), [endpointslices]);

  const namespaces = useMemo(() => {
    return ['all', ...Array.from(new Set(endpointslices.map(es => es.namespace)))];
  }, [endpointslices]);

  const filteredSlices = useMemo(() => {
    let result = endpointslices.filter(es => {
      const matchesSearch = es.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           es.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || es.namespace === selectedNamespace;
      return matchesSearch && matchesNamespace;
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'namespace': comparison = a.namespace.localeCompare(b.namespace); break;
        case 'endpoints': comparison = a.endpoints - b.endpoints; break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [endpointslices, searchQuery, selectedNamespace, sortKey, sortOrder]);

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
      ? filteredSlices.filter(es => selectedItems.has(`${es.namespace}/${es.name}`))
      : filteredSlices;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'endpointslices-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} endpoint slices`);
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
              <div className="text-xs text-muted-foreground">Total Slices</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalEndpoints}</div>
              <div className="text-xs text-muted-foreground">Total Endpoints</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.totalReady}</div>
              <div className="text-xs text-muted-foreground">Ready Endpoints</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.ipv4}</div>
              <div className="text-xs text-muted-foreground">IPv4 Slices</div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{stats.ipv6}</div>
              <div className="text-xs text-muted-foreground">IPv6 Slices</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search endpoint slices..."
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
                <TableHead>Address Type</TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('endpoints')}>
                  <div className="flex items-center gap-1">Endpoints <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead>Ready</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                  <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
                </TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSlices.map((es) => {
                const isSelected = selectedItems.has(`${es.namespace}/${es.name}`);
                return (
                  <TableRow key={`${es.namespace}/${es.name}`} className={cn(isSelected && "bg-primary/5")}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelection(es)}
                        aria-label={`Select ${es.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/endpointslices/${es.namespace}/${es.name}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {es.name}
                      </Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{es.namespace}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{es.addressType}</Badge></TableCell>
                    <TableCell><span className="font-mono">{es.endpoints}</span></TableCell>
                    <TableCell>
                      <span className={cn(
                        "font-mono",
                        es.readyEndpoints === es.endpoints ? "text-[hsl(142,76%,36%)]" : "text-[hsl(45,93%,47%)]"
                      )}>
                        {es.readyEndpoints}/{es.endpoints}
                      </span>
                    </TableCell>
                    <TableCell><span className="font-mono">{es.ports}</span></TableCell>
                    <TableCell><span className="text-muted-foreground">{es.age}</span></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/endpointslices/${es.namespace}/${es.name}`)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
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
          resourceKind="EndpointSlice"
          defaultYaml={DEFAULT_YAMLS.EndpointSlice}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('EndpointSlice created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}