import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, Filter, RefreshCw, MoreHorizontal, CheckCircle2, XCircle, Clock, Download, Loader2, WifiOff, Plus,
  ArrowUpDown, ChevronDown, CheckSquare, Trash2, FileText, Briefcase,
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
import { DeleteConfirmDialog } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { JobIcon } from '@/components/icons/KubernetesIcons';

interface JobResource extends KubernetesResource {
  spec: { completions?: number; parallelism?: number; backoffLimit?: number };
  status: { succeeded?: number; failed?: number; active?: number; startTime?: string; completionTime?: string };
}

interface Job {
  name: string;
  namespace: string;
  status: 'Complete' | 'Running' | 'Failed';
  completions: string;
  duration: string;
  age: string;
}

const mockJobs: Job[] = [
  { name: 'db-migration-v1.2.0', namespace: 'production', status: 'Complete', completions: '1/1', duration: '45s', age: '2d' },
  { name: 'backup-daily-20240115', namespace: 'production', status: 'Complete', completions: '1/1', duration: '5m', age: '1d' },
  { name: 'data-sync-batch', namespace: 'production', status: 'Running', completions: '3/5', duration: '10m', age: '30m' },
  { name: 'report-generator', namespace: 'staging', status: 'Failed', completions: '0/1', duration: '2m', age: '4h' },
  { name: 'cleanup-old-logs', namespace: 'kube-system', status: 'Complete', completions: '1/1', duration: '15s', age: '12h' },
  { name: 'index-rebuild', namespace: 'production', status: 'Complete', completions: '10/10', duration: '30m', age: '3d' },
  { name: 'ml-training-job', namespace: 'ml-platform', status: 'Running', completions: '2/4', duration: '2h', age: '2h' },
  { name: 'failed-migration', namespace: 'staging', status: 'Failed', completions: '0/1', duration: '5m', age: '6h' },
];

const statusConfig = {
  Complete: { icon: CheckCircle2, color: 'text-[hsl(142,76%,36%)]', bg: 'bg-[hsl(142,76%,36%)]/10' },
  Running: { icon: Clock, color: 'text-[hsl(45,93%,47%)]', bg: 'bg-[hsl(45,93%,47%)]/10' },
  Failed: { icon: XCircle, color: 'text-[hsl(0,72%,51%)]', bg: 'bg-[hsl(0,72%,51%)]/10' },
};

function transformResource(resource: JobResource): Job {
  const spec = resource.spec || {};
  const status = resource.status || {};
  const completions = spec.completions || 1;
  const succeeded = status.succeeded || 0;
  const active = status.active || 0;
  const failed = status.failed || 0;
  let jobStatus: Job['status'] = 'Running';
  if (succeeded >= completions) jobStatus = 'Complete';
  else if (failed > 0 && active === 0) jobStatus = 'Failed';
  let duration = '-';
  if (status.startTime) {
    const start = new Date(status.startTime);
    const end = status.completionTime ? new Date(status.completionTime) : new Date();
    const diffSec = Math.floor((end.getTime() - start.getTime()) / 1000);
    if (diffSec < 60) duration = `${diffSec}s`;
    else if (diffSec < 3600) duration = `${Math.floor(diffSec / 60)}m`;
    else duration = `${Math.floor(diffSec / 3600)}h`;
  }
  return { name: resource.metadata.name, namespace: resource.metadata.namespace || 'default', status: jobStatus, completions: `${succeeded}/${completions}`, duration, age: calculateAge(resource.metadata.creationTimestamp) };
}

type SortKey = 'name' | 'namespace' | 'status' | 'age';
type ViewMode = 'all' | 'complete' | 'running' | 'failed';

export default function Jobs() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState<string>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Job | null; bulk?: boolean }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<JobResource>('jobs');
  const deleteResource = useDeleteK8sResource('jobs');

  const items: Job[] = config.isConnected && data?.items ? data.items.map(transformResource) : mockJobs;

  const stats = useMemo(() => ({ total: items.length, complete: items.filter(i => i.status === 'Complete').length, running: items.filter(i => i.status === 'Running').length, failed: items.filter(i => i.status === 'Failed').length }), [items]);
  const namespaces = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.namespace)))], [items]);

  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.namespace.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesNamespace = selectedNamespace === 'all' || item.namespace === selectedNamespace;
      let matchesView = true;
      if (viewMode === 'complete') matchesView = item.status === 'Complete';
      else if (viewMode === 'running') matchesView = item.status === 'Running';
      else if (viewMode === 'failed') matchesView = item.status === 'Failed';
      return matchesSearch && matchesNamespace && matchesView;
    });
    result.sort((a, b) => { let cmp = 0; if (sortKey === 'name') cmp = a.name.localeCompare(b.name); else if (sortKey === 'namespace') cmp = a.namespace.localeCompare(b.namespace); else if (sortKey === 'status') cmp = a.status.localeCompare(b.status); else if (sortKey === 'age') cmp = a.age.localeCompare(b.age); return sortOrder === 'asc' ? cmp : -cmp; });
    return result;
  }, [items, searchQuery, selectedNamespace, viewMode, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortOrder('asc'); } };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) { toast.success(`Deleted ${selectedItems.size} jobs (demo mode)`); setSelectedItems(new Set()); }
    else if (deleteDialog.item) { if (config.isConnected) await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: deleteDialog.item.namespace }); else toast.success(`Job ${deleteDialog.item.name} deleted (demo mode)`); }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExport = () => { const toExport = selectedItems.size > 0 ? filteredItems.filter(i => selectedItems.has(`${i.namespace}/${i.name}`)) : filteredItems; const blob = new Blob([JSON.stringify(toExport, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'jobs-export.json'; a.click(); URL.revokeObjectURL(url); toast.success(`Exported ${toExport.length} jobs`); };

  const toggleSelection = (item: Job) => { const key = `${item.namespace}/${item.name}`; const newSel = new Set(selectedItems); if (newSel.has(key)) newSel.delete(key); else newSel.add(key); setSelectedItems(newSel); };
  const toggleAll = () => { if (selectedItems.size === filteredItems.length) setSelectedItems(new Set()); else setSelectedItems(new Set(filteredItems.map(i => `${i.namespace}/${i.name}`))); };

  const isAllSelected = filteredItems.length > 0 && selectedItems.size === filteredItems.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredItems.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><JobIcon className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
            <p className="text-sm text-muted-foreground">{filteredItems.length} jobs across {namespaces.length - 1} namespaces{!config.isConnected && <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]"><WifiOff className="h-3 w-3" /> Demo mode</span>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}><Download className="h-4 w-4" />{selectedItems.size > 0 ? `Export (${selectedItems.size})` : 'Export'}</Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => refetch()} disabled={isLoading}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>
          <Button className="gap-2" onClick={() => setShowCreateWizard(true)}><Plus className="h-4 w-4" />Create Job</Button>
        </div>
      </div>

      {selectedItems.size > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-3"><Badge variant="secondary" className="gap-1.5"><CheckSquare className="h-3.5 w-3.5" />{selectedItems.size} selected</Badge><Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>Clear</Button></div>
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}><Trash2 className="h-4 w-4" />Delete</Button>
        </motion.div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Card className={cn('cursor-pointer transition-all', viewMode === 'all' && 'ring-2 ring-primary')} onClick={() => setViewMode('all')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></div><JobIcon className="h-8 w-8 text-primary opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'complete' && 'ring-2 ring-[hsl(142,76%,36%)]')} onClick={() => setViewMode('complete')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Complete</p><p className="text-2xl font-bold text-[hsl(142,76%,36%)]">{stats.complete}</p></div><CheckCircle2 className="h-8 w-8 text-[hsl(142,76%,36%)] opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'running' && 'ring-2 ring-[hsl(45,93%,47%)]')} onClick={() => setViewMode('running')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Running</p><p className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.running}</p></div><Clock className="h-8 w-8 text-[hsl(45,93%,47%)] opacity-50" /></div></CardContent></Card>
        <Card className={cn('cursor-pointer transition-all', viewMode === 'failed' && 'ring-2 ring-[hsl(0,72%,51%)]')} onClick={() => setViewMode('failed')}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Failed</p><p className="text-2xl font-bold text-[hsl(0,72%,51%)]">{stats.failed}</p></div><XCircle className="h-8 w-8 text-[hsl(0,72%,51%)] opacity-50" /></div></CardContent></Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search jobs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
        <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="gap-2"><Filter className="h-4 w-4" />{selectedNamespace === 'all' ? 'All Namespaces' : selectedNamespace}<ChevronDown className="h-4 w-4 opacity-50" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">{namespaces.map(ns => <DropdownMenuItem key={ns} onClick={() => setSelectedNamespace(ns)} className={cn(selectedNamespace === ns && 'bg-accent')}>{ns === 'all' ? 'All Namespaces' : ns}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10"><Checkbox checked={isAllSelected} onCheckedChange={toggleAll} className={cn(isSomeSelected && 'data-[state=checked]:bg-primary/50')} /></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('name')}>Name <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('namespace')}>Namespace <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('status')}>Status <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead>Completions</TableHead><TableHead>Duration</TableHead>
            <TableHead><Button variant="ghost" className="gap-1 -ml-2 h-auto p-1" onClick={() => handleSort('age')}>Age <ArrowUpDown className="h-3.5 w-3.5" /></Button></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading && config.isConnected ? <TableRow><TableCell colSpan={8} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">Loading...</p></div></TableCell></TableRow>
            : filteredItems.length === 0 ? <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground"><div className="flex flex-col items-center gap-2"><Briefcase className="h-8 w-8 opacity-50" /><p>No jobs found</p></div></TableCell></TableRow>
            : filteredItems.map((item, idx) => {
              const StatusIcon = statusConfig[item.status]?.icon || Clock; const style = statusConfig[item.status]; const key = `${item.namespace}/${item.name}`; const isSelected = selectedItems.has(key);
              return (
                <motion.tr key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }} className={cn('group cursor-pointer border-b border-border hover:bg-muted/50', isSelected && 'bg-primary/5')}>
                  <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(item)} /></TableCell>
                  <TableCell><Link to={`/jobs/${item.namespace}/${item.name}`} className="font-medium text-primary hover:underline flex items-center gap-2"><JobIcon className="h-4 w-4 text-muted-foreground" /><span className="truncate max-w-[200px]">{item.name}</span></Link></TableCell>
                  <TableCell><Badge variant="outline" className="font-normal">{item.namespace}</Badge></TableCell>
                  <TableCell><div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', style.bg, style.color)}><StatusIcon className="h-3.5 w-3.5" />{item.status}</div></TableCell>
                  <TableCell className="font-mono text-sm">{item.completions}</TableCell><TableCell className="font-mono text-sm">{item.duration}</TableCell>
                  <TableCell className="text-muted-foreground">{item.age}</TableCell>
                  <TableCell>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/jobs/${item.namespace}/${item.name}?tab=logs`)} className="gap-2"><FileText className="h-4 w-4" />View Logs</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/jobs/${item.namespace}/${item.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />View YAML</DropdownMenuItem>
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

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Job"
          defaultYaml={DEFAULT_YAMLS.Job}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('Job created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
      <DeleteConfirmDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })} resourceType="Job" resourceName={deleteDialog.bulk ? `${selectedItems.size} jobs` : (deleteDialog.item?.name || '')} namespace={deleteDialog.bulk ? undefined : deleteDialog.item?.namespace} onConfirm={handleDelete} />
    </motion.div>
  );
}
