/**
 * Namespace Grouped Topology
 * Visualizes topology with resources grouped in draggable namespace boxes
 */
import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, useMotionValue, useDragControls } from 'framer-motion';
import { 
  Layers, 
  Boxes, 
  Box,
  Server,
  Container,
  Database,
  Globe,
  FileCode,
  Key,
  Clock,
  HardDrive,
  Network,
  Settings,
  Workflow,
  Cpu,
  Upload,
  type LucideIcon
} from 'lucide-react';
import type { TopologyNode, TopologyEdge, ResourceType } from '@/components/resources/D3ForceTopology';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface NamespaceGroup {
  namespace: string;
  nodes: TopologyNode[];
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NamespaceGroupedTopologyProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick?: (node: TopologyNode) => void;
  className?: string;
}

const BOX_PADDING = 24;
const BOX_SPACING = 40;
const MIN_BOX_WIDTH = 280;
const MIN_BOX_HEIGHT = 200;
const HEADER_HEIGHT = 48;
const NODE_SIZE = 80;
const NODES_PER_ROW = 4;

export function NamespaceGroupedTopology({
  nodes,
  edges,
  onNodeClick,
  className,
}: NamespaceGroupedTopologyProps) {
  const [namespacePositions, setNamespacePositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Group nodes by namespace
  const namespaceGroups = useMemo(() => {
    const groups = new Map<string, TopologyNode[]>();
    
    // Separate cluster-scoped resources (no namespace)
    const clusterScoped: TopologyNode[] = [];
    
    // First, collect all namespace nodes
    const namespaceNodes = nodes.filter(node => node.type === 'namespace');
    
    nodes.forEach(node => {
      if (node.type === 'cluster' || node.kind === 'Cluster') {
        // Skip cluster node itself
        return;
      }
      
      if (node.type === 'namespace') {
        // Namespace nodes themselves - initialize group
        const nsName = node.name;
        if (!groups.has(nsName)) {
          groups.set(nsName, [node]);
        }
      } else if (node.namespace) {
        // Namespace-scoped resources - add to namespace group
        if (!groups.has(node.namespace)) {
          // Create group even if namespace node doesn't exist
          groups.set(node.namespace, []);
        }
        groups.get(node.namespace)!.push(node);
      } else {
        // Cluster-scoped resources (nodes, storageclasses, etc.)
        clusterScoped.push(node);
      }
    });

    return { groups, clusterScoped };
  }, [nodes]);

  // Calculate box dimensions and initial positions
  const calculatedGroups = useMemo(() => {
    const result: NamespaceGroup[] = [];
    const { groups, clusterScoped } = namespaceGroups;
    
    let currentX = BOX_SPACING;
    let currentY = BOX_SPACING;
    let maxY = currentY;
    const colsPerRow = Math.ceil(Math.sqrt(groups.size));
    let colIndex = 0;

    // Add cluster-scoped resources box if any
    if (clusterScoped.length > 0) {
      const nodesPerRow = NODES_PER_ROW;
      const rows = Math.ceil(clusterScoped.length / nodesPerRow);
      const boxWidth = Math.max(MIN_BOX_WIDTH, nodesPerRow * NODE_SIZE + BOX_PADDING * 2);
      const boxHeight = Math.max(MIN_BOX_HEIGHT, HEADER_HEIGHT + rows * NODE_SIZE + BOX_PADDING * 2);
      
      const savedPos = namespacePositions.get('__cluster-scoped__');
      result.push({
        namespace: '__cluster-scoped__',
        nodes: clusterScoped,
        x: savedPos?.x ?? currentX,
        y: savedPos?.y ?? currentY,
        width: boxWidth,
        height: boxHeight,
      });
      
      maxY = Math.max(maxY, currentY + boxHeight);
      colIndex++;
      if (colIndex >= colsPerRow) {
        colIndex = 0;
        currentX = BOX_SPACING;
        currentY = maxY + BOX_SPACING;
      } else {
        currentX += boxWidth + BOX_SPACING;
      }
    }

    // Add namespace boxes
    Array.from(groups.entries()).forEach(([namespace, nsNodes]) => {
      const nodesPerRow = NODES_PER_ROW;
      const rows = Math.ceil(nsNodes.length / nodesPerRow);
      const boxWidth = Math.max(MIN_BOX_WIDTH, nodesPerRow * NODE_SIZE + BOX_PADDING * 2);
      const boxHeight = Math.max(MIN_BOX_HEIGHT, HEADER_HEIGHT + rows * NODE_SIZE + BOX_PADDING * 2);
      
      const savedPos = namespacePositions.get(namespace);
      result.push({
        namespace,
        nodes: nsNodes,
        x: savedPos?.x ?? currentX,
        y: savedPos?.y ?? currentY,
        width: boxWidth,
        height: boxHeight,
      });
      
      maxY = Math.max(maxY, currentY + boxHeight);
      colIndex++;
      if (colIndex >= colsPerRow) {
        colIndex = 0;
        currentX = BOX_SPACING;
        currentY = maxY + BOX_SPACING;
      } else {
        currentX += boxWidth + BOX_SPACING;
      }
    });

    return result;
  }, [namespaceGroups, namespacePositions]);

  const handleBoxDrag = useCallback((namespace: string, x: number, y: number) => {
    setNamespacePositions(prev => {
      const next = new Map(prev);
      next.set(namespace, { x, y });
      return next;
    });
  }, []);

  // Calculate container dimensions
  const containerDimensions = useMemo(() => {
    if (calculatedGroups.length === 0) {
      return { width: 800, height: 600 };
    }
    
    const maxX = Math.max(...calculatedGroups.map(g => g.x + g.width));
    const maxY = Math.max(...calculatedGroups.map(g => g.y + g.height));
    
    return {
      width: Math.max(1200, maxX + BOX_SPACING),
      height: Math.max(800, maxY + BOX_SPACING),
    };
  }, [calculatedGroups]);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full overflow-auto bg-gradient-to-b from-background to-muted/20', className)}
      style={{
        minHeight: `${containerDimensions.height}px`,
        minWidth: `${containerDimensions.width}px`,
      }}
    >
      {/* Namespace Boxes */}
      {calculatedGroups.map((group) => (
        <NamespaceBox
          key={group.namespace}
          group={group}
          onDrag={(x, y) => handleBoxDrag(group.namespace, x, y)}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
}

interface NamespaceBoxProps {
  group: NamespaceGroup;
  onDrag: (x: number, y: number) => void;
  onNodeClick?: (node: TopologyNode) => void;
}

function NamespaceBox({ group, onDrag, onNodeClick }: NamespaceBoxProps) {
  const x = useMotionValue(group.x);
  const y = useMotionValue(group.y);
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const unsubscribeX = x.on('change', (latestX) => {
      onDrag(latestX, y.get());
    });
    const unsubscribeY = y.on('change', (latestY) => {
      onDrag(x.get(), latestY);
    });
    return () => {
      unsubscribeX();
      unsubscribeY();
    };
  }, [x, y, onDrag]);

  const isClusterScoped = group.namespace === '__cluster-scoped__';
  const displayName = isClusterScoped ? 'Cluster-Scoped Resources' : `Namespace ${group.namespace}`;
  const resourceCount = group.nodes.length;

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragMomentum={false}
      style={{ x, y }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      className={cn(
        'absolute rounded-xl border-2 bg-card/95 backdrop-blur-sm shadow-lg',
        isClusterScoped
          ? 'border-primary/30'
          : 'border-purple-500/30',
        isDragging && 'shadow-2xl scale-105 z-50'
      )}
      style={{
        width: `${group.width}px`,
        height: `${group.height}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 rounded-t-xl border-b',
          isClusterScoped
            ? 'bg-primary/10 border-primary/20'
            : 'bg-purple-500/10 border-purple-500/20'
        )}
        onPointerDown={(e) => {
          dragControls.start(e);
        }}
      >
        <div className="flex items-center gap-2">
          {isClusterScoped ? (
            <Boxes className="h-4 w-4 text-primary" />
          ) : (
            <Layers className="h-4 w-4 text-purple-500" />
          )}
          <span className="font-semibold text-sm text-foreground">{displayName}</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {resourceCount}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto" style={{ height: group.height - HEADER_HEIGHT }}>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${NODES_PER_ROW}, 1fr)` }}>
          {group.nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onClick={() => onNodeClick?.(node)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface NodeCardProps {
  node: TopologyNode;
  onClick?: () => void;
}

// Resource icons mapping
const resourceIcons: Record<string, LucideIcon> = {
  pod: Box,
  deployment: Container,
  replicaset: Layers,
  service: Globe,
  node: Server,
  namespace: Network,
  configmap: FileCode,
  secret: Key,
  ingress: Globe,
  statefulset: Database,
  daemonset: Cpu,
  job: Workflow,
  cronjob: Clock,
  pv: HardDrive,
  pvc: HardDrive,
  ingressclass: Globe,
  storageclass: Layers,
  serviceaccount: Settings,
};

// Resource colors mapping
const resourceColors: Record<string, string> = {
  deployment: 'bg-green-500',
  pod: 'bg-blue-500',
  service: 'bg-green-600',
  configmap: 'bg-amber-500',
  secret: 'bg-orange-500',
  job: 'bg-yellow-500',
  cronjob: 'bg-yellow-600',
  statefulset: 'bg-teal-500',
  daemonset: 'bg-cyan-500',
  replicaset: 'bg-emerald-500',
  pvc: 'bg-indigo-500',
  ingress: 'bg-red-500',
  namespace: 'bg-purple-500',
  node: 'bg-red-600',
  pv: 'bg-indigo-600',
  storageclass: 'bg-violet-500',
  ingressclass: 'bg-blue-600',
  serviceaccount: 'bg-gray-500',
};

function NodeCard({ node, onClick }: NodeCardProps) {
  const nodeType = node.type.toLowerCase();
  const IconComponent = resourceIcons[nodeType] || Boxes;
  const bgColor = resourceColors[nodeType] || 'bg-gray-500';

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'rounded-lg border border-border bg-card p-3 cursor-pointer transition-all',
        'hover:border-primary hover:shadow-md'
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgColor)}>
          <IconComponent className="h-5 w-5 text-white" />
        </div>
        <div className="text-center w-full">
          <div className="text-xs font-medium text-foreground truncate max-w-[80px] mx-auto">
            {node.name}
          </div>
          <div className="text-[10px] text-muted-foreground capitalize">
            {node.type}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
