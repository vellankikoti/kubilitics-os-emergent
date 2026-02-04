/**
 * Topology Controls Component
 * Zoom, fit, layout, and export controls
 */
import { type FC } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  RotateCcw, 
  Download, 
  Pause, 
  Play,
  Grid3X3,
  GitBranch,
  Eye,
  EyeOff,
  Tag,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTopologyStore } from '@/stores/topologyStore';
import { cn } from '@/lib/utils';

interface TopologyControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
  onExport: (format: 'png' | 'svg' | 'pdf') => void;
  className?: string;
}

export const TopologyControls: FC<TopologyControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  onExport,
  className,
}) => {
  const {
    isPaused,
    togglePaused,
    showLabels,
    setShowLabels,
    showNamespaces,
    setShowNamespaces,
    layoutMode,
    setLayoutMode,
    zoomLevel,
  } = useTopologyStore();

  return (
    <div className={cn(
      'flex items-center gap-1 p-2 bg-background/95 backdrop-blur-sm border rounded-lg shadow-lg',
      className
    )}>
      {/* Zoom controls */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom Out</TooltipContent>
      </Tooltip>
      
      <span className="text-xs text-muted-foreground w-12 text-center">
        {Math.round(zoomLevel * 100)}%
      </span>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Zoom In</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Fit & Reset */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFit}>
            <Maximize className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fit to Screen (F)</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reset View (R)</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Pause/Play */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={isPaused ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-8 w-8" 
            onClick={togglePaused}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPaused ? 'Resume Updates (Space)' : 'Pause Updates (Space)'}</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Layout mode */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant={layoutMode === 'dagre' ? 'secondary' : 'ghost'} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setLayoutMode(layoutMode === 'dagre' ? 'cola' : 'dagre')}
          >
            {layoutMode === 'dagre' ? <Grid3X3 className="h-4 w-4" /> : <GitBranch className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {layoutMode === 'dagre' ? 'Hierarchical Layout' : 'Force-Directed Layout'}
        </TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Display toggles */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle 
            size="sm" 
            pressed={showLabels} 
            onPressedChange={setShowLabels}
            className="h-8 w-8 p-0"
          >
            <Tag className="h-4 w-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>Toggle Labels</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Toggle 
            size="sm" 
            pressed={showNamespaces} 
            onPressedChange={setShowNamespaces}
            className="h-8 w-8 p-0"
          >
            <Layers className="h-4 w-4" />
          </Toggle>
        </TooltipTrigger>
        <TooltipContent>Toggle Namespace Groups</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Export */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport('png')}>
            Export as PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('svg')}>
            Export as SVG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default TopologyControls;
