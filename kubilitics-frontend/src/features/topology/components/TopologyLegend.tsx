/**
 * Topology Legend Component
 * Shows node and edge type explanations
 */
import { type FC } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const nodeTypes = [
  { kind: 'Pod', color: '#22c55e', shape: 'ellipse', label: 'Pod' },
  { kind: 'Deployment', color: '#6366f1', shape: 'round-rectangle', label: 'Deployment' },
  { kind: 'StatefulSet', color: '#8b5cf6', shape: 'round-rectangle', label: 'StatefulSet' },
  { kind: 'DaemonSet', color: '#3b82f6', shape: 'round-rectangle', label: 'DaemonSet' },
  { kind: 'Service', color: '#8b5cf6', shape: 'diamond', label: 'Service' },
  { kind: 'Ingress', color: '#eab308', shape: 'star', label: 'Ingress' },
  { kind: 'ConfigMap', color: '#14b8a6', shape: 'rectangle', label: 'ConfigMap' },
  { kind: 'Secret', color: '#f97316', shape: 'rectangle', label: 'Secret' },
  { kind: 'PVC', color: '#64748b', shape: 'barrel', label: 'Volume' },
  { kind: 'Node', color: '#0ea5e9', shape: 'round-rectangle', label: 'Node' },
  { kind: 'Namespace', color: '#a855f7', shape: 'dashed', label: 'Namespace' },
];

const edgeTypes = [
  { type: 'owns', style: 'solid', color: '#6b7280', label: 'Owner Reference' },
  { type: 'selects', style: 'dashed', color: '#9ca3af', label: 'Label Selector' },
  { type: 'exposes', style: 'solid', color: '#06b6d4', label: 'Exposes' },
  { type: 'mounts', style: 'dotted', color: '#64748b', label: 'Mounts' },
  { type: 'configures', style: 'dashed', color: '#14b8a6', label: 'Configures' },
];

const healthStatuses = [
  { status: 'healthy', color: '#22c55e', label: 'Healthy' },
  { status: 'warning', color: '#f59e0b', label: 'Warning' },
  { status: 'critical', color: '#f43f5e', label: 'Critical' },
  { status: 'unknown', color: '#6b7280', label: 'Unknown' },
];

interface TopologyLegendProps {
  className?: string;
  collapsed?: boolean;
}

export const TopologyLegend: FC<TopologyLegendProps> = ({ className, collapsed = false }) => {
  return (
    <Collapsible defaultOpen={!collapsed}>
      <div className={cn(
        'bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg overflow-hidden',
        className
      )}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium">Legend</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-3 pt-0 space-y-4">
            {/* Node Types */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Resources</h4>
              <div className="grid grid-cols-2 gap-1.5">
                {nodeTypes.map((type) => (
                  <div key={type.kind} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-3 h-3 flex-shrink-0',
                        type.shape === 'ellipse' && 'rounded-full',
                        type.shape === 'round-rectangle' && 'rounded-sm',
                        type.shape === 'rectangle' && 'rounded-none',
                        type.shape === 'diamond' && 'rotate-45 scale-75',
                        type.shape === 'star' && 'clip-path-star',
                        type.shape === 'barrel' && 'rounded-md',
                        type.shape === 'dashed' && 'border-2 border-dashed bg-transparent'
                      )}
                      style={{ 
                        backgroundColor: type.shape !== 'dashed' ? type.color : 'transparent',
                        borderColor: type.shape === 'dashed' ? type.color : undefined,
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Status */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Status</h4>
              <div className="flex flex-wrap gap-3">
                {healthStatuses.map((status) => (
                  <div key={status.status} className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-xs text-muted-foreground">{status.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Edge Types */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Relationships</h4>
              <div className="space-y-1">
                {edgeTypes.map((edge) => (
                  <div key={edge.type} className="flex items-center gap-2">
                    <div className="w-8 h-0.5 flex-shrink-0 relative">
                      <div
                        className={cn(
                          'absolute inset-0',
                          edge.style === 'solid' && 'border-t-2',
                          edge.style === 'dashed' && 'border-t-2 border-dashed',
                          edge.style === 'dotted' && 'border-t-2 border-dotted'
                        )}
                        style={{ borderColor: edge.color }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{edge.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="pt-2 border-t">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Shortcuts</h4>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">F</kbd> Fit to screen</div>
                <div><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">R</kbd> Reset view</div>
                <div><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Space</kbd> Pause</div>
                <div><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> Deselect</div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default TopologyLegend;
