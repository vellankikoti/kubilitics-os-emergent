/**
 * Topology Toolbar Component
 * View toggles, namespace selector, search, export, and layout controls
 */
import { type FC, useState } from 'react';
import { 
  Layers, 
  Network, 
  Search, 
  Download, 
  RefreshCw,
  ChevronDown,
  FileImage,
  FileCode,
  FileText,
  ArrowDown,
  ArrowRight,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TopologyToolbarProps {
  viewMode: 'cluster' | 'namespace';
  onViewModeChange: (mode: 'cluster' | 'namespace') => void;
  selectedNamespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  onExport: (format: 'png' | 'svg' | 'pdf') => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export const TopologyToolbar: FC<TopologyToolbarProps> = ({
  viewMode,
  onViewModeChange,
  selectedNamespace,
  namespaces,
  onNamespaceChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onExport,
  onRefresh,
  isRefreshing = false,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* View Mode Toggle */}
      <div className="flex items-center rounded-lg border border-border bg-card p-1">
        <Button
          variant={viewMode === 'cluster' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('cluster')}
          className="gap-1.5 h-8"
        >
          <Network className="h-4 w-4" />
          Cluster
        </Button>
        <Button
          variant={viewMode === 'namespace' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('namespace')}
          className="gap-1.5 h-8"
        >
          <Layers className="h-4 w-4" />
          Namespace
        </Button>
      </div>

      {/* Namespace Selector */}
      <Select value={selectedNamespace} onValueChange={onNamespaceChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Select namespace" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Namespaces</SelectItem>
          <DropdownMenuSeparator />
          {namespaces.map((ns) => (
            <SelectItem key={ns} value={ns}>
              {ns}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onSearchSubmit) {
              onSearchSubmit(searchQuery);
            }
          }}
          className="pl-9 h-9"
        />
      </div>

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-9">
            <Download className="h-4 w-4" />
            Export
            <ChevronDown className="h-3 w-3 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport('png')}>
            <FileImage className="h-4 w-4 mr-2" />
            Export as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('svg')}>
            <FileCode className="h-4 w-4 mr-2" />
            Export as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="h-4 w-4 mr-2" />
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh */}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  );
};

// Layout Direction Toggle (separate component for canvas overlay)
export const LayoutDirectionToggle: FC<{
  direction: 'TB' | 'LR';
  onChange: (direction: 'TB' | 'LR') => void;
  className?: string;
}> = ({ direction, onChange, className }) => {
  return (
    <div className={cn('flex items-center rounded-lg border border-border bg-card/95 backdrop-blur-sm p-1 shadow-lg', className)}>
      <Button
        variant={direction === 'TB' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('TB')}
        className="gap-1.5 h-8"
      >
        <ArrowDown className="h-4 w-4" />
        Vertical
      </Button>
      <Button
        variant={direction === 'LR' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onChange('LR')}
        className="gap-1.5 h-8"
      >
        <ArrowRight className="h-4 w-4" />
        Horizontal
      </Button>
    </div>
  );
};

export default TopologyToolbar;
