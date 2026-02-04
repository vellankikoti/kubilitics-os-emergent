import { useState, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  MoreHorizontal,
  Download,
  Plus,
  LucideIcon,
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
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
  className?: string;
}

export interface ResourceListProps<T extends object> {
  title: string;
  icon: LucideIcon;
  items: T[];
  columns: Column<T>[];
  getRowLink: (item: T) => string;
  getItemKey: (item: T) => string;
  searchPlaceholder?: string;
  filterKey?: keyof T;
  filterLabel?: string;
  actions?: { label: string; onClick?: (item: T) => void; destructive?: boolean }[];
  onRefresh?: () => void;
  onCreate?: () => void;
  isLoading?: boolean;
}

export function ResourceList<T extends object>({
  title,
  icon: Icon,
  items,
  columns,
  getRowLink,
  getItemKey,
  searchPlaceholder = 'Search...',
  filterKey,
  filterLabel = 'Filter',
  actions = [],
  onRefresh,
  onCreate,
}: ResourceListProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filterValues = filterKey 
    ? ['all', ...Array.from(new Set(items.map(item => String(item[filterKey]))))]
    : [];

  const filteredItems = items.filter((item) => {
    const searchableString = Object.values(item).join(' ').toLowerCase();
    const matchesSearch = searchableString.includes(searchQuery.toLowerCase());
    const matchesFilter = !filterKey || selectedFilter === 'all' || String(item[filterKey]) === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} {title.toLowerCase()} found
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onCreate && (
            <Button size="sm" className="gap-2" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {filterKey && filterValues.length > 1 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {selectedFilter === 'all' ? `All ${filterLabel}` : selectedFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {filterValues.map((value) => (
                <DropdownMenuItem key={value} onClick={() => setSelectedFilter(value)}>
                  {value === 'all' ? `All ${filterLabel}` : value}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map((col) => (
                <TableHead key={col.key} className={cn('font-semibold', col.className)}>
                  {col.header}
                </TableHead>
              ))}
              {actions.length > 0 && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={getItemKey(item)} className="group cursor-pointer">
                {columns.map((col, idx) => (
                  <TableCell key={col.key} className={col.className}>
                    {idx === 0 ? (
                      <Link 
                        to={getRowLink(item)}
                        className="font-medium text-primary hover:underline"
                      >
                        {col.render(item)}
                      </Link>
                    ) : (
                      col.render(item)
                    )}
                  </TableCell>
                ))}
                {actions.length > 0 && (
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.map((action, i) => (
                          <DropdownMenuItem 
                            key={action.label}
                            onClick={() => action.onClick?.(item)}
                            className={action.destructive ? 'text-destructive' : ''}
                          >
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (actions.length > 0 ? 1 : 0)} className="h-32 text-center">
                  <p className="text-muted-foreground">No {title.toLowerCase()} found</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
}
