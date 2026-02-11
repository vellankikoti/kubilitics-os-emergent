/**
 * Topology Filters Component
 * Resource type, relationship, and health filters for the topology view
 */
import { type FC } from 'react';
import { motion } from 'framer-motion';
import { 
  Box, 
  Layers, 
  Server, 
  GitBranch, 
  Database, 
  Settings2,
  Boxes,
  Network,
  Lock,
  Clock,
  HardDrive,
  FileText,
  CircleDot,
  CircleOff,
  AlertCircle,
  Loader2,
  HelpCircle,
  Link2,
  Upload,
  ArrowRightLeft,
  Container,
  Filter,
  LayoutGrid,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KubernetesKind, HealthStatus, RelationshipType } from '@/types/topology';

// Resource type configuration
export const resourceTypes: {
  kind: KubernetesKind;
  label: string;
  color: string;
  bgColor: string;
}[] = [
  { kind: 'Namespace', label: 'Namespace', color: 'hsl(280, 100%, 70%)', bgColor: 'bg-purple-500' },
  { kind: 'Node', label: 'Node', color: 'hsl(200, 100%, 50%)', bgColor: 'bg-blue-500' },
  { kind: 'Deployment', label: 'Deployment', color: 'hsl(140, 70%, 45%)', bgColor: 'bg-green-500' },
  { kind: 'ReplicaSet', label: 'ReplicaSet', color: 'hsl(150, 60%, 50%)', bgColor: 'bg-emerald-500' },
  { kind: 'StatefulSet', label: 'StatefulSet', color: 'hsl(160, 70%, 40%)', bgColor: 'bg-teal-500' },
  { kind: 'DaemonSet', label: 'DaemonSet', color: 'hsl(190, 80%, 45%)', bgColor: 'bg-cyan-500' },
  { kind: 'Pod', label: 'Pod', color: 'hsl(210, 100%, 55%)', bgColor: 'bg-blue-500' },
  { kind: 'Service', label: 'Service', color: 'hsl(150, 80%, 40%)', bgColor: 'bg-green-600' },
  { kind: 'ConfigMap', label: 'ConfigMap', color: 'hsl(40, 90%, 50%)', bgColor: 'bg-amber-500' },
  { kind: 'Secret', label: 'Secret', color: 'hsl(20, 90%, 55%)', bgColor: 'bg-orange-500' },
  { kind: 'Job', label: 'Job', color: 'hsl(35, 95%, 55%)', bgColor: 'bg-yellow-500' },
  { kind: 'CronJob', label: 'CronJob', color: 'hsl(45, 95%, 50%)', bgColor: 'bg-yellow-600' },
  { kind: 'PersistentVolumeClaim', label: 'PVC', color: 'hsl(220, 60%, 55%)', bgColor: 'bg-indigo-500' },
  { kind: 'PersistentVolume', label: 'PV', color: 'hsl(230, 50%, 50%)', bgColor: 'bg-indigo-600' },
  { kind: 'StorageClass', label: 'StorageClass', color: 'hsl(250, 50%, 55%)', bgColor: 'bg-violet-500' },
  { kind: 'Ingress', label: 'Ingress', color: 'hsl(0, 80%, 55%)', bgColor: 'bg-red-500' },
];

// Relationship type configuration
export const relationshipTypes: {
  type: RelationshipType;
  label: string;
  icon: typeof Link2;
}[] = [
  { type: 'owns', label: 'Ownership', icon: GitBranch },
  { type: 'schedules', label: 'Hosted', icon: Server },
  { type: 'routes', label: 'Traffic', icon: ArrowRightLeft },
  { type: 'mounts', label: 'Storage', icon: HardDrive },
  { type: 'contains', label: 'Scope', icon: Layers },
];

// Health status configuration
export const healthStatuses: {
  status: HealthStatus | 'pending';
  label: string;
  color: string;
  dotColor: string;
}[] = [
  { status: 'healthy', label: 'Healthy', color: 'text-green-600', dotColor: 'bg-green-500' },
  { status: 'warning', label: 'Warning', color: 'text-amber-600', dotColor: 'bg-amber-500' },
  { status: 'critical', label: 'Error', color: 'text-red-600', dotColor: 'bg-red-500' },
  { status: 'unknown', label: 'Unknown', color: 'text-gray-500', dotColor: 'bg-gray-400' },
];

interface TopologyFiltersProps {
  selectedResources: Set<KubernetesKind>;
  onResourceToggle: (kind: KubernetesKind) => void;
  selectedRelationships: Set<RelationshipType>;
  onRelationshipToggle: (type: RelationshipType) => void;
  selectedHealth: Set<HealthStatus | 'pending'>;
  onHealthToggle: (status: HealthStatus | 'pending') => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  className?: string;
}

export const TopologyFilters: FC<TopologyFiltersProps> = ({
  selectedResources,
  onResourceToggle,
  selectedRelationships,
  onRelationshipToggle,
  selectedHealth,
  onHealthToggle,
  onClearAll,
  onSelectAll,
  className,
}) => {
  const getResourceIcon = (kind: KubernetesKind) => {
    switch (kind) {
      case 'Namespace': return Layers;
      case 'Node': return Server;
      case 'Deployment': return Boxes;
      case 'ReplicaSet': return GitBranch;
      case 'StatefulSet': return Database;
      case 'DaemonSet': return Settings2;
      case 'Pod': return CircleDot;
      case 'Service': return Network;
      case 'ConfigMap': return FileText;
      case 'Secret': return Lock;
      case 'Job': return Clock;
      case 'CronJob': return Clock;
      case 'PersistentVolumeClaim': return HardDrive;
      case 'PersistentVolume': return HardDrive;
      case 'StorageClass': return Database;
      case 'Ingress': return Upload;
      default: return Box;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Resource Type Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-3 w-3" />
            Show Resources
            {selectedResources.size > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
                {selectedResources.size}
              </Badge>
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* All / None — prominent, pill-styled, at start of row */}
          <div className="flex items-center gap-2 mr-2">
            <motion.button
              onClick={onSelectAll}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                selectedResources.size === resourceTypes.length
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-foreground hover:bg-muted hover:border-primary/50'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              All
            </motion.button>
            <motion.button
              onClick={onClearAll}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                selectedResources.size === 0
                  ? 'bg-muted border-border text-muted-foreground'
                  : 'bg-background border-border text-foreground hover:bg-muted hover:border-primary/50'
              )}
            >
              <CircleOff className="h-3.5 w-3.5" />
              None
            </motion.button>
          </div>
          <span className="text-muted-foreground/60 text-xs">|</span>
          {resourceTypes.map((resource) => {
            const Icon = getResourceIcon(resource.kind);
            const isActive = selectedResources.has(resource.kind);
            return (
              <motion.button
                key={resource.kind}
                onClick={() => onResourceToggle(resource.kind)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                  isActive
                    ? `${resource.bgColor} text-white shadow-sm`
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {resource.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Relationship Filters */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Link2 className="h-3 w-3" />
          Relationships
        </span>
        <div className="flex flex-wrap gap-2">
          {relationshipTypes.map((rel) => {
            const isActive = selectedRelationships.has(rel.type);
            return (
              <motion.button
                key={rel.type}
                onClick={() => onRelationshipToggle(rel.type)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                  isActive
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/50'
                )}
              >
                <rel.icon className="h-3.5 w-3.5" />
                {rel.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Health Filters */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Settings2 className="h-3 w-3" />
          Health
        </span>
        <div className="flex flex-wrap gap-2">
          {healthStatuses.map((health) => {
            const isActive = selectedHealth.has(health.status);
            return (
              <motion.button
                key={health.status}
                onClick={() => onHealthToggle(health.status)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                  isActive
                    ? 'bg-card border-border shadow-sm'
                    : 'bg-background border-transparent text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full', health.dotColor)} />
                {health.label}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TopologyFilters;
