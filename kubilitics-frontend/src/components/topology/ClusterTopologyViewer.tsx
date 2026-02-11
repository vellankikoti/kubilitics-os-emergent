/**
 * Cluster Topology Viewer
 * Enhanced topology visualization for cluster-scale graphs
 * Optimized for 1000+ nodes with metrics integration and insights
 */
import { useMemo, useState, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopologyViewer, type TopologyViewerRef, type TopologyViewerProps } from '@/components/resources/TopologyViewer';
import { useTopologyMetrics } from '@/hooks/useTopologyMetrics';
import {
  transformTopologyGraph,
  filterTopologyData,
  calculateClusterHealth,
  type NodeMetrics,
} from '@/utils/topologyDataTransformer';
import { calculateLayoutConfig } from './layouts/ClusterLayoutEngine';
import type { TopologyGraph } from '@/types/topology';
import type { TopologyNode, TopologyEdge } from '@/components/resources/D3ForceTopology';
import { cn } from '@/lib/utils';

export interface ClusterTopologyViewerRef {
  exportAsPng: () => void;
  fitToScreen: () => void;
  resetView: () => void;
  centerOnNode: (nodeId: string) => void;
}

export interface ClusterTopologyViewerProps {
  graph: TopologyGraph;
  selectedResources?: Set<string>;
  selectedHealth?: Set<string>;
  selectedRelationships?: Set<string>;
  searchQuery?: string;
  namespace?: string; // Filter by specific namespace
  onNodeClick?: (node: TopologyNode) => void;
  onNodeDoubleClick?: (node: TopologyNode) => void;
  className?: string;
  /** Show metrics overlays */
  showMetrics?: boolean;
  /** Show insights panel */
  showInsights?: boolean;
  /** Layout mode */
  layoutMode?: 'hierarchical' | 'force-directed' | 'namespace-grouped';
  /** When true, topology expands to full size and page scrolls (like NodeDetail topology) */
  scrollWithPage?: boolean;
  /** Cluster name for export filenames (e.g. "docker-desktop" -> "docker-desktop-topology-{timestamp}.png") */
  clusterName?: string;
}

export const ClusterTopologyViewer = forwardRef<ClusterTopologyViewerRef, ClusterTopologyViewerProps>(
  (
    {
      graph,
      selectedResources,
      selectedHealth,
      selectedRelationships,
      searchQuery = '',
      namespace,
      onNodeClick,
      onNodeDoubleClick,
      className,
      showMetrics = true,
      showInsights = false, // Health shown in toolbar instead
      layoutMode = 'hierarchical',
      scrollWithPage = false,
      clusterName,
    },
    ref
  ) => {
    const topologyViewerRef = useRef<TopologyViewerRef>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Transform graph data
    const { nodes: transformedNodes, edges: transformedEdges } = useMemo(() => {
      return transformTopologyGraph(graph);
    }, [graph]);

    // Fetch metrics
    const { metrics, isLoading: metricsLoading } = useTopologyMetrics(transformedNodes, {
      enabled: showMetrics,
      refetchInterval: 30_000,
    });

    // Enrich nodes with metrics
    const enrichedNodes = useMemo(() => {
      return transformedNodes.map((node) => {
        const nodeMetrics = metrics[node.id];
        return {
          ...node,
          _metrics: nodeMetrics,
        };
      });
    }, [transformedNodes, metrics]);

    // Filter nodes and edges
    const { nodes: filteredNodes, edges: filteredEdges } = useMemo(() => {
      return filterTopologyData(enrichedNodes, transformedEdges, {
        selectedResources,
        selectedHealth,
        searchQuery,
        namespace, // Pass namespace filter
      });
    }, [enrichedNodes, transformedEdges, selectedResources, selectedHealth, searchQuery, namespace]);

    // Calculate cluster health
    const clusterHealth = useMemo(() => {
      return calculateClusterHealth(filteredNodes);
    }, [filteredNodes]);

    // Handle node click
    const handleNodeClick = useCallback(
      (node: TopologyNode) => {
        setSelectedNodeId(node.id);
        if (onNodeClick) {
          onNodeClick(node);
        }
      },
      [onNodeClick]
    );

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      exportAsPng: () => {
        topologyViewerRef.current?.exportAsPng();
      },
      fitToScreen: () => {
        // TopologyViewer handles this internally
      },
      resetView: () => {
        // TopologyViewer handles this internally
      },
      centerOnNode: (nodeId: string) => {
        setSelectedNodeId(nodeId);
        // TopologyViewer will handle centering
      },
    }));

    // Determine layout options based on graph size and mode
    const layoutConfig = useMemo(() => {
      return calculateLayoutConfig(filteredNodes, filteredEdges, layoutMode);
    }, [filteredNodes, filteredEdges, layoutMode]);

    return (
      <div className={cn(scrollWithPage ? 'relative w-full' : 'relative h-full w-full flex flex-col min-h-0', className)}>
        {/* Topology Viewer */}
        <TopologyViewer
          ref={topologyViewerRef}
          nodes={filteredNodes}
          edges={filteredEdges}
          onNodeClick={handleNodeClick}
          layoutOptions={{
            ...layoutConfig.options,
            customLayout: layoutConfig.customLayout,
          }}
          className={scrollWithPage ? 'w-full' : 'flex-1 min-h-0 w-full'}
          hideBuiltInExport={false}
          exportFilenamePrefix={clusterName}
          scrollWithPage={scrollWithPage}
        />

        {/* Selected Node Info */}
        <AnimatePresence>
          {selectedNodeId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-4 left-4 z-10 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 max-w-xs"
            >
              {(() => {
                const node = filteredNodes.find((n) => n.id === selectedNodeId);
                if (!node) return null;

                const nodeMetrics = metrics[node.id];
                const original = (node as any)._original;

                return (
                  <div className="space-y-2">
                    <div>
                      <div className="font-semibold text-sm">{node.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {node.type} {node.namespace && `• ${node.namespace}`}
                      </div>
                    </div>
                    {nodeMetrics && (
                      <div className="text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CPU:</span>
                          <span className="font-medium">{nodeMetrics.cpu?.toFixed(0)}m</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Memory:</span>
                          <span className="font-medium">{nodeMetrics.memory?.toFixed(0)}Mi</span>
                        </div>
                      </div>
                    )}
                    {original?.computed?.replicas && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Replicas: </span>
                        <span className="font-medium">
                          {original.computed.replicas.ready}/{original.computed.replicas.desired}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1 border-t border-border">
                      <div
                        className={cn('w-2 h-2 rounded-full', {
                          'bg-green-500': node.status === 'healthy',
                          'bg-yellow-500': node.status === 'warning',
                          'bg-red-500': node.status === 'error',
                          'bg-gray-500': node.status === 'pending',
                        })}
                      />
                      <span className="text-xs capitalize">{node.status}</span>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

ClusterTopologyViewer.displayName = 'ClusterTopologyViewer';
