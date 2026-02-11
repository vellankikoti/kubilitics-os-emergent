import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
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
  | 'cluster'
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

export interface LayoutOptions {
  nodeRadius?: number;
  verticalSpacing?: number;
  horizontalSpacing?: number;
  canvasWidth?: number;
  startY?: number;
  /** When set, level-1 nodes are laid out in a grid with this many columns (for large clusters). */
  level1GridCols?: number;
}

/** When parent provides its own export UI (e.g. NodeDetail full report + graph), set true to avoid duplicate buttons. */
export interface TopologyViewerProps {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  onNodeClick?: (node: TopologyNode) => void;
  className?: string;
  /** Use 'card' for dashboard: compact layout, no toolbar, fits in card */
  variant?: 'default' | 'card';
  layoutOptions?: LayoutOptions;
  /** Hide JSON/CSV/PNG in toolbar; parent shows a single consolidated export row */
  hideBuiltInExport?: boolean;
  /** Expanded resources (namespaces, deployments, replicasets, nodes) - controls visibility of child resources */
  expandedResources?: Set<string>;
  /** Callback when resource expansion state changes */
  onToggleExpansion?: (resourceId: string) => void;
}

export interface TopologyViewerRef {
  /** Export current graph as PNG (call when parent owns export UI). */
  exportAsPng: () => void;
}

// Vibrant, distinct colors for each resource type - matching reference image
const resourceStyles: Record<ResourceType, { bg: string; border: string; iconBg: string }> = {
  cluster: { bg: 'hsl(217 91% 60%)', border: 'hsl(217 91% 60%)', iconBg: 'hsl(217 91% 60%)' },
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
  cluster: Network,
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
  cluster: 'Cluster',
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

const DEFAULT_LAYOUT: Required<LayoutOptions> = {
  nodeRadius: 28,
  verticalSpacing: 130,
  horizontalSpacing: 200, // Increased for better readability (namespaces spacing)
  canvasWidth: 600,
  startY: 80,
};

const CARD_CANVAS_WIDTH = 560;
const CARD_CANVAS_HEIGHT = 320;
const CARD_MARGIN = 24;
const MIN_NODE_RADIUS = 8;
const MAX_NODE_RADIUS = 24;
const MIN_SPACING = 20;
/** When a level has more than this many nodes, use a grid so the graph stays within canvas width and nothing is cut off. */
const MAX_NODES_PER_ROW = 10;
const VIEWBOX_PADDING = 48;

/**
 * Semantic display level: center resource is 0; negative = above (parents), positive = below (children).
 * Ensures "Viewing" resource is the central graph node with hierarchy above and below.
 */
/**
 * Get semantic level for cluster-centric hierarchy
 * Level 0: Cluster (central root)
 * Level 1: Worker Nodes
 * Level 2: Namespaces
 * Level 3: Workloads (Deployments, StatefulSets, etc.)
 * Level 4: ReplicaSets
 * Level 5: Pods
 * Level 6: Supporting Resources (Services, ConfigMaps, Secrets, PVCs)
 */
/**
 * New hierarchical structure:
 * Level 0: Cluster (parent 1)
 * Level 1: Cluster-scoped resources (child node 1) - Nodes, StorageClasses, PVs, IngressClasses
 * Level 2: Namespaces (under cluster-scoped)
 * Level 3: Namespace-scoped resources (under namespaces) - Deployments, Services, etc.
 * Level 4: ReplicaSets (under deployments, when expanded)
 * Level 5: Pods (under replicasets/statefulsets, when expanded)
 */
function getClusterSemanticLevel(nodeType: ResourceType): number {
  switch (nodeType) {
    case 'cluster': return 0;  // Parent 1: Cluster
    // Cluster-scoped resources (child node 1)
    case 'node':
    case 'storageclass':
    case 'pv':
    case 'ingressclass': return 1;  // Cluster-scoped resources
    case 'namespace': return 2;  // Namespaces under cluster-scoped
    // Namespace-scoped resources
    case 'deployment':
    case 'statefulset':
    case 'daemonset':
    case 'job':
    case 'cronjob':
    case 'service':
    case 'configmap':
    case 'secret':
    case 'persistentvolumeclaim':
    case 'ingress':
    case 'serviceaccount': return 3;  // Namespace-scoped resources
    case 'replicaset': return 4;  // Under deployments (when expanded)
    case 'pod': return 5;  // Under replicasets/statefulsets (when expanded)
    default: return 6;
  }
}

function getSemanticLevel(nodeType: ResourceType, centerType: string): number {
  const t = nodeType;
  const c = centerType;
  // Cluster topology: cluster center, then nodes → namespaces → workloads → replicasets → pods → supporting
  if (c === 'cluster') {
    return getClusterSemanticLevel(t);
  }
  // Node topology: node center, then namespaces → workloads → replicasets → pods → supporting
  if (c === 'node') {
    if (t === 'node') return 0;
    if (t === 'namespace') return 1;
    if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(t)) return 2;
    if (t === 'replicaset') return 3;
    if (t === 'pod') return 4;
    if (['configmap', 'secret', 'serviceaccount', 'pvc', 'pv', 'service'].includes(t)) return 5;
    return 6;
  }
  // Pod topology: pod center; node/namespace/deployment/replicaset ON TOP (above), supporting below
  if (c === 'pod') {
    if (t === 'pod') return 0;
    if (t === 'node' || t === 'namespace') return -2;
    if (['deployment', 'replicaset', 'statefulset', 'daemonset', 'job', 'cronjob'].includes(t)) return -1;
    if (t === 'service') return 1;
    if (['configmap', 'secret', 'serviceaccount', 'pvc', 'pv'].includes(t)) return 2;
    return 3;
  }
  // Deployment topology: deployment center; namespace above; replicasets → pods → supporting below
  if (c === 'deployment') {
    if (t === 'deployment') return 0;
    if (t === 'namespace') return -1;
    if (t === 'replicaset') return 1;
    if (t === 'pod') return 2;
    if (['configmap', 'secret', 'serviceaccount', 'service'].includes(t)) return 3;
    return 4;
  }
  // ReplicaSet topology: replicaset center; deployment above; pods and supporting below
  if (c === 'replicaset') {
    if (t === 'replicaset') return 0;
    if (t === 'deployment') return -1;
    if (t === 'pod') return 1;
    if (['namespace', 'configmap', 'secret', 'serviceaccount', 'service'].includes(t)) return 2;
    return 3;
  }
  // StatefulSet topology: statefulset center; namespace above; pods and supporting below
  if (c === 'statefulset') {
    if (t === 'statefulset') return 0;
    if (t === 'namespace') return -1;
    if (t === 'pod') return 1;
    if (['configmap', 'secret', 'serviceaccount', 'pvc', 'service'].includes(t)) return 2;
    return 3;
  }
  // DaemonSet topology: daemonset center; namespace above; pods and supporting below
  if (c === 'daemonset') {
    if (t === 'daemonset') return 0;
    if (t === 'namespace') return -1;
    if (t === 'pod') return 1;
    if (['configmap', 'secret', 'serviceaccount', 'service'].includes(t)) return 2;
    return 3;
  }
  // Job topology: job center; namespace above; pods and supporting below
  if (c === 'job') {
    if (t === 'job') return 0;
    if (t === 'namespace') return -1;
    if (t === 'pod') return 1;
    if (['configmap', 'secret', 'serviceaccount', 'pvc', 'service'].includes(t)) return 2;
    return 3;
  }
  // CronJob topology: cronjob center; namespace above; jobs → pods → supporting below
  if (c === 'cronjob') {
    if (t === 'cronjob') return 0;
    if (t === 'namespace') return -1;
    if (t === 'job') return 1;
    if (t === 'pod') return 2;
    if (['configmap', 'secret', 'serviceaccount', 'pvc', 'service'].includes(t)) return 3;
    return 4;
  }
  if (c === 'namespace') {
    if (t === 'namespace') return 0;
    // Cluster-scoped resources (Level 1) - shown alongside namespace
    if (['node', 'storageclass', 'pv', 'ingressclass'].includes(t)) return 1;
    // Workloads and Services (Level 2)
    if (['deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'service', 'ingress'].includes(t)) return 2;
    // ReplicaSets (Level 3)
    if (t === 'replicaset') return 3;
    // Pods (Level 4)
    if (t === 'pod') return 4;
    // Supporting resources (Level 5)
    if (['configmap', 'secret', 'serviceaccount', 'pvc'].includes(t)) return 5;
    return 6;
  }
  if (c === 'service') {
    if (t === 'service') return 0;
    if (['pod', 'deployment', 'endpoint', 'endpointslice'].includes(t)) return 1;
    if (['namespace', 'configmap', 'secret'].includes(t)) return 2;
    return 3;
  }
  return -999; // sentinel: use graph (bfs) level instead
}

/** Compute card layout options dynamically: 5 or 50 nodes fit clearly and use full card space. */
function getCardLayoutOptions(level1NodeCount: number): LayoutOptions & { canvasHeight: number } {
  const N = Math.max(0, level1NodeCount);
  const width = CARD_CANVAS_WIDTH - 2 * CARD_MARGIN;
  const startY = 48;

  if (N <= 0) {
    return {
      nodeRadius: MAX_NODE_RADIUS,
      verticalSpacing: 80,
      horizontalSpacing: 120,
      canvasWidth: CARD_CANVAS_WIDTH,
      startY,
      canvasHeight: 200,
    };
  }

  // Single row: compute R so N nodes fit in width; use if R >= MIN_NODE_RADIUS
  const singleRowR = (width - (N - 1) * MIN_SPACING) / (2 * N);
  if (singleRowR >= MIN_NODE_RADIUS && N <= 15) {
    const nodeRadius = Math.min(MAX_NODE_RADIUS, Math.max(MIN_NODE_RADIUS, singleRowR));
    const totalUsed = N * 2 * nodeRadius + (N - 1) * MIN_SPACING;
    const horizontalSpacing = N > 1 ? (width - N * 2 * nodeRadius) / (N - 1) : MIN_SPACING;
    return {
      nodeRadius,
      verticalSpacing: 88,
      horizontalSpacing: Math.max(MIN_SPACING, horizontalSpacing),
      canvasWidth: CARD_CANVAS_WIDTH,
      startY,
      canvasHeight: startY + 88 + 2 * nodeRadius + 24,
    };
  }

  // Many nodes: grid layout so 50+ nodes fit and stay readable
  const maxCols = 10;
  const cols = Math.min(N, maxCols);
  const rows = Math.ceil(N / cols);
  const cellWidth = width / cols;
  const nodeDiameter = Math.min(2 * MAX_NODE_RADIUS, Math.max(2 * MIN_NODE_RADIUS, cellWidth - MIN_SPACING));
  const nodeRadius = nodeDiameter / 2;
  const rowHeight = nodeDiameter + MIN_SPACING;
  const verticalSpacing = 72;
  const level1Height = rows * rowHeight;
  const canvasHeight = Math.min(480, startY + verticalSpacing + level1Height + 24);

  return {
    nodeRadius,
    verticalSpacing,
    horizontalSpacing: cellWidth,
    canvasWidth: CARD_CANVAS_WIDTH,
    startY,
    level1GridCols: cols,
    canvasHeight,
  };
}

function calculateCleanLayout(
  nodes: TopologyNode[],
  edges: TopologyEdge[],
  options: LayoutOptions & { canvasHeight?: number; customLayout?: Map<string, NodePosition> } = {}
): Map<string, NodePosition> {
  if (options.customLayout) return options.customLayout;

  const positions = new Map<string, NodePosition>();
  if (nodes.length === 0) return positions;

  const {
    nodeRadius,
    verticalSpacing,
    horizontalSpacing,
    canvasWidth,
    startY,
    level1GridCols,
  } = { ...DEFAULT_LAYOUT, ...options };

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

  const rootNodes = nodes.filter(n => (inDegree.get(n.id) || 0) === 0);
  const bfsLevels = new Map<string, number>();
  const queue = rootNodes.map(n => ({ id: n.id, level: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, level } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    bfsLevels.set(id, level);
    outEdges.get(id)?.forEach(toId => {
      if (!visited.has(toId)) queue.push({ id: toId, level: level + 1 });
    });
  }
  nodes.forEach(n => {
    if (!bfsLevels.has(n.id)) bfsLevels.set(n.id, 0);
  });

  // Detect cluster-centric layout: check if cluster node exists
  const clusterNode = nodes.find(n => n.type === 'cluster');
  const isClusterCentric = !!clusterNode;

  // Detect namespace-filtered mode: when all namespace-scoped resources share the same namespace
  const namespaceNodes = nodes.filter(n => n.type === 'namespace');
  const namespaceScopedNodes = nodes.filter(n => n.namespace && n.type !== 'namespace');
  const uniqueNamespaces = new Set(namespaceScopedNodes.map(n => n.namespace).filter(Boolean));
  // Consider it namespace-filtered if:
  // 1. All namespace-scoped resources share one namespace, OR
  // 2. There's exactly one namespace node and most resources are namespace-scoped
  const isNamespaceFiltered = (uniqueNamespaces.size === 1 && namespaceScopedNodes.length > 0) ||
    (namespaceNodes.length === 1 && namespaceScopedNodes.length > namespaceNodes.length);
  const filteredNamespace = isNamespaceFiltered 
    ? (uniqueNamespaces.size === 1 ? Array.from(uniqueNamespaces)[0] : namespaceNodes[0]?.name)
    : null;
  const namespaceNode = filteredNamespace 
    ? namespaceNodes.find(n => n.name === filteredNamespace) || namespaceNodes[0]
    : null;

  // Determine center type: prioritize namespace-filtered mode, then isCurrent flag, then cluster, then node
  const centerNode = nodes.find(n => n.isCurrent) ?? 
    (isNamespaceFiltered && namespaceNode ? namespaceNode : 
     (isClusterCentric ? clusterNode : rootNodes[0]));
  let centerType: string = 'node'; // default
  if (isNamespaceFiltered && namespaceNode) {
    centerType = 'namespace';
  } else if (centerNode) {
    centerType = centerNode.type;
  } else if (isClusterCentric) {
    centerType = 'cluster';
  } else if (nodes.find(n => n.type === 'node')) {
    centerType = 'node';
  }
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Namespace hierarchy spacing configuration (optimized for namespace-filtered views)
  const NAMESPACE_HIERARCHY_SPACING: Record<number, number> = {
    0: 0,      // Level 0 (namespace) - no spacing before
    1: 180,    // Level 0-1 gap: Namespace to Cluster-scoped resources
    2: 160,    // Level 1-2 gap: Cluster-scoped to Workloads
    3: 140,    // Level 2-3 gap: Workloads to ReplicaSets
    4: 120,    // Level 3-4 gap: ReplicaSets to Pods
    5: 100,    // Level 4-5 gap: Pods to Supporting resources
    6: 80,     // Level 5-6 gap: Additional levels
  };

  // Cluster hierarchy spacing configuration (Apple-grade spacing, increased for readability)
  const CLUSTER_HIERARCHY_SPACING: Record<number, number> = {
    0: 0,      // Level 0 (cluster) - no spacing before
    1: 200,    // Level 0-1 gap: Cluster to Cluster-scoped resources
    2: 180,    // Level 1-2 gap: Cluster-scoped to Namespaces
    3: 150,    // Level 2-3 gap: Namespaces to Namespace-scoped resources
    4: 120,    // Level 3-4 gap: Deployments to ReplicaSets (when expanded)
    5: 100,    // Level 4-5 gap: ReplicaSets to Pods (when expanded)
    6: 80,     // Level 5-6 gap: Additional levels
  };

  const levelGroups = new Map<number, string[]>();
  nodes.forEach((n) => {
    // For namespace-filtered views, ensure namespace node is at level 0
    if (isNamespaceFiltered && n.type === 'namespace' && n.name === filteredNamespace) {
      levelGroups.set(0, levelGroups.get(0) || []);
      levelGroups.get(0)!.push(n.id);
    } else {
      const semantic = getSemanticLevel(n.type, centerType);
      const displayLevel = semantic > -999 ? semantic : (bfsLevels.get(n.id) ?? 0);
      if (!levelGroups.has(displayLevel)) levelGroups.set(displayLevel, []);
      levelGroups.get(displayLevel)!.push(n.id);
    }
  });

  // Type ordering for namespace-centric layout (when namespace-filtered)
  const namespaceTypeOrder: Record<string, number> = {
    namespace: -1, // Namespace should be first
    // Cluster-scoped resources (Level 1)
    node: 0, storageclass: 1, pv: 2, ingressclass: 3,
    // Workloads (Level 2)
    deployment: 20, statefulset: 21, daemonset: 22, job: 23, cronjob: 24,
    // Supporting resources (Level 2, after workloads)
    service: 25, ingress: 26,
    // Nested resources (Level 3+)
    replicaset: 40, pod: 50,
    // Config/Storage resources (Level 5)
    configmap: 60, secret: 61, serviceaccount: 62, pvc: 63,
  };

  // Type ordering for cluster-centric layout: cluster-scoped first, then namespaces, then namespace-scoped
  const typeOrder: Record<string, number> = {
    cluster: -1, // Cluster should be first
    // Cluster-scoped resources (Level 1)
    node: 0, storageclass: 1, pv: 2, ingressclass: 3,
    // Namespaces (Level 2)
    namespace: 10,
    // Namespace-scoped resources (Level 3)
    deployment: 20, statefulset: 21, daemonset: 22, job: 23, cronjob: 24,
    service: 25, configmap: 26, secret: 27, serviceaccount: 28, pvc: 29, ingress: 30,
    // Nested resources (Level 4+)
    replicaset: 40, pod: 50,
  };

  const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b);
  let levelBaseY = startY;

  sortedLevels.forEach((level, levelIndex) => {
    const ids = levelGroups.get(level)!;
      const sorted = [...ids].sort((a, b) => {
      const nodeA = nodeById.get(a);
      const nodeB = nodeById.get(b);
      const typeA = nodeA?.type ?? '';
      const typeB = nodeB?.type ?? '';

      // For namespace-filtered layout, use namespace-centric ordering
      if (isNamespaceFiltered) {
        // Level 0: Namespace node
        if (level === 0) {
          if (typeA === 'namespace') return -1;
          if (typeB === 'namespace') return 1;
        }
        // Level 1: Cluster-scoped resources - order: node, storageclass, pv, ingressclass
        if (level === 1) {
          const clusterScopedOrder: Record<string, number> = { node: 0, storageclass: 1, pv: 2, ingressclass: 3 };
          const orderA = clusterScopedOrder[typeA] ?? 99;
          const orderB = clusterScopedOrder[typeB] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
        }
        // Level 2: Workloads first, then services/ingress
        if (level === 2) {
          const workloadTypes = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'];
          const aIsWorkload = workloadTypes.includes(typeA);
          const bIsWorkload = workloadTypes.includes(typeB);
          if (aIsWorkload && !bIsWorkload) return -1;
          if (!aIsWorkload && bIsWorkload) return 1;
        }
        // Level 5: Supporting resources - order: configmap, secret, serviceaccount, pvc
        if (level === 5) {
          const supportingOrder: Record<string, number> = { configmap: 0, secret: 1, serviceaccount: 2, pvc: 3 };
          const orderA = supportingOrder[typeA] ?? 99;
          const orderB = supportingOrder[typeB] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
        }
        const orderA = namespaceTypeOrder[typeA] ?? 99;
        const orderB = namespaceTypeOrder[typeB] ?? 99;
        return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
      }

      // For cluster-centric layout, ensure proper ordering at each level
      if (isClusterCentric) {
        // Level 1: Cluster-scoped resources - order: node, storageclass, pv, ingressclass
        if (level === 1) {
          const clusterScopedOrder: Record<string, number> = { node: 0, storageclass: 1, pv: 2, ingressclass: 3 };
          const orderA = clusterScopedOrder[typeA] ?? 99;
          const orderB = clusterScopedOrder[typeB] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
        }
        // Level 2: Namespaces only
        if (level === 2) {
          if (typeA === 'namespace' && typeB !== 'namespace') return -1;
          if (typeA !== 'namespace' && typeB === 'namespace') return 1;
        }
        // Level 3: Namespace-scoped resources - order: workloads first, then supporting
        if (level === 3) {
          const workloadTypes = ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob'];
          const aIsWorkload = workloadTypes.includes(typeA);
          const bIsWorkload = workloadTypes.includes(typeB);
          if (aIsWorkload && !bIsWorkload) return -1;
          if (!aIsWorkload && bIsWorkload) return 1;
        }
      }

      const orderA = typeOrder[typeA] ?? 99;
      const orderB = typeOrder[typeB] ?? 99;
      return orderA !== orderB ? orderA - orderB : a.localeCompare(b);
    });

    // For namespace-filtered layout, use special spacing and positioning
    if (isNamespaceFiltered && level === 0) {
      // Namespace node: center it at top
      const namespaceId = sorted.find(id => {
        const node = nodeById.get(id);
        return node?.type === 'namespace' && node?.name === filteredNamespace;
      }) || sorted[0];
      if (namespaceId) {
        positions.set(namespaceId, {
          x: canvasWidth / 2,
          y: levelBaseY,
        });
        // Use namespace hierarchy spacing for next level
        levelBaseY += (NAMESPACE_HIERARCHY_SPACING[1] || verticalSpacing);
      }
      // Remove namespace node from sorted list for remaining processing
      const remainingIds = sorted.filter(id => id !== namespaceId);
      if (remainingIds.length === 0) return;
      sorted.length = 0;
      sorted.push(...remainingIds);
    }

    // For cluster-centric layout, use special spacing and positioning
    if (isClusterCentric && level === 0 && !isNamespaceFiltered) {
      // Cluster node: center it at top
      const clusterId = sorted[0];
      if (clusterId) {
        positions.set(clusterId, {
          x: canvasWidth / 2,
          y: levelBaseY,
        });
        // Use cluster hierarchy spacing for next level
        levelBaseY += (CLUSTER_HIERARCHY_SPACING[1] || verticalSpacing);
      }
      return;
    }

    // Calculate spacing based on layout type
    let levelSpacing = verticalSpacing;
    if (isNamespaceFiltered && level > 0) {
      levelSpacing = NAMESPACE_HIERARCHY_SPACING[level] || verticalSpacing;
    } else if (isClusterCentric && level > 0) {
      levelSpacing = CLUSTER_HIERARCHY_SPACING[level] || verticalSpacing;
    }

    // For namespace-filtered views, use slightly larger horizontal spacing to prevent overlap
    const effectiveHorizontalSpacing = isNamespaceFiltered 
      ? Math.max(horizontalSpacing, 120) 
      : horizontalSpacing;
    const singleRowWidth = (sorted.length - 1) * effectiveHorizontalSpacing;
    const useGrid =
      (level === 1 && level1GridCols != null && sorted.length > level1GridCols) ||
      sorted.length > MAX_NODES_PER_ROW ||
      (sorted.length > 1 && singleRowWidth > canvasWidth);

    if (useGrid) {
      const cols = level === 1 && level1GridCols != null ? level1GridCols : Math.min(MAX_NODES_PER_ROW, sorted.length);
      const rows = Math.ceil(sorted.length / cols);
      const cellWidth = canvasWidth / cols;
      const rowHeight = 2 * nodeRadius + MIN_SPACING;
      sorted.forEach((id, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        positions.set(id, {
          x: cellWidth * col + cellWidth / 2,
          y: levelBaseY + row * rowHeight,
        });
      });
      levelBaseY += rows * rowHeight + levelSpacing;
    } else {
      const totalWidth = (sorted.length - 1) * effectiveHorizontalSpacing;
      const startX = Math.max(0, (canvasWidth - totalWidth) / 2);
      sorted.forEach((id, index) => {
        positions.set(id, {
          x: startX + index * effectiveHorizontalSpacing,
          y: levelBaseY,
        });
      });
      levelBaseY += 2 * nodeRadius + levelSpacing;
    }
  });

  return positions;
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM()?.inverse() ?? undefined);
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TopologyViewer = forwardRef<TopologyViewerRef, TopologyViewerProps>(function TopologyViewer(
  { nodes, edges, onNodeClick, className, variant = 'default', layoutOptions, hideBuiltInExport = false, expandedResources: externalExpandedResources, onToggleExpansion },
  ref
) {
  const [zoom, setZoom] = useState(60);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Internal expand/collapse state if not provided externally
  // Default: expand all namespaces so namespace-scoped resources are visible
  const [internalExpandedResources, setInternalExpandedResources] = useState<Set<string>>(new Set());
  const hasInitializedExpansion = useRef(false);
  
  // Auto-expand all namespaces on first render (only for cluster topology)
  useEffect(() => {
    if (hasInitializedExpansion.current || externalExpandedResources !== undefined) return;
    const isClusterTopology = nodes.some(n => n.type === 'cluster' || n.kind === 'Cluster');
    if (isClusterTopology) {
      const defaultExpanded = new Set<string>();
      nodes.forEach(node => {
        if (node.type === 'namespace') {
          defaultExpanded.add(node.id);
        }
      });
      if (defaultExpanded.size > 0) {
        setInternalExpandedResources(defaultExpanded);
        hasInitializedExpansion.current = true;
      }
    }
  }, [nodes, externalExpandedResources]);
  
  const expandedResources = externalExpandedResources ?? internalExpandedResources;
  
  const toggleExpansion = useCallback((resourceId: string) => {
    if (onToggleExpansion) {
      onToggleExpansion(resourceId);
    } else {
      setInternalExpandedResources(prev => {
        const next = new Set(prev);
        if (next.has(resourceId)) {
          next.delete(resourceId);
        } else {
          next.add(resourceId);
        }
        return next;
      });
    }
  }, [onToggleExpansion]);
  const [useForceLayout, setUseForceLayout] = useState(false);
  const [dragOffsets, setDragOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startDx: number;
    startDy: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  // Filter nodes based on expand/collapse state - ONLY for cluster topology
  // For node/pod/deployment topologies, show all nodes (no expand/collapse filtering)
  const visibleNodes = useMemo(() => {
    // Check if this is cluster topology (has cluster node)
    const isClusterTopology = nodes.some(n => n.type === 'cluster' || n.kind === 'Cluster');
    
    // For non-cluster topologies (node, pod, deployment), show all nodes
    if (!isClusterTopology) {
      return nodes;
    }
    
    // Only apply expand/collapse filtering for cluster topology
    return nodes.filter(node => {
      // Always show cluster node and cluster-scoped resources
      if (node.type === 'cluster' || node.kind === 'Cluster') return true;
      if (['node', 'storageclass', 'pv', 'ingressclass'].includes(node.type)) return true;
      
      // Show namespaces only if not filtering by a specific namespace
      // (Namespace filtering is handled at the data level, so if we see a namespace node here,
      // it's either the selected one or we're in cluster view)
      if (node.type === 'namespace') return true;
      
      // Namespace-scoped resources: only show if namespace is expanded
      if (node.namespace && ['deployment', 'statefulset', 'daemonset', 'job', 'cronjob', 'service', 'configmap', 'secret', 'persistentvolumeclaim', 'ingress', 'serviceaccount'].includes(node.type)) {
        const nsId = `Namespace/${node.namespace}`;
        return expandedResources.has(nsId);
      }
      
      // ReplicaSets: only show if parent deployment is expanded
      if (node.type === 'replicaset' && node.namespace) {
        // Find parent deployment from edges
        const deploymentEdge = edges.find(e => e.to === node.id && e.label?.includes('owns'));
        if (deploymentEdge) {
          return expandedResources.has(deploymentEdge.from);
        }
        // If no deployment edge, show if namespace is expanded
        const nsId = `Namespace/${node.namespace}`;
        return expandedResources.has(nsId);
      }
      
      // Pods: only show if parent replicaset/statefulset/daemonset/job is expanded
      if (node.type === 'pod' && node.namespace) {
        // Find parent from edges
        const parentEdge = edges.find(e => e.to === node.id && (e.label?.includes('owns') || e.label?.includes('manages')));
        if (parentEdge) {
          return expandedResources.has(parentEdge.from);
        }
        // If no parent edge, show if namespace is expanded
        const nsId = `Namespace/${node.namespace}`;
        return expandedResources.has(nsId);
      }
      
      return true;
    });
  }, [nodes, edges, expandedResources]);

  // Edges filtering based on visible nodes
  const visibleEdges = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map(n => n.id));
    return edges.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));
  }, [edges, visibleNodes]);
  const hasSetInitialZoomRef = useRef(false);

  const exportAsPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const vb = svg.viewBox.baseVal;
    const w = vb.width || 800;
    const h = vb.height || 600;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.style.transform = '';
    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (pngBlob) => {
          if (!pngBlob) return;
          downloadBlob(pngBlob, `topology-${Date.now()}.png`);
        },
        'image/png',
        1
      );
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, []);

  useImperativeHandle(ref, () => ({ exportAsPng }), [exportAsPng]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (typeof w === 'number' && w > 0) setContainerWidth(w);
      }
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setCanvasSize({ width, height });
      }
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) setCanvasSize({ width: rect.width, height: rect.height });
    return () => ro.disconnect();
  }, []);

  const level1Count = useMemo(
    () => visibleNodes.filter((n) => n.type === 'node').length,
    [visibleNodes]
  );
  const effectiveLayout = useMemo(() => {
    if (variant === 'card') {
      const dynamic = getCardLayoutOptions(level1Count);
      return { ...dynamic, ...layoutOptions };
    }
    const base = { ...DEFAULT_LAYOUT, ...layoutOptions };
    if (containerWidth != null && containerWidth > 0) {
      return { ...base, canvasWidth: Math.max(400, containerWidth - 32) };
    }
    return base;
  }, [variant, level1Count, layoutOptions, containerWidth]);
  const positions = useMemo(
    () => calculateCleanLayout(visibleNodes, visibleEdges, effectiveLayout),
    [visibleNodes, visibleEdges, effectiveLayout]
  );
  const effectivePositions = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    positions.forEach((p, id) => {
      const off = dragOffsets[id];
      m.set(id, off ? { x: p.x + off.dx, y: p.y + off.dy } : p);
    });
    return m;
  }, [positions, dragOffsets]);
  const cardCanvasHeight = (effectiveLayout as { canvasHeight?: number }).canvasHeight;

  useEffect(() => {
    if (!dragState) return;
    const svg = svgRef.current;
    if (!svg) return;
    didDragRef.current = false;
    const onPointerMove = (e: PointerEvent) => {
      const startSvg = clientToSvg(svg, dragState.startClientX, dragState.startClientY);
      const curSvg = clientToSvg(svg, e.clientX, e.clientY);
      const deltaX = curSvg.x - startSvg.x;
      const deltaY = curSvg.y - startSvg.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) didDragRef.current = true;
      setDragOffsets((prev) => ({
        ...prev,
        [dragState.nodeId]: {
          dx: dragState.startDx + deltaX,
          dy: dragState.startDy + deltaY,
        },
      }));
    };
    const onPointerUp = () => setDragState(null);
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
    };
  }, [dragState]);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 20, 200)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 20, 50)), []);
  const handleReset = useCallback(() => setZoom(60), []);

  const handleExportGraphJson = useCallback(() => {
    const payload = { nodes: visibleNodes, edges: visibleEdges };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `topology-graph-${Date.now()}.json`);
  }, [visibleNodes, visibleEdges]);

  const handleExportGraphCsv = useCallback(() => {
    const nodeRows = ['id,name,type,status', ...visibleNodes.map((n) => [n.id, n.name, n.type, n.status ?? ''].map(escapeCsvCell).join(','))];
    const edgeRows = ['from,to,label', ...visibleEdges.map((e) => [e.from, e.to, e.label ?? ''].map(escapeCsvCell).join(','))];
    const csv = nodeRows.join('\n') + '\n\n' + edgeRows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `topology-graph-${Date.now()}.csv`);
  }, [visibleNodes, visibleEdges]);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    if (didDragRef.current) return;
    setSelectedNode(node.id);
    
    // Handle expand/collapse ONLY for cluster topology
    const isClusterTopology = nodes.some(n => n.type === 'cluster' || n.kind === 'Cluster');
    if (isClusterTopology) {
      const expandableTypes = ['namespace', 'deployment', 'replicaset', 'statefulset', 'daemonset', 'job', 'node'];
      if (expandableTypes.includes(node.type)) {
        toggleExpansion(node.id);
      }
    }
    
    onNodeClick?.(node);
  }, [onNodeClick, toggleExpansion, nodes]);

  // If Interactive topology is enabled, render D3 component with traffic animation
  if (useForceLayout) {
    const edgesWithTraffic = edges.map((e) => ({ ...e, traffic: e.traffic ?? 40 }));
    return (
      <div className={cn('relative', className)}>
        <D3ForceTopology
          nodes={nodes}
          edges={edgesWithTraffic}
          onNodeClick={onNodeClick}
          className={className}
          showTraffic={true}
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

  const canvasWidth = effectiveLayout.canvasWidth ?? DEFAULT_LAYOUT.canvasWidth;
  const nodeRadius = effectiveLayout.nodeRadius ?? DEFAULT_LAYOUT.nodeRadius;
  // Calculate max Y position including node radius for proper height calculation
  const maxY = Math.max(...Array.from(positions.values()).map(p => p.y + nodeRadius), 100);
  const viewBoxHeight =
    variant === 'card' && cardCanvasHeight != null
      ? cardCanvasHeight
      : Math.max(maxY + VIEWBOX_PADDING * 2, 400); // Ensure enough padding for scrolling

  useEffect(() => {
    if (variant !== 'default' || !canvasSize || nodes.length === 0 || hasSetInitialZoomRef.current) return;
    const padding = 48;
    // Calculate zoom to fit content, but don't zoom out too much (min 40%)
    const scaleX = (canvasSize.width - padding) / canvasWidth;
    const scaleY = (canvasSize.height - padding) / viewBoxHeight;
    const scale = Math.min(1, scaleX, scaleY);
    if (scale <= 0) return;
    // Set initial zoom to fit, but allow user to zoom in/out for scrolling
    const fitZoom = Math.round(Math.max(40, Math.min(100, scale * 100)));
    setZoom(fitZoom);
    hasSetInitialZoomRef.current = true;
  }, [variant, canvasSize, canvasWidth, viewBoxHeight, nodes.length]);

  return (
    <div
      ref={containerRef}
      className={cn(
        variant === 'card' 
          ? 'overflow-hidden flex flex-col min-h-0' 
          : 'overflow-hidden rounded-xl border border-border bg-card flex flex-col min-h-0', 
        className
      )}
    >
      {/* Toolbar - hidden in card variant */}
      {variant !== 'card' && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Network className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <h3 className="font-medium text-sm">Resource Topology</h3>
              {(() => {
                const center = nodes.find(n => n.isCurrent);
                if (!center) return null;
                const typeLabel = resourceLabels[center.type] ?? center.type;
                return (
                  <p className="text-xs text-muted-foreground" title="Current context — center of the graph">
                    Viewing: <span className="font-medium text-foreground">{typeLabel}</span>
                    {center.name && <span className="font-mono ml-1">{center.name}</span>}
                  </p>
                );
              })()}
            </div>

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
                    Interactive topology
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Switch to interactive force-directed layout with traffic animation</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="flex items-center gap-1.5">
            {!hideBuiltInExport && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={handleExportGraphJson}>
                      <FileJson className="h-3.5 w-3.5" />
                      JSON
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export graph data as JSON</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={handleExportGraphCsv}>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      CSV
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export graph data as CSV</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={exportAsPng}>
                      <Image className="h-3.5 w-3.5" />
                      PNG
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export graph as PNG image</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {!hideBuiltInExport && <div className="w-px h-4 bg-border mx-2" />}

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
      )}

      {/* Canvas */}
      <div
        ref={canvasWrapperRef}
        className={cn(
          'relative',
          variant === 'card'
            ? 'flex-1 min-h-0 flex items-center justify-center bg-transparent'
            : 'flex-1 min-h-0 min-w-0 overflow-auto bg-gradient-to-b from-background to-muted/20 scrollbar-thin scrollbar-thumb-border/60'
        )}
      >
        {variant !== 'card' && (
          <Badge
            variant="secondary"
            className="absolute top-4 right-4 z-10 font-medium text-xs"
          >
            {nodes.length} Resources
          </Badge>
        )}

        {/* SVG with zoom - wrapper has scaled dimensions for proper scrolling */}
        <div
          style={{
            width: variant === 'card' ? '100%' : `${(canvasWidth * zoom) / 100}px`,
            height: variant === 'card' ? '100%' : `${(viewBoxHeight * zoom) / 100}px`,
            position: 'relative',
          }}
        >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${canvasWidth} ${viewBoxHeight}`}
          className={variant === 'card' ? 'w-full h-full max-h-full object-contain' : 'w-full'}
          preserveAspectRatio={variant === 'card' ? 'xMidYMid meet' : 'xMidYMin meet'}
          style={{
            width: `${(canvasWidth * zoom) / 100}px`,
            height: `${(viewBoxHeight * zoom) / 100}px`,
            display: 'block',
          }}
        >
          {/* Edges with relationship labels */}
          {edges.map((edge, i) => {
            const fromPos = effectivePositions.get(edge.from);
            const toPos = effectivePositions.get(edge.to);
            if (!fromPos || !toPos) return null;
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            const fromR = (variant === 'card' && fromNode?.type === 'cluster') ? nodeRadius + 10 : nodeRadius;
            const toR = (variant === 'card' && toNode?.type === 'cluster') ? nodeRadius + 10 : nodeRadius;

            const isHovered = hoveredNode === edge.from || hoveredNode === edge.to;

            // Calculate edge points from circle borders
            const dx = toPos.x - fromPos.x;
            const dy = toPos.y - fromPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const nx = distance > 0 ? dx / distance : 0;
            const ny = distance > 0 ? dy / distance : 0;

            const x1 = fromPos.x + nx * fromR;
            const y1 = fromPos.y + ny * fromR;
            const x2 = toPos.x - nx * toR;
            const y2 = toPos.y - ny * toR;

            // Midpoint for label
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;

            return (
              <g key={`edge-${i}`}>
                {/* Edge line - improved visibility */}
                <motion.line
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isHovered ? 0.6 : 0.4 }}
                  transition={{ delay: i * 0.03, duration: 0.4 }}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  // Use dashed only for specific relationship types (references, configures)
                  strokeDasharray={
                    edge.label?.toLowerCase().includes('references') ||
                      edge.label?.toLowerCase().includes('configures')
                      ? "4,4"
                      : undefined
                  }
                />

                {/* Relationship label - always visible but subtle */}
                {edge.label && (
                  <motion.g
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 0.95 : 0.6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <rect
                      x={midX - 25}
                      y={midY - 9}
                      width={50}
                      height={18}
                      fill="hsl(var(--background))"
                      fillOpacity={isHovered ? 0.95 : 0.85}
                      rx={4}
                      stroke="hsl(var(--border))"
                      strokeWidth={isHovered ? 1 : 0.5}
                    />
                    <text
                      x={midX}
                      y={midY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight={isHovered ? "600" : "500"}
                      fill="hsl(var(--foreground))"
                      className="select-none"
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
            const pos = effectivePositions.get(node.id);
            if (!pos) return null;

            const style = resourceStyles[node.type];
            const IconComponent = resourceIcons[node.type];
            const label = resourceLabels[node.type];
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode === node.id || node.isCurrent;
            const isDragging = dragState?.nodeId === node.id;
            // In card variant, make cluster (central node) larger so cluster name is prominent
            // Cluster node gets larger radius for visual prominence
            const r = node.type === 'cluster'
              ? (variant === 'card' ? nodeRadius + 10 : 50)
              : nodeRadius;

            return (
              <motion.g
                key={node.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 25 }}
                style={{
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => handleNodeClick(node)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragState({
                    nodeId: node.id,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    startDx: dragOffsets[node.id]?.dx ?? 0,
                    startDy: dragOffsets[node.id]?.dy ?? 0,
                  });
                }}
              >
                {/* Cluster node glow effect */}
                {node.type === 'cluster' && (
                  <>
                    <motion.circle
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.2 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 12}
                      fill={style.bg}
                      style={{ filter: 'blur(8px)' }}
                    />
                    <motion.circle
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 0.3 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      cx={pos.x}
                      cy={pos.y}
                      r={r + 6}
                      fill={style.bg}
                    />
                  </>
                )}

                {/* Outer ring for current/selected */}
                {isSelected && (
                  <motion.circle
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 0.15 }}
                    cx={pos.x}
                    cy={pos.y}
                    r={r + 8}
                    fill={style.bg}
                  />
                )}

                {/* Main circle - filled with vibrant color */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isHovered ? r + 2 : r}
                  fill={style.bg}
                  className="transition-all duration-200"
                  stroke={node.type === 'cluster' ? 'hsl(var(--background))' : 'transparent'}
                  strokeWidth={node.type === 'cluster' ? 4 : 0}
                  style={{
                    filter: node.type === 'cluster'
                      ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))'
                      : (isHovered ? 'brightness(1.1)' : 'none'),
                  }}
                />

                {/* Status indicator dot */}
                {node.status && (
                  <circle
                    cx={pos.x + r * 0.6}
                    cy={pos.y - r * 0.6}
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
                  x={pos.x - (variant === 'card' && node.type !== 'cluster' ? 8 : (variant === 'card' ? 10 : 11))}
                  y={pos.y - (variant === 'card' && node.type !== 'cluster' ? 8 : (variant === 'card' ? 10 : 11))}
                  width={variant === 'card' && node.type === 'cluster' ? 20 : (variant === 'card' ? 16 : 22)}
                  height={variant === 'card' && node.type === 'cluster' ? 20 : (variant === 'card' ? 16 : 22)}
                >
                  <div className="w-full h-full flex items-center justify-center">
                    <IconComponent className={variant === 'card' && node.type === 'cluster' ? 'h-5 w-5 text-white' : (variant === 'card' ? 'h-4 w-4 text-white' : 'h-5 w-5 text-white')} />
                  </div>
                </foreignObject>

                {/* Resource type label and name — cluster in card: generous gap so "Cluster" and name never overlap */}
                {(() => {
                  const isClusterCard = variant === 'card' && node.type === 'cluster';
                  const typeLabelY = pos.y + r + (isClusterCard ? 18 : (variant === 'card' ? 10 : 16));
                  const nameLabelY = pos.y + r + (isClusterCard ? 50 : (variant === 'card' ? 24 : 30));
                  return (
                    <>
                      <text
                        x={pos.x}
                        y={typeLabelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={isClusterCard ? 12 : (variant === 'card' ? 9 : 11)}
                        fontWeight="600"
                        fill="hsl(var(--foreground))"
                        className="select-none"
                      >
                        {label}
                      </text>
                      <text
                        x={pos.x}
                        y={nameLabelY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={isClusterCard ? 11 : (variant === 'card' ? 9 : 9)}
                        fill="hsl(var(--muted-foreground))"
                        className="select-none"
                      >
                        {node.name.length > (variant === 'card' ? 22 : 20) ? node.name.slice(0, (variant === 'card' ? 19 : 17)) + '…' : node.name}
                      </text>
                    </>
                  );
                })()}
              </motion.g>
            );
          })}
        </svg>
        </div>
      </div>
    </div>
  );
});
