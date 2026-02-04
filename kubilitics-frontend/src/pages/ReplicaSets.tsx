import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, RefreshCw, MoreHorizontal, CheckCircle2, XCircle, Clock, Download, Loader2, WifiOff,
  ArrowUpDown, ChevronDown, CheckSquare, Trash2, Scale, FileText, Layers, Plus,
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
import { DeleteConfirmDialog, ScaleDialog } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { ReplicaSetIcon } from '@/components/icons/KubernetesIcons';

interface ReplicaSetResource extends KubernetesResource {
  spec: { replicas: number };
  status: { replicas?: number; readyReplicas?: number; availableReplicas?: number };
}

interface ReplicaSet {
  name: string;
  namespace: string;
  status: 'Healthy' | 'Progressing' | 'Degraded';
  desired: number;
  current: number;
  ready: number;
  owner: string;
  age: string;
}

const mockReplicaSets: ReplicaSet[] = [
  { name: 'nginx-deployment-7fb96c846b', namespace: 'production', status: 'Healthy', desired: 3, current: 3, ready: 3, owner: 'nginx-deployment', age: '30d' },
  { name: 'api-gateway-5f8f9c7d6', namespace: 'production', status: 'Healthy', desired: 2, current: 2, ready: 2, owner: 'api-gateway', age: '14d' },
  { name: 'backend-service-6d4b75cb6d', namespace: 'production', status: 'Healthy', desired: 5, current: 5, ready: 5, owner: 'backend-service', age: '7d' },
  { name: 'worker-deployment-8f7g6h5', namespace: 'staging', status: 'Progressing', desired: 3, current: 2, ready: 1, owner: 'worker-deployment', age: '1d' },
  { name: 'test-service-abc123', namespace: 'staging', status: 'Degraded', desired: 2, current: 0, ready: 0, owner: 'test-service', age: '2h' },
  { name: 'coredns-6d8c4cb4d', namespace: 'kube-system', status: 'Healthy', desired: 2, current: 2, ready: 2, owner: 'coredns', age: '90d' },
];

const statusConfig = {
  Healthy: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Progressing: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Degraded: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

function transformResource(resource: ReplicaSetResource): ReplicaSet {
  const desired = resource.spec?.replicas || 0;
  const current = resource.status?.replicas || 0;
  const ready = resource.status?.readyReplicas || 0;
  let status: ReplicaSet['status'] = 'Healthy';
  if (ready === 0 && desired > 0) status = 'Degraded';
  else if (ready < desired) status = 'Progressing';
  const ownerRefs = (resource.metadata as any).ownerReferences;
  return { name: resource.metadata.name, namespace: resource.metadata.namespace || 'default', status, desired, current, ready, owner: ownerRefs?.[0]?.name || '-', age: calculateAge(resource.metadata.creationTimestamp) };
}

type SortKey = 'name' | 'namespace' | 'status' | 'age';
type ViewMode = 'all' | 'healthy' | 'progressing' | 'degraded';

export default function ReplicaSets() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ReplicaSet | null; bulk?: boolean }>({ open: false, item: null });
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; item: ReplicaSet | null }>({ open: false, item: null });
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<ReplicaSetResource>('replicasets');
  const deleteResource = useDeleteK8sResource('replicasets');

  const items: ReplicaSet[] = config.isConnected && data?.items ? data.items.map(transformResource) : mockReplicaSets;

  const stats = useMemo(() => ({ total: items.length, healthy: items.filter(i => i.status === 'Healthy').length, progressing: items.filter(i => i.status === 'Progressing').length, degraded: items.filter(i => i.status === 'Degraded').length }), [items]);
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
    result.sort((a, b) => { let cmp = 0; if (sortKey === 'name') cmp = a.name.localeCompare(b.name); else if (sortKey === 'namespace') cmp = a.namespace.localeCompare(b.namespace); else if (sortKey === 'status') cmp = a.status.localeCompare(b.status); else if (sortKey === 'age') cmp = a.age.localeCompare(b.age); return sortOrder === 'asc' ? cmp : -cmp; });
    return result;
  }, [items, searchQuery, selectedNamespace, viewMode, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortOrder('asc'); } };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) { toast.success(`Deleted ${selectedItems.size} replicasets (demo mode)`); setSelectedItems(new Set()); }
    else if (deleteDialog.item) { if (config.isConnected) await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: deleteDialog.item.namespace }); else toast.success(`ReplicaSet ${deleteDialog.item.name} deleted (demo mode)`); }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExport = () => { const toExport = selectedItems.size > 0 ? filteredItems.filter(i => selectedItems.has(`${i.namespace}/${i.name}`)) : filteredItems; const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'replicasets-export.json'; a.click(); URL.revokeObjectURL(url); toast.success(`Exported ${toExport.length} replicasets`); };

  const toggleSelection = (item: ReplicaSet) => { const key = `${item.namespace}/${item.name}`; const newSel = new Set(selectedItems); if (newSel.has(key)) newSel.delete(key); else newSel.add(key); setSelectedItems(newSel); };
  const toggleAll = () => { if (selectedItems.size === filteredItems.length) setSelectedItems(new Set()); else setSelectedItems(new Set(filteredItems.map(i => `${i.namespace}/${i.name}`))); };

  const isAllSelected = filteredItems.length > 0 && selectedItems.size === filteredItems.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredItems.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><ReplicaSetIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ReplicaSets</h1>
            <p className="text-sm text-muted-foreground">{filteredItems.length} replicasets across {namespaces.length - 1} namespaces{!config.isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Demo mode</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />{selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" />Create ReplicaSet</Button>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3"><Badge variant="secondary" className="gap-1.5"><CheckSquare className="h-3.5 w-3.5" />{selectedItems.size} selected</Badge><Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>Clear</Button></div>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}><Trash2 className="h-4 w-4" />Delete</Button>
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Card className={cn('cursor-pointer transition-all', viewMode === 'all' && 'ring-2 ring-primary')} onClick={() => setViewMode('all')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></div><ReplicaSetIcon className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'healthy' && 'ring-2 ring-[hsl(142,76%,36%)]')} onClick={() => setViewMode('healthy')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Healthy</p><p className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.healthy}</p></div><CheckCircle2 className="h-8 w-8 text-[hsl(142,76%,36%)] opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'progressing' && 'ring-2 ring-[hsl(45,93%,47%)]')} onClick={() => setViewMode('progressing')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Progressing</p><p className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.progressing}</p></div><Clock className="h-8 w-8 text-[hsl(45,93%,47%)] opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'degraded' && 'ring-2 ring-[hsl(0,72%,51%)]')} onClick={() => setViewMode('degraded')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Degraded</p><p className="text-2xl font-bold text-[hsl(0,72%,51%)]">{stats.degraded}</p></div><XCircle className="h-8 w-8 text-[hsl(0,72%,51%)] opacity-50" /></div></CardContent></Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search replicasets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">{namespaces.map(ns => <DropdownMenuItem key={ns} onClick={() => setSelectedNamespace(ns)} className={cn(selectedNamespace === ns && 'bg-accent')}>{ns === 'all' ? 'All Namespaces' : ns}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10"><Checkbox checked={isAllSelected} onCheckedChange={toggleAll} className={cn(isSomeSelected && 'data-[state=checked]:bg-primary/50')} /></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('name')}>Name <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('namespace')}>Namespace <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('status')}>Status <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead>Desired</TableHead><TableHead>Current</TableHead><TableHead>Ready</TableHead><TableHead>Owner</TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('age')}>Age <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && config.isConnected ? <TableRow><TableCell colSpan={10} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
            : filteredItems.length === 0 ? <TableRow><TableCell colSpan={10} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Layers className="h-8 w-8 opacity-50" /><p>No replicasets found</p></div></TableCell></TableRow>
            : filteredItems.map((item, idx) => {
              const StatusIcon = statusConfig[item.status]?.icon || Clock; const style = statusConfig[item.status]; const key = `${item.namespace}/${item.name}`; const isSelected = selectedItems.has(key);
              return (
                <motion.tr key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} className={cn('group cursor-pointer border-b border-border hover:bg-muted/50', isSelected && 'bg-primary/5')}>
                  <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item)} /></TableCell>
                  <TableCell><Link to={`/replicasets/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2"><ReplicaSetIcon className="h-4 w-4 text-muted-foreground" /><span className="truncate max-w-[200px]">{item.name}</span></Link></TableCell>
                  <TableCell><Badge variant="outline" className="font-normal">{item.namespace}</Badge></TableCell>
                  <TableCell><div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', style.bg, style.color)}><StatusIcon className="h-3.5 w-3.5" />{item.status}</div></TableCell>
                  <TableCell className="font-mono text-sm">{item.desired}</TableCell><TableCell className="font-mono text-sm">{item.current}</TableCell><TableCell className="font-mono text-sm">{item.ready}</TableCell>
                  <TableCell><Badge variant="secondary" className="font-mono text-xs">{item.owner}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{item.age}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setScaleDialog({ open: true, item })} className="gap-2"><Scale className="h-4 w-4" />Scale</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/replicasets/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />View YAML</DropdownMenuItem>
                        <DropdownMenuSeparator /><DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item })}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })} resourceType="ReplicaSet" resourceName={deleteDialog.bulk ? `${selectedItems.size} replicasets` : (deleteDialog.item?.name || '')} namespace={deleteDialog.bulk ? undefined : deleteDialog.item?.namespace} onConfirm={handleDelete} />
      {scaleDialog.item && <ScaleDialog open={scaleDialog.open} onOpenChange={(open) => setScaleDialog({ open, item: open ? scaleDialog.item : null })} resourceType="ReplicaSet" resourceName={scaleDialog.item.name} namespace={scaleDialog.item.namespace} currentReplicas={scaleDialog.item.desired} onScale={(r) => { toast.success(`Scaled ${scaleDialog.item?.name} to ${r} replicas (demo mode)`); setScaleDialog({ open: false, item: null }); }} />}
      {showCreateWizard && (
        <ResourceCreator
          resourceKind="ReplicaSet"
          defaultYaml={DEFAULT_YAMLS.ReplicaSet}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('ReplicaSet created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </motion.div>
  );
}
