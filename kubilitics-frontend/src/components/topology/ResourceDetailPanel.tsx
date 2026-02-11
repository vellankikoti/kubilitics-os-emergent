/**
 * Resource Detail Panel
 * Detailed metrics and relationships for selected resource
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, Cpu, HardDrive, Network, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';
import type { NodeMetrics } from '@/utils/topologyDataTransformer';

interface ResourceDetailPanelProps {
  node: TopologyNode | null;
  edges: TopologyEdge[];
  metrics?: NodeMetrics;
  onClose: () => void;
  onNavigate?: (node: TopologyNode) => void;
  onShowBlastRadius?: () => void;
  className?: string;
}

export function ResourceDetailPanel({
  node,
  edges,
  metrics,
  onClose,
  onNavigate,
  onShowBlastRadius,
  className,
}: ResourceDetailPanelProps) {
  if (!node) return null;

  const nodeMetrics = metrics?.[node.id];
  const original = (node as any)._original;

  // Find connected nodes
  const connectedNodes = useMemo(() => {
    const connected = new Set<string>();
    edges.forEach((edge) => {
      if (edge.from === node.id) connected.add(edge.to);
      if (edge.to === node.id) connected.add(edge.from);
    });
    return connected;
  }, [node.id, edges]);

  // Group edges by relationship type
  const edgesByType = useMemo(() => {
    const groups: Record<string, TopologyEdge[]> = {};
    edges.forEach((edge) => {
      if (edge.from === node.id || edge.to === node.id) {
        const type = edge.label || 'connected';
        if (!groups[type]) groups[type] = [];
        groups[type].push(edge);
      }
    });
    return groups;
  }, [node.id, edges]);

  const statusColor = useMemo(() => {
    switch (node.status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  }, [node.status]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn('absolute top-4 right-4 z-20 w-80', className)}
    >
      <Card className="p-4 shadow-lg border-border">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{node.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {node.type}
              </Badge>
              {node.namespace && (
                <Badge variant="outline" className="text-xs">
                  {node.namespace}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Status */}
        <div className={cn('flex items-center gap-2 p-2 rounded-md border mb-4', statusColor)}>
          {node.status === 'healthy' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <span className="text-xs font-medium capitalize">{node.status}</span>
        </div>

        {/* Metrics */}
        {nodeMetrics && (
          <div className="space-y-3 mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">Metrics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">CPU</div>
                  <div className="text-sm font-semibold">{nodeMetrics.cpu?.toFixed(0) || 0}m</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="text-xs text-muted-foreground">Memory</div>
                  <div className="text-sm font-semibold">{nodeMetrics.memory?.toFixed(0) || 0}Mi</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Replica Info */}
        {original?.computed?.replicas && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Replicas</h4>
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">
                {original.computed.replicas.ready}/{original.computed.replicas.desired}
              </div>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: `${(original.computed.replicas.ready / original.computed.replicas.desired) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Relationships */}
        {Object.keys(edgesByType).length > 0 && (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Relationships</h4>
            <div className="space-y-1">
              {Object.entries(edgesByType).map(([type, typeEdges]) => (
                <div key={type} className="text-xs">
                  <span className="text-muted-foreground">{type}:</span>{' '}
                  <span className="font-medium">{typeEdges.length}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connected Resources Count */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-xs">
            <Network className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Connected Resources:</span>
            <span className="font-semibold">{connectedNodes.size}</span>
          </div>
        </div>

        <Separator className="my-4" />

        {/* Actions */}
        <div className="flex gap-2">
          {onShowBlastRadius && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs"
              onClick={onShowBlastRadius}
            >
              <Zap className="h-3 w-3 mr-1" />
              Blast Radius
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs"
            onClick={() => {
              if (onNavigate) onNavigate(node);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View Details
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
