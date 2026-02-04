import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, RefreshCw, MoreHorizontal, CheckCircle2, XCircle, Clock, Download, Loader2, WifiOff, Plus,
  ArrowUpDown, ChevronDown, CheckSquare, Trash2, RotateCcw, Scale, History, FileText, Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { DeleteConfirmDialog, ScaleDialog, RolloutActionsDialog } from '@/components/resources';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { DeploymentIcon } from '@/components/icons/KubernetesIcons';

interface DeploymentResource extends KubernetesResource {
  spec: { replicas: number; strategy?: { type: string } };
  status: { replicas?: number; readyReplicas?: number; updatedReplicas?: number; availableReplicas?: number; conditions?: Array<{ type: string; status: string }> };
}

interface Deployment {
  name: string;
  namespace: string;
  status: 'Healthy' | 'Progressing' | 'Degraded';
  ready: string;
  upToDate: number;
  available: number;
  strategy: string;
  age: string;
  replicas: number;
}

const mockDeployments: Deployment[] = [
  { name: 'nginx-deployment', namespace: 'production', status: 'Healthy', ready: '3/3', upToDate: 3, available: 3, strategy: 'RollingUpdate', age: '30d', replicas: 3 },
  { name: 'api-gateway', namespace: 'production', status: 'Healthy', ready: '2/2', upToDate: 2, available: 2, strategy: 'RollingUpdate', age: '14d', replicas: 2 },
  { name: 'backend-service', namespace: 'production', status: 'Healthy', ready: '5/5', upToDate: 5, available: 5, strategy: 'RollingUpdate', age: '7d', replicas: 5 },
  { name: 'worker-deployment', namespace: 'staging', status: 'Progressing', ready: '1/3', upToDate: 1, available: 1, strategy: 'RollingUpdate', age: '1d', replicas: 3 },
  { name: 'test-service', namespace: 'staging', status: 'Degraded', ready: '0/2', upToDate: 0, available: 0, strategy: 'Recreate', age: '2h', replicas: 2 },
  { name: 'coredns', namespace: 'kube-system', status: 'Healthy', ready: '2/2', upToDate: 2, available: 2, strategy: 'RollingUpdate', age: '90d', replicas: 2 },
  { name: 'metrics-server', namespace: 'kube-system', status: 'Healthy', ready: '1/1', upToDate: 1, available: 1, strategy: 'RollingUpdate', age: '60d', replicas: 1 },
  { name: 'dashboard', namespace: 'kubernetes-dashboard', status: 'Healthy', ready: '1/1', upToDate: 1, available: 1, strategy: 'RollingUpdate', age: '45d', replicas: 1 },
];

const statusConfig = {
  Healthy: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Progressing: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Degraded: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

function transformResource(resource: DeploymentResource): Deployment {
  const desired = resource.spec?.replicas || 0;
  const ready = resource.status?.readyReplicas || 0;
  const available = resource.status?.availableReplicas || 0;
  
  let status: Deployment['status'] = 'Healthy';
  if (ready === 0 && desired > 0) status = 'Degraded';
  else if (ready < desired) status = 'Progressing';

  return {
    name: resource.metadata.name,
    namespace: resource.metadata.namespace || 'default',
    status,
    ready: `${ready}/${desired}`,
    upToDate: resource.status?.updatedReplicas || 0,
    available,
    strategy: resource.spec?.strategy?.type || 'RollingUpdate',
    age: calculateAge(resource.metadata.creationTimestamp),
    replicas: desired,
  };
}

type SortKey = 'name' | 'namespace' | 'status' | 'age';
type ViewMode = 'all' | 'healthy' | 'progressing' | 'degraded';

export default function Deployments() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Deployment | null; bulk?: boolean }>({ open: false, item: null });
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; item: Deployment | null }>({ open: false, item: null });
  const [rolloutDialog, setRolloutDialog] = useState<{ open: boolean; item: Deployment | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<DeploymentResource>('deployments');
  const deleteResource = useDeleteK8sResource('deployments');
  
  const items: Deployment[] = config.isConnected && data?.items ? data.items.map(transformResource) : mockDeployments;

  const stats = useMemo(() => ({
    total: items.length,
    healthy: items.filter(i => i.status === 'Healthy').length,
    progressing: items.filter(i => i.status === 'Progressing').length,
    degraded: items.filter(i => i.status === 'Degraded').length,
  }), [items]);

  const namespaces = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.namespace)))], [items]);

  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || item.namespace === selectedNamespace;
      let matchesView = true;
      if (viewMode === 'healthy') matchesView = item.status === 'Healthy';
      else if (viewMode === 'progressing') matchesView = item.status === 'Progressing';
      else if (viewMode === 'degraded') matchesView = item.status === 'Degraded';
      return matchesSearch && matchesNamespace && matchesView;
    });
    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'namespace') cmp = a.namespace.localeCompare(b.namespace);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'age') cmp = a.age.localeCompare(b.age);
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [items, searchQuery, selectedNamespace, viewMode, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) {
      toast.success(`Deleted ${selectedItems.size} deployments (demo mode)`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (config.isConnected) await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: deleteDialog.item.namespace });
      else toast.success(`Deployment ${deleteDialog.item.name} deleted (demo mode)`);
    }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExport = () => {
    const toExport = selectedItems.size > 0 ? filteredItems.filter(i => selectedItems.has(`${i.namespace}/${i.name}`)) : filteredItems;
    const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'deployments-export.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${toExport.length} deployments`);
  };

  const toggleSelection = (item: Deployment) => {
    const key = `${item.namespace}/${item.name}`;
    const newSel = new Set(selectedItems);
    if (newSel.has(key)) newSel.delete(key); else newSel.add(key);
    setSelectedItems(newSel);
  };

  const toggleAll = () => {
    if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredItems.map(i => `${i.namespace}/${i.name}`)));
  };

  const handleBulkRestart = () => { toast.success(`Restarted ${selectedItems.size} deployments (demo mode)`); setSelectedItems(new Set()); };

  const isAllSelected = filteredItems.length > 0 && selectedItems.size === filteredItems.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredItems.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><DeploymentIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deployments</h1>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} deployments across {namespaces.length - 1} namespaces
              {!config.isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Demo mode</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />{selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" />Create Deployment</Button>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5"><CheckSquare className="h-3.5 w-3.5" />{selectedItems.size} selected</Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>Clear</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleBulkRestart}><RotateCcw className="h-4 w-4" />Restart</Button>
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}><Trash2 className="h-4 w-4" />Delete</Button>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Card className={cn('cursor-pointer transition-all', viewMode === 'all' && 'ring-2 ring-primary')} onClick={() => setViewMode('all')}>
          <CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total Deployments</p><p className="text-2xl font-bold">{stats.total}</p></div><DeploymentIcon className="h-8 w-8 text-primary opacity-50" /></div></CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'healthy' && 'ring-2 ring-[hsl(142,76%,36%)]')} onClick={() => setViewMode('healthy')}>
          <CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Healthy</p><p className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.healthy}</p></div><CheckCircle2 className="h-8 w-8 text-[hsl(142,76%,36%)] opacity-50" /></div></CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'progressing' && 'ring-2 ring-[hsl(45,93%,47%)]')} onClick={() => setViewMode('progressing')}>
          <CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Progressing</p><p className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.progressing}</p></div><Clock className="h-8 w-8 text-[hsl(45,93%,47%)] opacity-50" /></div></CardContent>
        </Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'degraded' && 'ring-2 ring-[hsl(0,72%,51%)]')} onClick={() => setViewMode('degraded')}>
          <CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Degraded</p><p className="text-2xl font-bold text-[hsl(0,72%,51%)]">{stats.degraded}</p></div><XCircle className="h-8 w-8 text-[hsl(0,72%,51%)] opacity-50" /></div></CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search deployments..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">{namespaces.map(ns => <DropdownMenuItem key={ns} onClick={() => setSelectedNamespace(ns)} className={cn(selectedNamespace === ns && 'bg-accent')}>{ns === 'all' ? 'All Namespaces' : ns}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-10"><Checkbox checked={isAllSelected} onCheckedChange={toggleAll} className={cn(isSomeSelected && 'data-[state=checked]:bg-primary/50')} /></TableHead>
              <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('name')}>Name <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
              <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('namespace')}>Namespace <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
              <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('status')}>Status <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
              <TableHead>Ready</TableHead>
              <TableHead>Up-to-date</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('age')}>Age <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && config.isConnected ? (
              <TableRow><TableCell colSpan={10} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Rocket className="h-8 w-8 opacity-50" /><p>No deployments found</p>{(searchQuery || viewMode !== 'all') && <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); setViewMode('all'); }}>Clear filters</Button>}</div></TableCell></TableRow>
            ) : filteredItems.map((item, idx) => {
              const StatusIcon = statusConfig[item.status]?.icon || Clock;
              const style = statusConfig[item.status];
              const key = `${item.namespace}/${item.name}`;
              const isSelected = selectedItems.has(key);
              return (
                <motion.tr key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} className={cn('group cursor-pointer border-b border-border hover:bg-muted/50', isSelected && 'bg-primary/5')}>
                  <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item)} /></TableCell>
                  <TableCell><Link to={`/deployments/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2"><DeploymentIcon className="h-4 w-4 text-muted-foreground" /><span className="truncate max-w-[200px]">{item.name}</span></Link></TableCell>
                  <TableCell><Badge variant="outline" className="font-normal">{item.namespace}</Badge></TableCell>
                  <TableCell><div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', style.bg, style.color)}><StatusIcon className="h-3.5 w-3.5" />{item.status}</div></TableCell>
                  <TableCell className="font-mono text-sm">{item.ready}</TableCell>
                  <TableCell className="font-mono text-sm">{item.upToDate}</TableCell>
                  <TableCell className="font-mono text-sm">{item.available}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-mono text-xs">{item.strategy}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{item.age}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setScaleDialog({ open: true, item })} className="gap-2"><Scale className="h-4 w-4" />Scale</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRolloutDialog({ open: true, item })} className="gap-2"><History className="h-4 w-4" />Rollout Actions</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/deployments/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />View YAML</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item })}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Deployment"
          defaultYaml={DEFAULT_YAMLS.Deployment}
          onClose={() => setShowCreateWizard(false)}
          onApply={(yaml) => {
            console.log('Creating Deployment with YAML:', yaml);
            toast.success('Deployment created successfully (demo mode)');
            setShowCreateWizard(false);
            refetch();
          }}
          clusterName="docker-desktop"
        />
      )}
      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })} resourceType="Deployment" resourceName={deleteDialog.bulk ? `${selectedItems.size} deployments` : (deleteDialog.item?.name || '')} namespace={deleteDialog.bulk ? undefined : deleteDialog.item?.namespace} onConfirm={handleDelete} />
      {scaleDialog.item && <ScaleDialog open={scaleDialog.open} onOpenChange={(open) => setScaleDialog({ open, item: open ? scaleDialog.item : null })} resourceType="Deployment" resourceName={scaleDialog.item.name} namespace={scaleDialog.item.namespace} currentReplicas={scaleDialog.item.replicas} onScale={(r) => { toast.success(`Scaled ${scaleDialog.item?.name} to ${r} replicas (demo mode)`); setScaleDialog({ open: false, item: null }); }} />}
      {rolloutDialog.item && <RolloutActionsDialog open={rolloutDialog.open} onOpenChange={(open) => setRolloutDialog({ open, item: open ? rolloutDialog.item : null })} resourceType="Deployment" resourceName={rolloutDialog.item.name} namespace={rolloutDialog.item.namespace} onRestart={() => { toast.success(`Restarted ${rolloutDialog.item?.name} (demo mode)`); setRolloutDialog({ open: false, item: null }); }} onRollback={(rev) => { toast.success(`Rolled back ${rolloutDialog.item?.name} to revision ${rev} (demo mode)`); setRolloutDialog({ open: false, item: null }); }} />}
    </motion.div>
  );
}
