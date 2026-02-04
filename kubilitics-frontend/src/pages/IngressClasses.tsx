import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  RefreshCw, 
  MoreHorizontal,
  Download,
  Route,
  Loader2,
  WifiOff,
  Plus,
  Trash2,
  ArrowUpDown,
  CheckSquare,
  ExternalLink,
  Star,
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
import { useK8sResourceList, useDeleteK8sResource, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { DeleteConfirmDialog } from '@/components/resources';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface IngressClass {
  name: string;
  controller: string;
  isDefault: boolean;
  parameters: string;
  age: string;
}

const mockIngressClasses: IngressClass[] = [
  { name: 'nginx', controller: 'k8s.io/ingress-nginx', isDefault: true, parameters: '-', age: '180d' },
  { name: 'traefik', controller: 'traefik.io/ingress-controller', isDefault: false, parameters: '-', age: '90d' },
  { name: 'haproxy', controller: 'haproxy.org/ingress-controller', isDefault: false, parameters: '-', age: '60d' },
  { name: 'kong', controller: 'ingress-controllers.konghq.com/kong', isDefault: false, parameters: 'kong-config', age: '45d' },
  { name: 'istio', controller: 'istio.io/ingress-controller', isDefault: false, parameters: '-', age: '30d' },
  { name: 'contour', controller: 'projectcontour.io/contour', isDefault: false, parameters: '-', age: '15d' },
];

type SortKey = 'name' | 'controller' | 'age';

export default function IngressClasses() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: IngressClass | null; bulk?: boolean }>({ open: false, item: null });
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('ingressclasses');
  const deleteResource = useDeleteK8sResource('ingressclasses');

  const ingressClasses: IngressClass[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        name: item.metadata.name,
        controller: item.spec?.controller || '-',
        isDefault: item.metadata.annotations?.['ingressclass.kubernetes.io/is-default-class'] === 'true',
        parameters: item.spec?.parameters?.name || '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockIngressClasses;

  const stats = useMemo(() => ({
    total: ingressClasses.length,
    withDefault: ingressClasses.filter(ic => ic.isDefault).length,
    controllers: new Set(ingressClasses.map(ic => ic.controller.split('/')[0])).size,
  }), [ingressClasses]);

  const filteredClasses = useMemo(() => {
    let result = ingressClasses.filter(ic => {
      return ic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             ic.controller.toLowerCase().includes(searchQuery.toLowerCase());
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortKey) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'controller': comparison = a.controller.localeCompare(b.controller); break;
        case 'age': comparison = a.age.localeCompare(b.age); break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [ingressClasses, searchQuery, sortKey, sortOrder]);

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
      for (const name of selectedItems) {
        if (config.isConnected) {
          await deleteResource.mutateAsync({ name, namespace: '' });
        }
      }
      toast.success(`Deleted ${selectedItems.size} ingress classes`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (config.isConnected) {
        await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: '' });
      } else {
        toast.success(`IngressClass ${deleteDialog.item.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, item: null });
  };

  const handleExportAll = () => {
    const itemsToExport = selectedItems.size > 0 
      ? filteredClasses.filter(ic => selectedItems.has(ic.name))
      : filteredClasses;
    const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ingressclasses-export.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${itemsToExport.length} ingress classes`);
  };

  const toggleSelection = (item: IngressClass) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(item.name)) {
      newSelection.delete(item.name);
    } else {
      newSelection.add(item.name);
    }
    setSelectedItems(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedItems.size === filteredClasses.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredClasses.map(ic => ic.name)));
    }
  };

  const isAllSelected = filteredClasses.length > 0 && selectedItems.size === filteredClasses.length;
  const isSomeSelected = selectedItems.size > 0 && selectedItems.size < filteredClasses.length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ingress Classes</h1>
            <p className="text-sm text-muted-foreground">
              {filteredClasses.length} ingress classes (cluster-scoped)
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
            Create Class
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Classes</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-[hsl(45,93%,47%)]">{stats.withDefault}</div>
              <Star className="h-4 w-4 text-[hsl(45,93%,47%)]" />
            </div>
            <div className="text-xs text-muted-foreground">Default Classes</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.controllers}</div>
            <div className="text-xs text-muted-foreground">Unique Controllers</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ingress classes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
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
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('controller')}>
                <div className="flex items-center gap-1">Controller <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead>Parameters</TableHead>
              <TableHead className="cursor-pointer hover:text-foreground" onClick={() => handleSort('age')}>
                <div className="flex items-center gap-1">Age <ArrowUpDown className="h-3 w-3" /></div>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredClasses.map((ic) => {
              const isSelected = selectedItems.has(ic.name);
              return (
                <TableRow key={ic.name} className={cn(isSelected && "bg-primary/5")}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(ic)}
                      aria-label={`Select ${ic.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link 
                        to={`/ingressclasses/${ic.name}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ic.name}
                      </Link>
                      {ic.isDefault && (
                        <Badge variant="default" className="text-xs gap-1">
                          <Star className="h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><span className="font-mono text-sm">{ic.controller}</span></TableCell>
                  <TableCell><span className="text-muted-foreground">{ic.parameters}</span></TableCell>
                  <TableCell><span className="text-muted-foreground">{ic.age}</span></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/ingressclasses/${ic.name}`)}>
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
                          onClick={() => setDeleteDialog({ open: true, item: ic })}
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
        resourceType="IngressClass"
        resourceName={deleteDialog.bulk ? `${selectedItems.size} ingress classes` : deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="IngressClass"
          defaultYaml={DEFAULT_YAMLS.IngressClass}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('IngressClass created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </motion.div>
  );
}
