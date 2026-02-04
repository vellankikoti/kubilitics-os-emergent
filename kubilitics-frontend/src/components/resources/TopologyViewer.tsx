import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Network, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  FileJson, 
  FileSpreadsheet, 
  Image,
  Box,
  Server,
  Layers,
  Globe,
  Container,
  Database,
  Key,
  FileCode,
  Clock,
  HardDrive,
  Shield,
  Activity,
  Cpu,
  Settings,
  Workflow,
  Atom,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { D3ForceTopology } from './D3ForceTopology';

// ResourceType is imported from D3ForceTopology - keeping local reference for styling
type LocalResourceType = 
  | 'pod' 
  | 'deployment' 
  | 'replicaset' 
  | 'service' 
  | 'node' 
  | 'namespace' 
  | 'configmap' 
  | 'secret'
  | 'ingress'
  | 'statefulset'
  | 'daemonset'
  | 'job'
  | 'cronjob'
  | 'pv'
  | 'pvc'
  | 'hpa'
  | 'vpa'
  | 'pdb'
  | 'networkpolicy'
  | 'serviceaccount'
  | 'role'
  | 'clusterrole'
  | 'rolebinding'
  | 'clusterrolebinding'
  | 'endpoint'
  | 'endpointslice'
  | 'ingressclass'
  | 'storageclass'
  | 'user'
  | 'group';

// Import types from D3ForceTopology for consistency
import type { TopologyNode, TopologyEdge, ResourceType } from './D3ForceTopology';

export interface TopologyViewerProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick?: (node: TopologyNode) => void;
  className?: string;
}

// Vibrant, distinct colors for each resource type - matching reference image
const resourceStyles: Record<ResourceType, { bg: string; border: string; iconBg: string }> = {
  pod: { 
    bg: 'hsl(199 89% 48%)', 
    border: 'hsl(199 89% 48%)', 
    iconBg: 'hsl(199 89% 48%)' 
  },
  deployment: { 
    bg: 'hsl(25 95% 53%)', 
    border: 'hsl(25 95% 53%)', 
    iconBg: 'hsl(25 95% 53%)' 
  },
  replicaset: { 
    bg: 'hsl(262 83% 58%)', 
    border: 'hsl(262 83% 58%)', 
    iconBg: 'hsl(262 83% 58%)' 
  },
  service: { 
    bg: 'hsl(142 76% 36%)', 
    border: 'hsl(142 76% 36%)', 
    iconBg: 'hsl(142 76% 36%)' 
  },
  node: { 
    bg: 'hsl(0 72% 51%)', 
    border: 'hsl(0 72% 51%)', 
    iconBg: 'hsl(0 72% 51%)' 
  },
  namespace: { 
    bg: 'hsl(280 87% 67%)', 
    border: 'hsl(280 87% 67%)', 
    iconBg: 'hsl(280 87% 67%)' 
  },
  configmap: { 
    bg: 'hsl(47 96% 53%)', 
    border: 'hsl(47 96% 53%)', 
    iconBg: 'hsl(47 96% 53%)' 
  },
  secret: { 
    bg: 'hsl(340 82% 52%)', 
    border: 'hsl(340 82% 52%)', 
    iconBg: 'hsl(340 82% 52%)' 
  },
  ingress: { 
    bg: 'hsl(174 72% 40%)', 
    border: 'hsl(174 72% 40%)', 
    iconBg: 'hsl(174 72% 40%)' 
  },
  statefulset: { 
    bg: 'hsl(220 70% 50%)', 
    border: 'hsl(220 70% 50%)', 
    iconBg: 'hsl(220 70% 50%)' 
  },
  daemonset: { 
    bg: 'hsl(280 70% 50%)', 
    border: 'hsl(280 70% 50%)', 
    iconBg: 'hsl(280 70% 50%)' 
  },
  job: { 
    bg: 'hsl(45 93% 47%)', 
    border: 'hsl(45 93% 47%)', 
    iconBg: 'hsl(45 93% 47%)' 
  },
  cronjob: { 
    bg: 'hsl(36 100% 50%)', 
    border: 'hsl(36 100% 50%)', 
    iconBg: 'hsl(36 100% 50%)' 
  },
  pv: { 
    bg: 'hsl(210 40% 50%)', 
    border: 'hsl(210 40% 50%)', 
    iconBg: 'hsl(210 40% 50%)' 
  },
  pvc: { 
    bg: 'hsl(210 60% 45%)', 
    border: 'hsl(210 60% 45%)', 
    iconBg: 'hsl(210 60% 45%)' 
  },
  hpa: { 
    bg: 'hsl(160 60% 45%)', 
    border: 'hsl(160 60% 45%)', 
    iconBg: 'hsl(160 60% 45%)' 
  },
  vpa: { 
    bg: 'hsl(150 60% 45%)', 
    border: 'hsl(150 60% 45%)', 
    iconBg: 'hsl(150 60% 45%)' 
  },
  pdb: { 
    bg: 'hsl(350 60% 50%)', 
    border: 'hsl(350 60% 50%)', 
    iconBg: 'hsl(350 60% 50%)' 
  },
  networkpolicy: { 
    bg: 'hsl(200 70% 50%)', 
    border: 'hsl(200 70% 50%)', 
    iconBg: 'hsl(200 70% 50%)' 
  },
  serviceaccount: { 
    bg: 'hsl(230 60% 55%)', 
    border: 'hsl(230 60% 55%)', 
    iconBg: 'hsl(230 60% 55%)' 
  },
  role: { 
    bg: 'hsl(300 60% 50%)', 
    border: 'hsl(300 60% 50%)', 
    iconBg: 'hsl(300 60% 50%)' 
  },
  clusterrole: { 
    bg: 'hsl(320 70% 50%)', 
    border: 'hsl(320 70% 50%)', 
    iconBg: 'hsl(320 70% 50%)' 
  },
  rolebinding: { 
    bg: 'hsl(290 60% 50%)', 
    border: 'hsl(290 60% 50%)', 
    iconBg: 'hsl(290 60% 50%)' 
  },
  clusterrolebinding: { 
    bg: 'hsl(310 60% 50%)', 
    border: 'hsl(310 60% 50%)', 
    iconBg: 'hsl(310 60% 50%)' 
  },
  endpoint: { 
    bg: 'hsl(180 60% 45%)', 
    border: 'hsl(180 60% 45%)', 
    iconBg: 'hsl(180 60% 45%)' 
  },
  endpointslice: { 
    bg: 'hsl(190 60% 45%)', 
    border: 'hsl(190 60% 45%)', 
    iconBg: 'hsl(190 60% 45%)' 
  },
  ingressclass: { 
    bg: 'hsl(170 60% 45%)', 
    border: 'hsl(170 60% 45%)', 
    iconBg: 'hsl(170 60% 45%)' 
  },
  storageclass: { 
    bg: 'hsl(200 50% 50%)', 
    border: 'hsl(200 50% 50%)', 
    iconBg: 'hsl(200 50% 50%)' 
  },
  user: { 
    bg: 'hsl(240 60% 55%)', 
    border: 'hsl(240 60% 55%)', 
    iconBg: 'hsl(240 60% 55%)' 
  },
  group: { 
    bg: 'hsl(250 60% 55%)', 
    border: 'hsl(250 60% 55%)', 
    iconBg: 'hsl(250 60% 55%)' 
  },
};

const resourceIcons: Record<ResourceType, LucideIcon> = {
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
  hpa: Activity,
  vpa: Activity,
  pdb: Shield,
  networkpolicy: Shield,
  serviceaccount: Settings,
  role: Shield,
  clusterrole: Shield,
  rolebinding: Shield,
  clusterrolebinding: Shield,
  endpoint: Globe,
  endpointslice: Network,
  ingressclass: Globe,
  storageclass: Layers,
  user: Settings,
  group: Settings,
};

const resourceLabels: Record<ResourceType, string> = {
  pod: 'Pod',
  deployment: 'Deployment',
  replicaset: 'ReplicaSet',
  service: 'Service',
  node: 'Node',
  namespace: 'Namespace',
  configmap: 'ConfigMap',
  secret: 'Secret',
  ingress: 'Ingress',
  statefulset: 'StatefulSet',
  daemonset: 'DaemonSet',
  job: 'Job',
  cronjob: 'CronJob',
  pv: 'PersistentVolume',
  pvc: 'PersistentVolumeClaim',
  hpa: 'HPA',
  vpa: 'VPA',
  pdb: 'PDB',
  networkpolicy: 'NetworkPolicy',
  serviceaccount: 'ServiceAccount',
  role: 'Role',
  clusterrole: 'ClusterRole',
  rolebinding: 'RoleBinding',
  clusterrolebinding: 'ClusterRoleBinding',
  endpoint: 'Endpoint',
  endpointslice: 'EndpointSlice',
  ingressclass: 'IngressClass',
  storageclass: 'StorageClass',
  user: 'User',
  group: 'Group',
};

interface NodePosition {
  x: number;
  y: number;
}

function calculateCleanLayout(nodes: TopologyNode[], edges: TopologyEdge[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  
  if (nodes.length === 0) return positions;
  
  // Build adjacency and find levels using BFS
  const inDegree = new Map<string, number>();
  const outEdges = new Map<string, string[]>();
  
  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    outEdges.set(n.id, []);
  });
  
  edges.forEach(e => {
    inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1);
    outEdges.get(e.from)?.push(e.to);
  });
  
  // Find root nodes (no incoming edges)
  const rootNodes = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  
  // BFS to assign levels
  const levels = new Map<string, number>();
  const queue = rootNodes.map(n => ({ id: n.id, level: 0 }));
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    levels.set(id, level);
    
    outEdges.get(id)?.forEach(toId => {
      if (!visited.has(toId)) {
        queue.push({ id: toId, level: level + 1 });
      }
    });
  }
  
  // Handle unvisited nodes
  nodes.forEach(n => {
    if (!levels.has(n.id)) levels.set(n.id, 0);
  });
  
  // Group by level
  const levelGroups = new Map<number, string[]>();
  levels.forEach((level, id) => {
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level)!.push(id);
  });
  
  // Layout constants - designed for clean visual hierarchy
  const nodeRadius = 28;
  const verticalSpacing = 130;
  const horizontalSpacing = 150;
  const canvasWidth = 600;
  const startY = 80;
  
  // Calculate positions - center each level
  levelGroups.forEach((ids, level) => {
    const totalWidth = (ids.length - 1) * horizontalSpacing;
    const startX = (canvasWidth - totalWidth) / 2;
    
    ids.forEach((id, index) => {
      positions.set(id, {
        x: startX + index * horizontalSpacing,
        y: startY + level * verticalSpacing,
      });
    });
  });
  
  return positions;
}

export function TopologyViewer({ nodes, edges, onNodeClick, className }: TopologyViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [useForceLayout, setUseForceLayout] = useState(false);
  
  const positions = useMemo(() => calculateCleanLayout(nodes, edges), [nodes, edges]);
  
  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 50)), []);
  const handleReset = useCallback(() => setZoom(100), []);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    setSelectedNode(node.id);
    onNodeClick?.(node);
  }, [onNodeClick]);

  // If force layout is enabled, render D3 component
  if (useForceLayout) {
    return (
      <div className={cn('relative', className)}>
        <D3ForceTopology 
          nodes={nodes} 
          edges={edges} 
          onNodeClick={onNodeClick}
          className={className}
        />
        <Button
          variant="outline"
          size="sm"
          className="absolute top-3.5 left-44 z-20 gap-1.5 text-xs"
          onClick={() => setUseForceLayout(false)}
        >
          <Layers className="h-3.5 w-3.5" />
          Hierarchical
        </Button>
      </div>
    );
  }

  // Calculate SVG viewbox based on content
  const maxY = Math.max(...Array.from(positions.values()).map(p => p.y), 200);
  const viewBoxHeight = Math.max(maxY + 120, 350);

  return (
    <div className={cn('rounded-xl border border-border bg-card overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Network className="h-4 w-4 text-primary" />
          </div>
          <h3 className="font-medium text-sm">Resource Topology</h3>
          
          {/* Layout toggle */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setUseForceLayout(true)}
                >
                  <Atom className="h-3.5 w-3.5" />
                  Force Layout
                </Button>
              </TooltipTrigger>
              <TooltipContent>Switch to D3.js force-directed layout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <FileJson className="h-3.5 w-3.5" />
                  JSON
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as JSON</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Image className="h-3.5 w-3.5" />
                  PNG
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export as PNG</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <div className="w-px h-4 bg-border mx-2" />
          
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-md" 
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center font-medium">{zoom}%</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 rounded-md" 
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={handleReset}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Canvas */}
      <div className="relative bg-gradient-to-b from-background to-muted/20 overflow-auto">
        <Badge 
          variant="secondary" 
          className="absolute top-4 right-4 z-10 font-medium text-xs"
        >
          {nodes.length} Resources
        </Badge>
        
        <svg
          viewBox={`0 0 600 ${viewBoxHeight}`}
          className="w-full"
          style={{ 
            minHeight: `${Math.max(viewBoxHeight * (zoom / 100), 350)}px`,
            transform: `scale(${zoom / 100})`, 
            transformOrigin: 'center top' 
          }}
        >
          {/* Edges with relationship labels */}
          {edges.map((edge, i) => {
            const fromPos = positions.get(edge.from);
            const toPos = positions.get(edge.to);
            if (!fromPos || !toPos) return null;
            
            const isHovered = hoveredNode === edge.from || hoveredNode === edge.to;
            const nodeRadius = 28;
            
            // Calculate edge points from circle borders
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const nx = dx / distance;
            const ny = dy / distance;
            
            const x1 = fromPos.x + nx * nodeRadius;
            const y1 = fromPos.y + ny * nodeRadius;
            const x2 = toPos.x - nx * nodeRadius;
            const y2 = toPos.y - ny * nodeRadius;
            
            // Midpoint for label
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            
            return (
              <g key={`edge-${i}`}>
                {/* Edge line */}
                <motion.line
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isHovered ? 0.6 : 0.35 }}
                  transition={{ delay: i * 0.03, duration: 0.4 }}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={isHovered ? 1.5 : 1}
                />
                
                {/* Relationship label */}
                {edge.label && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 + 0.2 }}
                  >
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="10"
                      fill="hsl(var(--muted-foreground))"
                      className="select-none font-medium"
                    >
                      {edge.label}
                    </text>
                  </motion.g>
                )}
              </g>
            );
          })}
          
          {/* Nodes */}
          {nodes.map((node, i) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            
            const style = resourceStyles[node.type];
            const IconComponent = resourceIcons[node.type];
            const label = resourceLabels[node.type];
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id || node.isCurrent;
            const nodeRadius = 28;
            
            return (
              <motion.g
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node)}
              >
                {/* Outer ring for current/selected */}
                {isSelected && (
                  <motion.circle
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.15 }}
                    cx={pos.x}
                    cy={pos.y}
                    r={nodeRadius + 8}
                    fill={style.bg}
                  />
                )}
                
                {/* Main circle - filled with vibrant color */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? nodeRadius + 2 : nodeRadius}
                  fill={style.bg}
                  className="transition-all duration-200"
                  style={{
                    filter: isHovered ? 'brightness(1.1)' : 'none',
                  }}
                />
                
                {/* Status indicator dot */}
                {node.status && (
                  <circle
                    cx={pos.x + nodeRadius * 0.6}
                    cy={pos.y - nodeRadius * 0.6}
                    r="6"
                    fill={
                      node.status === 'healthy' ? 'hsl(142 76% 36%)' :
                      node.status === 'warning' ? 'hsl(45 93% 47%)' :
                      node.status === 'error' ? 'hsl(0 72% 51%)' :
                      'hsl(var(--muted-foreground))'
                    }
                    stroke="hsl(var(--background))"
                    strokeWidth="2"
                  />
                )}
                
                {/* Icon */}
                <foreignObject
                  x={pos.x - 11}
                  y={pos.y - 11}
                  width="22"
                  height="22"
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
                </foreignObject>
                
                {/* Resource type label */}
                <text
                  x={pos.x}
                  y={pos.y + nodeRadius + 16}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="hsl(var(--foreground))"
                  className="select-none"
                >
                  {label}
                </text>
                
                {/* Resource name (truncated) */}
                <text
                  x={pos.x}
                  y={pos.y + nodeRadius + 30}
                  textAnchor="middle"
                  fontSize="9"
                  fill="hsl(var(--muted-foreground))"
                  className="select-none"
                >
                  {node.name.length > 20 ? node.name.slice(0, 17) + '...' : node.name}
                </text>
              </motion.g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
