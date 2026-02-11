import { useState, useMemo, useEffect } from 'react';
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
  CheckSquare,
  ExternalLink,
  Star,
  ChevronDown,
  ChevronRight,
  List,
  Layers,
  FileText,
  CheckCircle2,
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
import { useK8sResourceList, useDeleteK8sResource, calculateAge } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { DeleteConfirmDialog } from '@/components/resources';
import { IngressClassWizard } from '@/components/wizards';
import { ResourceExportDropdown, ListPageStatCard, TableColumnHeaderWithFilterAndSort, resourceTableRowClassName, ResourceCommandBar, ListPagination, PAGE_SIZE_OPTIONS, ListViewSegmentedControl, ROW_MOTION } from '@/components/list';
import { useTableFiltersAndSort, type ColumnConfig } from '@/hooks/useTableFiltersAndSort';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

interface IngressClass {
  name: string;
  controller: string;
  isDefault: boolean;
  ingressesCount: number;
  parameters: string;
  age: string;
}

const INGRESSCLASSES_TABLE_COLUMNS: ResizableColumnConfig[] = [
  { id: 'name', defaultWidth: 180, minWidth: 100 },
  { id: 'controller', defaultWidth: 220, minWidth: 140 },
  { id: 'default', defaultWidth: 90, minWidth: 70 },
  { id: 'ingresses', defaultWidth: 100, minWidth: 70 },
  { id: 'parameters', defaultWidth: 140, minWidth: 90 },
  { id: 'age', defaultWidth: 90, minWidth: 60 },
];

type ListView = 'flat' | 'byController';

export default function IngressClasses() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: IngressClass | null; bulk?: boolean }>({ open: false, item: null });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [listView, setListView] = useState<ListView>('flat');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch } = useK8sResourceList('ingressclasses', undefined, { limit: 5000 });
  const { data: ingressesData } = useK8sResourceList<{ spec?: { ingressClassName?: string }; metadata?: { name: string } }>('ingresses', undefined, { limit: 5000 });
  const deleteResource = useDeleteK8sResource('ingressclasses');

  const ingressCountByClass = useMemo(() => {
    const map = new Map<string, number>();
    (ingressesData?.items ?? []).forEach((ing: { spec?: { ingressClassName?: string }; metadata?: { name: string } }) => {
      const className = ing.spec?.ingressClassName ?? '';
      if (className) map.set(className, (map.get(className) ?? 0) + 1);
    });
    return map;
  }, [ingressesData?.items]);

  const ingressClasses: IngressClass[] = isConnected && data?.items
    ? (data.items as { metadata: { name: string; annotations?: Record<string, string>; creationTimestamp?: string }; spec?: { controller?: string; parameters?: { name?: string } } }[]).map((item) => ({
        name: item.metadata.name,
        controller: item.spec?.controller ?? '-',
        isDefault: item.metadata.annotations?.['ingressclass.kubernetes.io/is-default-class'] === 'true',
        ingressesCount: ingressCountByClass.get(item.metadata.name) ?? 0,
        parameters: item.spec?.parameters?.name ?? '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : [];

  const stats = useMemo(() => {
    const defaultClasses = ingressClasses.filter((ic) => ic.isDefault);
    const defaultCount = defaultClasses.length;
    const defaultLabel = defaultCount === 1 ? defaultClasses[0].name : String(defaultCount);
    return {
      total: ingressClasses.length,
      default: defaultLabel,
      active: ingressClasses.filter((ic) => ic.ingressesCount > 0).length,
      controllers: new Set(ingressClasses.map((ic) => ic.controller.split('/')[0])).size,
    };
  }, [ingressClasses]);

  const itemsAfterSearch = useMemo(() => {
    return ingressClasses.filter(ic =>
      ic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ic.controller.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [ingressClasses, searchQuery]);

  const ingressClassesTableConfig: ColumnConfig<IngressClass>[] = useMemo(() => [
    { columnId: 'name', getValue: (i) => i.name, sortable: true, filterable: false },
    { columnId: 'controller', getValue: (i) => i.controller, sortable: true, filterable: true },
    { columnId: 'default', getValue: (i) => (i.isDefault ? 'Yes' : 'No'), sortable: true, filterable: false },
    { columnId: 'ingresses', getValue: (i) => i.ingressesCount, sortable: true, filterable: false },
    { columnId: 'parameters', getValue: (i) => i.parameters, sortable: true, filterable: false },
    { columnId: 'age', getValue: (i) => i.age, sortable: true, filterable: false },
  ], []);

  const { filteredAndSortedItems: filteredClasses, distinctValuesByColumn, columnFilters, setColumnFilter, sortKey, sortOrder, setSort, clearAllFilters, hasActiveFilters } = useTableFiltersAndSort(itemsAfterSearch, { columns: ingressClassesTableConfig, defaultSortKey: 'name', defaultSortOrder: 'asc' });

  const totalFiltered = filteredClasses.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const start = safePageIndex * pageSize;
  const itemsOnPage = filteredClasses.slice(start, start + pageSize);

  useEffect(() => {
    if (safePageIndex !== pageIndex) setPageIndex(safePageIndex);
  }, [safePageIndex, pageIndex]);

  const groupedOnPage = useMemo(() => {
    if (listView !== 'byController' || itemsOnPage.length === 0) return [];
    const map = new Map<string, IngressClass[]>();
    for (const ic of itemsOnPage) {
      const controllerKey = ic.controller?.split('/')[0] ?? '-';
      const list = map.get(controllerKey) ?? [];
      list.push(ic);
      map.set(controllerKey, list);
    }
    return Array.from(map.entries())
      .map(([label, classes]) => ({ groupKey: `ctrl:${label}`, label, classes }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [listView, itemsOnPage]);

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const handleDelete = async () => {
    if (deleteDialog.bulk && selectedItems.size > 0) {
      for (const name of selectedItems) {
        if (isConnected) {
          await deleteResource.mutateAsync({ name, namespace: '' });
        }
      }
      toast.success(`Deleted ${selectedItems.size} ingress classes`);
      setSelectedItems(new Set());
    } else if (deleteDialog.item) {
      if (isConnected) {
        await deleteResource.mutateAsync({ name: deleteDialog.item.name, namespace: '' });
      } else {
        toast.success(`IngressClass ${deleteDialog.item.name} deleted (demo mode)`);
      }
    }
    setDeleteDialog({ open: false, item: null });
  };

  const ingressClassExportConfig = {
    filenamePrefix: 'ingressclasses',
    resourceLabel: 'ingress classes',
    getExportData: (ic: IngressClass) => ({ name: ic.name, controller: ic.controller, isDefault: ic.isDefault, ingressesCount: ic.ingressesCount, parameters: ic.parameters, age: ic.age }),
    csvColumns: [
      { label: 'Name', getValue: (ic: IngressClass) => ic.name },
      { label: 'Controller', getValue: (ic: IngressClass) => ic.controller },
      { label: 'Default', getValue: (ic: IngressClass) => (ic.isDefault ? 'Yes' : 'No') },
      { label: 'Parameters', getValue: (ic: IngressClass) => ic.parameters },
      { label: 'Age', getValue: (ic: IngressClass) => ic.age },
    ],
    toK8sYaml: (ic: IngressClass) => `---
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: ${ic.name}
spec:
  controller: ${ic.controller}
`,
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
    const names = itemsOnPage.map((ic) => ic.name);
    const allSelected = names.length > 0 && names.every((n) => selectedItems.has(n));
    if (allSelected) {
      const next = new Set(selectedItems);
      names.forEach((n) => next.delete(n));
      setSelectedItems(next);
    } else {
      const next = new Set(selectedItems);
      names.forEach((n) => next.add(n));
      setSelectedItems(next);
    }
  };

  const isAllSelected = itemsOnPage.length > 0 && itemsOnPage.every((ic) => selectedItems.has(ic.name));
  const isSomeSelected = selectedItems.size > 0 && !isAllSelected;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Page Header - same layout as Ingresses/Deployments */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Route className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ingress Classes</h1>
            <p className="text-sm text-muted-foreground">
              {filteredClasses.length} ingress classes (cluster-scoped)
              {!isConnected && (
                <span className="ml-2 inline-flex items-center gap-1 text-[hsl(45,93%,47%)]">
                  <WifiOff className="h-3 w-3" /> Connect cluster
                </span>
              )}
            </p>
          </div>
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <span className="text-sm text-muted-foreground">{selectedItems.size} selected</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedItems(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ResourceExportDropdown
            items={filteredClasses}
            selectedKeys={selectedItems}
            getKey={(ic) => ic.name}
            config={ingressClassExportConfig}
            selectionLabel={selectedItems.size > 0 ? 'Selected ingress classes' : 'All visible ingress classes'}
            onToast={(msg, type) => (type === 'info' ? toast.info(msg) : toast.success(msg))}
          />
          {selectedItems.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-2" onClick={() => setDeleteDialog({ open: true, item: null, bulk: true })}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
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
            <ResourceExportDropdown
              items={filteredClasses}
              selectedKeys={selectedItems}
              getKey={(ic) => ic.name}
              config={ingressClassExportConfig}
              selectionLabel={selectedItems.size > 0 ? 'Selected ingress classes' : 'All visible ingress classes'}
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

      {/* Stats Cards - with icons and click-to-filter like Ingresses */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <ListPageStatCard label="Total Classes" value={stats.total} icon={Route} iconColor="text-primary" selected={!hasActiveFilters} onClick={clearAllFilters} className={cn(!hasActiveFilters && 'ring-2 ring-primary')} />
        <ListPageStatCard label="Default" value={stats.default} icon={Star} iconColor="text-[hsl(45,93%,47%)]" valueClassName="text-[hsl(45,93%,47%)]" />
        <ListPageStatCard label="Active" value={stats.active} icon={CheckCircle2} iconColor="text-[hsl(142,76%,36%)]" valueClassName="text-[hsl(142,76%,36%)]" />
        <ListPageStatCard label="Controllers" value={stats.controllers} valueClassName="text-blue-600" />
      </div>

      <ResourceCommandBar
        scope={<span className="text-sm font-medium text-muted-foreground">Cluster-scoped</span>}
        search={
          <div className="relative w-full min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search ingress classes by name or controller..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 rounded-lg border border-border bg-background text-sm font-medium shadow-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/20"
              aria-label="Search ingress classes"
            />
          </div>
        }
        structure={
          <ListViewSegmentedControl
            value={listView}
            onChange={(v) => setListView(v as ListView)}
            options={[
              { id: 'flat', label: 'Flat', icon: List },
              { id: 'byController', label: 'By Controller', icon: Layers },
            ]}
            label=""
            ariaLabel="List structure"
          />
        }
        footer={hasActiveFilters || searchQuery ? (
          <Button variant="link" size="sm" className="text-muted-foreground h-auto p-0" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
        ) : undefined}
        className="mb-2"
      />

      {/* Table */}
      <Card>
        <ResizableTableProvider tableId="kubilitics-resizable-table-ingressclasses" columnConfig={INGRESSCLASSES_TABLE_COLUMNS}>
          <div className="border border-border rounded-xl overflow-x-auto bg-card">
            <Table className="table-fixed" style={{ minWidth: 1020 }}>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/80">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={toggleAllSelection}
                      aria-label="Select all"
                      className={isSomeSelected ? 'opacity-50' : ''}
                    />
                  </TableHead>
                  <ResizableTableHead columnId="name">
                    <TableColumnHeaderWithFilterAndSort columnId="name" label="Name" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="controller">
                    <TableColumnHeaderWithFilterAndSort columnId="controller" label="Controller" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable distinctValues={distinctValuesByColumn.controller ?? []} selectedFilterValues={columnFilters.controller ?? new Set()} onFilterChange={setColumnFilter} />
                  </ResizableTableHead>
                  <ResizableTableHead columnId="default">Default</ResizableTableHead>
                  <ResizableTableHead columnId="ingresses">Ingresses</ResizableTableHead>
                  <ResizableTableHead columnId="parameters">Parameters</ResizableTableHead>
                  <ResizableTableHead columnId="age">
                    <TableColumnHeaderWithFilterAndSort columnId="age" label="Age" sortKey={sortKey} sortOrder={sortOrder} onSort={setSort} filterable={false} distinctValues={[]} selectedFilterValues={new Set()} onFilterChange={() => {}} />
                  </ResizableTableHead>
                  <TableHead className="w-12 text-center"><span className="sr-only">Actions</span><MoreHorizontal className="h-4 w-4 inline-block text-muted-foreground" aria-hidden /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && isConnected ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Route className="h-8 w-8 opacity-50" />
                        <p>No ingress classes found</p>
                        {(searchQuery || hasActiveFilters) && (
                          <Button variant="link" size="sm" onClick={() => { setSearchQuery(''); clearAllFilters(); }}>Clear filters</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : listView === 'flat' ? (
                  itemsOnPage.map((ic, idx) => {
                    const isSelected = selectedItems.has(ic.name);
                    return (
                      <motion.tr
                        key={ic.name}
                        initial={ROW_MOTION.initial}
                        animate={ROW_MOTION.animate}
                        transition={ROW_MOTION.transition(idx)}
                        className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}
                      >
                        <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(ic)} aria-label={`Select ${ic.name}`} /></TableCell>
                        <ResizableTableCell columnId="name">
                          <Link to={`/ingressclasses/${ic.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate"><Route className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{ic.name}</span></Link>
                        </ResizableTableCell>
                        <ResizableTableCell columnId="controller"><span className="font-mono text-sm truncate block">{ic.controller}</span></ResizableTableCell>
                        <ResizableTableCell columnId="default">{ic.isDefault ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-muted-foreground">No</span>}</ResizableTableCell>
                        <ResizableTableCell columnId="ingresses" className="font-mono text-sm">{ic.ingressesCount}</ResizableTableCell>
                        <ResizableTableCell columnId="parameters"><span className="text-muted-foreground truncate block">{ic.parameters}</span></ResizableTableCell>
                        <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{ic.age}</ResizableTableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors" aria-label="IngressClass actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => navigate(`/ingressclasses/${ic.name}`)} className="gap-2">View Details</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/ingresses?class=${ic.name}`)} className="gap-2"><ExternalLink className="h-4 w-4" />View Ingresses</DropdownMenuItem>
                              {!ic.isDefault && <DropdownMenuItem onClick={() => toast.info('Set as Default: requires cluster-admin or patch IngressClass')} className="gap-2"><Star className="h-4 w-4" />Set as Default</DropdownMenuItem>}
                              <DropdownMenuItem onClick={() => navigate(`/ingressclasses/${ic.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />Download YAML</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item: ic })} disabled={!isConnected}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })
                ) : (
                  groupedOnPage.flatMap((group) => {
                    const isCollapsed = collapsedGroups.has(group.groupKey);
                    return [
                      <TableRow key={group.groupKey} className="bg-muted/30 hover:bg-muted/40 cursor-pointer border-b border-border/60 transition-all duration-200" onClick={() => toggleGroup(group.groupKey)}>
                        <TableCell colSpan={8} className="py-2">
                          <div className="flex items-center gap-2 font-medium">
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                            Controller: {group.label}
                            <span className="text-muted-foreground font-normal">({group.classes.length})</span>
                          </div>
                        </TableCell>
                      </TableRow>,
                      ...(isCollapsed ? [] : group.classes.map((ic, idx) => {
                        const isSelected = selectedItems.has(ic.name);
                        return (
                          <motion.tr key={ic.name} initial={ROW_MOTION.initial} animate={ROW_MOTION.animate} transition={ROW_MOTION.transition(idx)} className={cn(resourceTableRowClassName, idx % 2 === 1 && 'bg-muted/5', isSelected && 'bg-primary/5')}>
                            <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleSelection(ic)} aria-label={`Select ${ic.name}`} /></TableCell>
                            <ResizableTableCell columnId="name"><Link to={`/ingressclasses/${ic.name}`} className="font-medium text-primary hover:underline flex items-center gap-2 truncate"><Route className="h-4 w-4 text-muted-foreground flex-shrink-0" /><span className="truncate">{ic.name}</span></Link></ResizableTableCell>
                            <ResizableTableCell columnId="controller"><span className="font-mono text-sm truncate block">{ic.controller}</span></ResizableTableCell>
                            <ResizableTableCell columnId="default">{ic.isDefault ? <Badge variant="default" className="text-xs">Yes</Badge> : <span className="text-muted-foreground">No</span>}</ResizableTableCell>
                            <ResizableTableCell columnId="ingresses" className="font-mono text-sm">{ic.ingressesCount}</ResizableTableCell>
                            <ResizableTableCell columnId="parameters"><span className="text-muted-foreground truncate block">{ic.parameters}</span></ResizableTableCell>
                            <ResizableTableCell columnId="age" className="text-muted-foreground whitespace-nowrap">{ic.age}</ResizableTableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60" aria-label="IngressClass actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52">
                                  <DropdownMenuItem onClick={() => navigate(`/ingressclasses/${ic.name}`)} className="gap-2">View Details</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => navigate(`/ingresses?class=${ic.name}`)} className="gap-2"><ExternalLink className="h-4 w-4" />View Ingresses</DropdownMenuItem>
                                  {!ic.isDefault && <DropdownMenuItem onClick={() => toast.info('Set as Default: requires cluster-admin or patch IngressClass')} className="gap-2"><Star className="h-4 w-4" />Set as Default</DropdownMenuItem>}
                                  <DropdownMenuItem onClick={() => navigate(`/ingressclasses/${ic.name}?tab=yaml`)} className="gap-2"><FileText className="h-4 w-4" />Download YAML</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="gap-2 text-[hsl(0,72%,51%)]" onClick={() => setDeleteDialog({ open: true, item: ic })} disabled={!isConnected}><Trash2 className="h-4 w-4" />Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </motion.tr>
                        );
                      })),
                    ];
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
            <span className="text-sm text-muted-foreground">
              {totalFiltered > 0 ? `Showing ${start + 1}–${Math.min(start + pageSize, totalFiltered)} of ${totalFiltered}` : 'No ingress classes'}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {pageSize} per page
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <DropdownMenuItem key={size} onClick={() => { setPageSize(size); setPageIndex(0); }} className={cn(pageSize === size && 'bg-accent')}>
                    {size} per page
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ListPagination
            hasPrev={safePageIndex > 0}
            hasNext={start + pageSize < totalFiltered}
            onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
            onNext={() => setPageIndex((i) => Math.min(totalPages - 1, i + 1))}
            currentPage={safePageIndex + 1}
            totalPages={Math.max(1, totalPages)}
            onPageChange={(p) => setPageIndex(Math.max(0, p - 1))}
          />
        </div>
      </div>

      {/* Delete Dialog */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="IngressClass"
        resourceName={deleteDialog.bulk ? `${selectedItems.size} ingress classes` : deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
      />

      {showCreateWizard && (
        <IngressClassWizard
          onClose={() => setShowCreateWizard(false)}
          onSubmit={() => { setShowCreateWizard(false); refetch(); }}
        />
      )}
    </motion.div>
  );
}
