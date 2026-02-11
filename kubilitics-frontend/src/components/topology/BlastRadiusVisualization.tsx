/**
 * Blast Radius Visualization
 * Shows dependency tree and cascade effects for selected resource
 */
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Network } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';

interface BlastRadiusVisualizationProps {
  selectedNodeId: string | null;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick?: (node: TopologyNode) => void;
  className?: string;
}

interface DependencyNode {
  node: TopologyNode;
  level: number;
  relationship: string;
  isDirect: boolean;
}

export function BlastRadiusVisualization({
  selectedNodeId,
  nodes,
  edges,
  onNodeClick,
  className,
}: BlastRadiusVisualizationProps) {
  const dependencyTree = useMemo(() => {
    if (!selectedNodeId) return [];

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) return [];

    const tree: DependencyNode[] = [];
    const visited = new Set<string>([selectedNodeId]);
    const queue: Array<{ nodeId: string; level: number; relationship: string; isDirect: boolean }> = [
      { nodeId: selectedNodeId, level: 0, relationship: 'Selected', isDirect: true },
    ];

    // Build dependency tree using BFS
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentNode = nodes.find((n) => n.id === current.nodeId);
      if (!currentNode) continue;

      tree.push({
        node: currentNode,
        level: current.level,
        relationship: current.relationship,
        isDirect: current.isDirect,
      });

      // Find all connected nodes
      edges.forEach((edge) => {
        let targetId: string | null = null;
        let relationship = edge.label || 'connected';

        if (edge.from === current.nodeId && !visited.has(edge.to)) {
          targetId = edge.to;
        } else if (edge.to === current.nodeId && !visited.has(edge.from)) {
          targetId = edge.from;
          relationship = `${edge.label || 'connected'} (reverse)`;
        }

        if (targetId) {
          visited.add(targetId);
          queue.push({
            nodeId: targetId,
            level: current.level + 1,
            relationship,
            isDirect: current.level === 0,
          });
        }
      });
    }

    return tree;
  }, [selectedNodeId, nodes, edges]);

  const impactAnalysis = useMemo(() => {
    if (dependencyTree.length === 0) return null;

    const totalAffected = dependencyTree.length - 1; // Exclude selected node
    const directDependencies = dependencyTree.filter((d) => d.isDirect && d.level > 0).length;
    const indirectDependencies = totalAffected - directDependencies;

    // Count by resource type
    const byType: Record<string, number> = {};
    dependencyTree.forEach((d) => {
      if (d.level > 0) {
        byType[d.node.type] = (byType[d.node.type] || 0) + 1;
      }
    });

    // Risk assessment
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalAffected > 20) riskLevel = 'high';
    else if (totalAffected > 10) riskLevel = 'medium';

    return {
      totalAffected,
      directDependencies,
      indirectDependencies,
      byType,
      riskLevel,
    };
  }, [dependencyTree]);

  if (!selectedNodeId || dependencyTree.length === 0) {
    return null;
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('absolute bottom-4 right-4 z-20 w-96', className)}
    >
      <Card className="p-4 shadow-lg border-border max-h-[500px] overflow-y-auto">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-lg bg-red-50 border border-red-200">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Blast Radius Analysis</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Impact analysis for {selectedNode?.name}
            </p>
          </div>
        </div>

        {/* Impact Summary */}
        {impactAnalysis && (
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 bg-muted rounded-md">
                <div className="text-lg font-bold">{impactAnalysis.totalAffected}</div>
                <div className="text-xs text-muted-foreground">Total Affected</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-md">
                <div className="text-lg font-bold">{impactAnalysis.directDependencies}</div>
                <div className="text-xs text-muted-foreground">Direct</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-md">
                <div className="text-lg font-bold">{impactAnalysis.indirectDependencies}</div>
                <div className="text-xs text-muted-foreground">Indirect</div>
              </div>
            </div>

            {/* Risk Level */}
            <div className="flex items-center gap-2 p-2 rounded-md border">
              <span className="text-xs text-muted-foreground">Risk Level:</span>
              <Badge
                variant={
                  impactAnalysis.riskLevel === 'high'
                    ? 'destructive'
                    : impactAnalysis.riskLevel === 'medium'
                    ? 'secondary'
                    : 'outline'
                }
                className="text-xs"
              >
                {impactAnalysis.riskLevel.toUpperCase()}
              </Badge>
            </div>

            {/* Affected by Type */}
            {Object.keys(impactAnalysis.byType).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                  Affected Resources
                </h4>
                <div className="space-y-1">
                  {Object.entries(impactAnalysis.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{type}</span>
                      <Badge variant="outline" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dependency Tree Preview */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">
            Dependency Tree
          </h4>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {dependencyTree.slice(0, 10).map((dep, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex items-center gap-2 p-1.5 rounded text-xs cursor-pointer hover:bg-muted transition-colors',
                  dep.level === 0 && 'font-semibold bg-primary/10'
                )}
                onClick={() => {
                  if (onNodeClick && dep.level > 0) onNodeClick(dep.node);
                }}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {'  '.repeat(dep.level)}
                  {dep.level > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="truncate">{dep.node.name}</span>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {dep.node.type}
                </Badge>
              </div>
            ))}
            {dependencyTree.length > 10 && (
              <div className="text-xs text-muted-foreground text-center py-2">
                +{dependencyTree.length - 10} more resources
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
