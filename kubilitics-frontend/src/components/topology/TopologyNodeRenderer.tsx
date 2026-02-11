/**
 * Enhanced Topology Node Renderer
 * Custom node rendering with metrics, health indicators, and status badges
 * Note: This is a utility module for computing visual properties.
 * Actual rendering is handled by D3ForceTopology component.
 */
import type { TopologyNode } from '@/components/resources/D3ForceTopology';
import type { MetricsData } from '@/utils/topologyDataTransformer';
import { computeNodeVisualProperties } from '@/utils/topologyDataTransformer';

/**
 * Get visual properties for a node based on its metrics and status
 */
export function getNodeVisualProperties(
  node: TopologyNode & { _metrics?: MetricsData; _original?: any },
  baseRadius: number
): {
  radius: number;
  opacity: number;
  borderWidth: number;
  color: string;
  borderColor: string;
} {
  // Special handling for cluster node - always use larger radius
  if (node.type === 'cluster') {
    baseRadius = 50;
  }
  
  const visualProps = computeNodeVisualProperties(node, baseRadius);
  
  // Get base color from resource type
  const resourceColors: Record<string, string> = {
    pod: 'hsl(199, 89%, 48%)',
    deployment: 'hsl(25, 95%, 53%)',
    replicaset: 'hsl(262, 83%, 58%)',
    service: 'hsl(142, 76%, 36%)',
    node: 'hsl(0, 72%, 51%)',
    namespace: 'hsl(280, 87%, 67%)',
    configmap: 'hsl(47, 96%, 53%)',
    secret: 'hsl(340, 82%, 52%)',
    ingress: 'hsl(174, 72%, 40%)',
    statefulset: 'hsl(220, 70%, 50%)',
    daemonset: 'hsl(280, 70%, 50%)',
    job: 'hsl(45, 93%, 47%)',
    cronjob: 'hsl(36, 100%, 50%)',
    pv: 'hsl(210, 40%, 50%)',
    pvc: 'hsl(210, 60%, 45%)',
    storageclass: 'hsl(250, 50%, 55%)',
    cluster: 'hsl(217, 91%, 60%)',
  };

  const baseColor = resourceColors[node.type] || 'hsl(0, 0%, 50%)';
  
  // Determine border color based on health status
  let borderColor = baseColor;
  if (node.status === 'error') {
    borderColor = 'hsl(0, 72%, 51%)'; // Red
  } else if (node.status === 'warning') {
    borderColor = 'hsl(45, 93%, 47%)'; // Yellow
  } else if (node.status === 'healthy') {
    borderColor = 'hsl(142, 76%, 36%)'; // Green
  }

  return {
    ...visualProps,
    color: baseColor,
    borderColor,
  };
}

/**
 * Get health indicator badge properties
 */
export function getHealthBadgeProperties(node: TopologyNode): {
  color: string;
  label: string;
  severity: 'success' | 'warning' | 'error' | 'info';
} {
  switch (node.status) {
    case 'healthy':
      return { color: '#22c55e', label: 'Healthy', severity: 'success' };
    case 'warning':
      return { color: '#f59e0b', label: 'Warning', severity: 'warning' };
    case 'error':
      return { color: '#ef4444', label: 'Error', severity: 'error' };
    default:
      return { color: '#6b7280', label: 'Pending', severity: 'info' };
  }
}

/**
 * Get replica status badge text
 */
export function getReplicaBadgeText(node: TopologyNode & { _original?: any }): string | null {
  const original = node._original;
  if (!original?.computed?.replicas) return null;
  
  const { desired, ready } = original.computed.replicas;
  return `${ready}/${desired}`;
}
