/**
 * Topology Toolbar Component
 * Clean filter row: namespace + node filters, quick presets, refresh
 */
import { type FC } from 'react';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { 
  RefreshCw,
  Layers,
  Server,
  ArrowDown,
  ArrowRight,
  Zap,
  Boxes,
  Network,
  HardDrive,
  Shield,
  LayoutGrid,
  CircleOff,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { KubernetesKind } from '@/types/topology';
import { resourceTypes } from './TopologyFilters';

const ALL_RESOURCES = resourceTypes.map((r) => r.kind);

const QUICK_FILTERS = [
  { key: 'all' as const, label: 'All', icon: LayoutGrid, resources: ALL_RESOURCES },
  { key: 'none' as const, label: 'None', icon: CircleOff, resources: [] as KubernetesKind[] },
  { key: 'workloads' as const, label: 'Workloads', icon: Boxes, resources: ['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Pod', 'Job', 'CronJob'] as KubernetesKind[] },
  { key: 'networking' as const, label: 'Networking', icon: Network, resources: ['Service', 'Ingress', 'Endpoints', 'EndpointSlice', 'NetworkPolicy'] as KubernetesKind[] },
  { key: 'storage' as const, label: 'Storage', icon: HardDrive, resources: ['PersistentVolumeClaim', 'PersistentVolume', 'StorageClass'] as KubernetesKind[] },
  { key: 'security' as const, label: 'Security', icon: Shield, resources: ['ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding', 'NetworkPolicy', 'Secret'] as KubernetesKind[] },
] as const;

export interface ClusterHealthInfo {
  healthScore: number;
  healthy: number;
  warning: number;
  error: number;
  pending: number;
  total: number;
}

interface TopologyToolbarProps {
  selectedNamespace: string;
  namespaces: string[];
  onNamespaceChange: (ns: string) => void;
  selectedNode: string;
  nodes: string[];
  onNodeChange: (node: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  selectedResources?: Set<KubernetesKind>;
  clusterHealth?: ClusterHealthInfo | null;
  onPresetFilter?: (preset: 'all' | 'none' | 'workloads' | 'networking' | 'storage' | 'security') => void;
  className?: string;
}

export const TopologyToolbar: FC<TopologyToolbarProps> = ({
  selectedNamespace,
  namespaces,
  onNamespaceChange,
  selectedNode,
  nodes,
  onNodeChange,
  onRefresh,
  isRefreshing = false,
  selectedResources = new Set(),
  clusterHealth,
  onPresetFilter,
  className,
}) => {
  const [healthExpanded, setHealthExpanded] = useState(false);
  const isNamespaceActive = selectedNamespace !== 'all';
  const isNodeActive = !!selectedNode;

  // A preset is active only when selection EXACTLY matches that preset (not a superset).
  // So "All" is active only when all resources selected; "Workloads" only when exactly workloads, etc.
  const isPresetActive = (key: string, resources: readonly KubernetesKind[]) => {
    if (key === 'all') {
      return selectedResources.size === ALL_RESOURCES.length && ALL_RESOURCES.every((r) => selectedResources.has(r));
    }
    if (key === 'none') {
      return selectedResources.size === 0;
    }
    return (
      selectedResources.size === resources.length &&
      resources.length > 0 &&
      resources.every((r) => selectedResources.has(r))
    );
  };

  const healthColor = clusterHealth
    ? clusterHealth.healthScore >= 80
      ? 'text-green-600'
      : clusterHealth.healthScore >= 50
        ? 'text-amber-600'
        : 'text-red-600'
    : 'text-muted-foreground';

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/80 px-5 py-4 shadow-sm">
        {/* Row 1: Namespace, Node */}
        <div className="flex flex-wrap items-end gap-6">
        {/* Namespace filter */}
        <div className="flex flex-col gap-2 min-w-0 flex-1 basis-[200px] max-w-[280px]">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3 w-3" />
            Namespace
          </Label>
          <Select value={selectedNamespace} onValueChange={onNamespaceChange}>
            <SelectTrigger
              className={cn(
                'h-10 w-full font-medium transition-all text-sm',
                isNamespaceActive && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              <SelectValue placeholder="All Namespaces" />
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
        </div>

        {/* Node filter */}
        <div className="flex flex-col gap-2 min-w-0 flex-1 basis-[200px] max-w-[280px]">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Server className="h-3 w-3" />
            Node
          </Label>
          <Select value={selectedNode || '__all__'} onValueChange={(v) => onNodeChange(v === '__all__' ? '' : v)}>
            <SelectTrigger
              className={cn(
                'h-10 w-full font-medium transition-all text-sm',
                isNodeActive && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
              )}
            >
              <SelectValue placeholder="All Nodes" />
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
        </div>

        </div>

        {/* Row 2: Quick filters + Health + Refresh — all on one line */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mr-1">
            <Zap className="h-3 w-3" />
            Quick
          </span>
          {onPresetFilter && QUICK_FILTERS.map(({ key, label, icon: Icon, resources }) => {
            const active = isPresetActive(key, resources);
            return (
              <motion.button
                key={key}
                onClick={() => onPresetFilter(key)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                  active
                    ? 'bg-primary/10 border-primary/50 text-primary'
                    : 'bg-background border-border text-foreground hover:bg-muted hover:border-primary/50'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </motion.button>
            );
          })}

          {/* Spacer — pushes Health and Refresh to the right */}
          <div className="flex-1 min-w-[8px]" />

          {/* Cluster Health — larger, visible, on quick filter line */}
          {clusterHealth != null && (
            <Collapsible open={healthExpanded} onOpenChange={setHealthExpanded}>
              <div className="relative flex items-center">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors border',
                      'bg-muted/60 border-border/80 hover:bg-muted',
                      healthColor
                    )}
                  >
                    <Activity className="h-4 w-4" />
                    <span>{clusterHealth.healthScore}%</span>
                    <span className="text-muted-foreground font-normal text-xs">Health</span>
                    {healthExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-lg border border-border bg-card p-4 shadow-lg">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Cluster Health
                    </div>
                    <div className={cn('text-2xl font-bold', healthColor)}>{clusterHealth.healthScore}%</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-muted-foreground">Healthy</span>
                        <span className="font-medium">{clusterHealth.healthy}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-muted-foreground">Warning</span>
                        <span className="font-medium">{clusterHealth.warning}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-muted-foreground">Error</span>
                        <span className="font-medium">{clusterHealth.error}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-muted-foreground">Pending</span>
                        <span className="font-medium">{clusterHealth.pending}</span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                      Total: {clusterHealth.total} resources
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Refresh — visible button with label */}
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            <span className="text-xs font-medium">Refresh</span>
          </Button>
        </div>
      </div>
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
