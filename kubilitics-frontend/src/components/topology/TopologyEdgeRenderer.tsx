/**
 * Enhanced Topology Edge Renderer
 * Custom edge rendering with traffic visualization and relationship colors
 * Note: This is a utility module for computing visual properties.
 * Actual rendering is handled by D3ForceTopology component.
 */
import type { TopologyEdge } from '@/components/resources/D3ForceTopology';

/**
 * Relationship type colors
 */
const RELATIONSHIP_COLORS: Record<string, string> = {
  'owns': 'hsl(262, 83%, 58%)', // Purple
  'selects': 'hsl(142, 76%, 36%)', // Green
  'schedules': 'hsl(0, 72%, 51%)', // Red
  'routes': 'hsl(174, 72%, 40%)', // Teal
  'configures': 'hsl(47, 96%, 53%)', // Yellow
  'mounts': 'hsl(210, 60%, 45%)', // Blue
  'stores': 'hsl(250, 50%, 55%)', // Purple
  'contains': 'hsl(280, 87%, 67%)', // Purple
  'references': 'hsl(200, 70%, 50%)', // Blue
};

/**
 * Get visual properties for an edge based on relationship type and traffic
 */
export function getEdgeVisualProperties(edge: TopologyEdge): {
  strokeWidth: number;
  strokeColor: string;
  opacity: number;
  dashArray?: string;
} {
  const baseWidth = 2;
  const relationshipType = edge.label?.toLowerCase() || '';
  
  // Determine stroke width based on traffic
  let strokeWidth = baseWidth;
  if (edge.traffic) {
    // Scale width based on traffic (0-100 -> 1-5px)
    strokeWidth = baseWidth + (edge.traffic / 100) * 3;
  }

  // Determine color based on relationship type
  let strokeColor = 'hsl(0, 0%, 60%)'; // Default gray
  for (const [type, color] of Object.entries(RELATIONSHIP_COLORS)) {
    if (relationshipType.includes(type)) {
      strokeColor = color;
      break;
    }
  }

  // Determine opacity based on traffic
  let opacity = 0.6;
  if (edge.traffic) {
    opacity = 0.4 + (edge.traffic / 100) * 0.6; // 0.4 to 1.0
  }

  // Use dashed line for certain relationship types
  let dashArray: string | undefined;
  if (relationshipType.includes('references') || relationshipType.includes('configures')) {
    dashArray = '5,5';
  }

  return {
    strokeWidth,
    strokeColor,
    opacity,
    dashArray,
  };
}

/**
 * Get edge label properties
 */
export function getEdgeLabelProperties(edge: TopologyEdge): {
  label: string;
  fontSize: number;
  fontWeight: string;
} {
  const label = edge.label || 'connected';
  const fontSize = edge.traffic && edge.traffic > 50 ? 11 : 10;
  const fontWeight = edge.traffic && edge.traffic > 80 ? 'bold' : 'normal';

  return {
    label,
    fontSize,
    fontWeight,
  };
}
