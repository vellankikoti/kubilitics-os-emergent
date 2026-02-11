/**
 * Topology Toolbar Component
 * View toggles, namespace selector, node selector, search, export, and layout controls
 */
import { type FC } from 'react';
import { 
  Search, 
  Download, 
  RefreshCw,
  ChevronDown,
  FileImage,
  FileCode,
  FileText,
  ArrowDown,
  ArrowRight,
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
  selectedNamespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  selectedNode: string;
  nodes: string[];
  onNodeChange: (node: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  onExport: (format: 'png' | 'svg' | 'pdf') => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export const TopologyToolbar: FC<TopologyToolbarProps> = ({
  selectedNamespace,
  namespaces,
  onNamespaceChange,
  selectedNode,
  nodes,
  onNodeChange,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onExport,
  onRefresh,
  isRefreshing = false,
  className,
}) => {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 w-full', className)}>
      {/* Namespace Selector - click to open, select to filter */}
      <Select value={selectedNamespace} onValueChange={onNamespaceChange}>
        <SelectTrigger className="w-[160px] h-9 shrink-0">
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

      {/* Node Selector */}
      <Select value={selectedNode || '__all__'} onValueChange={(v) => onNodeChange(v === '__all__' ? '' : v)}>
        <SelectTrigger className="w-[160px] h-9 shrink-0">
          <SelectValue placeholder="Select node" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Nodes</SelectItem>
          <DropdownMenuSeparator />
          {nodes.map((node) => (
            <SelectItem key={node} value={node}>
              {node}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search - flex-1 to take remaining space */}
      <div className="relative flex-1 min-w-[140px]">
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
          className="pl-9 h-9 w-full"
        />
      </div>

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-9 shrink-0">
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
        className="h-9 w-9 shrink-0"
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
