/**
 * Cluster Insights Panel
 * Executive summary and health metrics for cluster topology
 */
import { useMemo, useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Activity, AlertTriangle, CheckCircle2, Clock, TrendingUp, Cpu, HardDrive, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TopologyNode } from '@/components/resources/D3ForceTopology';
import { calculateClusterHealth } from '@/utils/topologyDataTransformer';
import type { NodeMetrics } from '@/utils/topologyDataTransformer';

interface ClusterInsightsPanelProps {
  nodes: TopologyNode[];
  metrics?: NodeMetrics;
  className?: string;
}

export function ClusterInsightsPanel({ nodes, metrics, className }: ClusterInsightsPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const clusterHealth = useMemo(() => {
    return calculateClusterHealth(nodes);
  }, [nodes]);

  // Calculate resource utilization
  const resourceUtilization = useMemo(() => {
    if (!metrics) return null;

    let totalCPU = 0;
    let totalMemory = 0;
    let nodeCount = 0;

    Object.values(metrics).forEach((m) => {
      if (m.cpu) totalCPU += m.cpu;
      if (m.memory) totalMemory += m.memory;
      nodeCount++;
    });

    return {
      totalCPU,
      totalMemory,
      avgCPU: nodeCount > 0 ? totalCPU / nodeCount : 0,
      avgMemory: nodeCount > 0 ? totalMemory / nodeCount : 0,
    };
  }, [metrics]);

  // Find critical issues
  const criticalIssues = useMemo(() => {
    const issues: Array<{ type: string; count: number; severity: 'error' | 'warning' }> = [];

    const errorNodes = nodes.filter((n) => n.status === 'error');
    if (errorNodes.length > 0) {
      issues.push({ type: 'Failed Resources', count: errorNodes.length, severity: 'error' });
    }

    const warningNodes = nodes.filter((n) => n.status === 'warning');
    if (warningNodes.length > 0) {
      issues.push({ type: 'Warnings', count: warningNodes.length, severity: 'warning' });
    }

    // Check for replica mismatches
    const replicaMismatches = nodes.filter((n) => {
      const original = (n as any)._original;
      if (original?.computed?.replicas) {
        const { desired, ready } = original.computed.replicas;
        return ready < desired;
      }
      return false;
    });
    if (replicaMismatches.length > 0) {
      issues.push({ type: 'Replica Mismatches', count: replicaMismatches.length, severity: 'warning' });
    }

    return issues;
  }, [nodes]);

  const healthColor = useMemo(() => {
    if (clusterHealth.healthScore >= 80) return 'text-green-600';
    if (clusterHealth.healthScore >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }, [clusterHealth.healthScore]);

  const healthBgColor = useMemo(() => {
    if (clusterHealth.healthScore >= 80) return 'bg-green-500';
    if (clusterHealth.healthScore >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  }, [clusterHealth.healthScore]);

  return (
    <motion.div
      drag
      dragMomentum={false}
      style={{ x, y }}
      dragConstraints={{ left: -Infinity, right: Infinity, top: -Infinity, bottom: Infinity }}
      className="cursor-move"
    >
      <Card className={cn('shadow-lg border-border max-w-sm', className)}>
        {/* Header with drag handle and minimize toggle */}
        <div className="flex items-center justify-between p-3 border-b border-border cursor-move">
          <div className="flex items-center gap-2 flex-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Cluster Health</h3>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
            >
              {isMinimized ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronUp className="h-3 w-3" />
              )}
            </Button>
          </div>
        </div>

      {!isMinimized && (
        <div className="p-4 space-y-4">
          {/* Health Score - Prominent display, no overlapping text */}
          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">Health Score</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-4xl font-bold leading-none', healthColor)}>{clusterHealth.healthScore}</span>
              <span className={cn('text-xl font-semibold', healthColor)}>%</span>
            </div>
            <Progress value={clusterHealth.healthScore} className="h-2" />
          </div>

      {/* Resource Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Healthy</div>
            <div className="text-lg font-semibold">{clusterHealth.healthy}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Warning</div>
            <div className="text-lg font-semibold">{clusterHealth.warning}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Error</div>
            <div className="text-lg font-semibold">{clusterHealth.error}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-600" />
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">Pending</div>
            <div className="text-lg font-semibold">{clusterHealth.pending}</div>
          </div>
        </div>
      </div>

      {/* Resource Utilization */}
      {resourceUtilization && (
        <div className="pt-3 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Resource Utilization</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Total CPU</span>
              </div>
              <span className="font-medium">{resourceUtilization.totalCPU.toFixed(0)}m</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <HardDrive className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Total Memory</span>
              </div>
              <span className="font-medium">{resourceUtilization.totalMemory.toFixed(0)}Mi</span>
            </div>
          </div>
        </div>
      )}

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div className="pt-3 border-t border-border space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Critical Issues</h4>
          <div className="space-y-1">
            {criticalIssues.map((issue, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{issue.type}</span>
                <Badge
                  variant={issue.severity === 'error' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {issue.count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

          {/* Total Resources - Moved to bottom, smaller */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Resources</span>
              <span className="font-semibold text-foreground">{clusterHealth.total}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Minimized view */}
      {isMinimized && (
        <div className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Health Score</span>
            <span className={cn('text-lg font-bold', healthColor)}>{clusterHealth.healthScore}%</span>
          </div>
        </div>
      )}
    </Card>
    </motion.div>
  );
}
