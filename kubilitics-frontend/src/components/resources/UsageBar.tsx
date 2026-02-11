import { useId } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type UsageBarKind = 'cpu' | 'memory';

/** Parse CPU string (e.g. "200m", "1") to millicores number. */
export function parseCpu(value: string): number | null {
  if (!value || value === '-') return null;
  const s = value.trim();
  if (s.endsWith('m')) {
    const n = parseFloat(s.slice(0, -1));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * 1000 : null;
}

/** Parse memory string (e.g. "256Mi", "1Gi") to Mi. */
export function parseMemory(value: string): number | null {
  if (!value || value === '-') return null;
  const s = value.trim();
  if (s.endsWith('Ki')) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? n / 1024 : null;
  }
  if (s.endsWith('Mi')) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? n : null;
  }
  if (s.endsWith('Gi')) {
    const n = parseFloat(s.slice(0, -2));
    return Number.isFinite(n) ? n * 1024 : null;
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Format CPU for display in cores with full precision (no rounding).
 * Reference: "0", "0.01", "0.015" — small values never rounded to zero.
 */
function formatCpuDisplay(value: string): string {
  if (!value || value.trim() === '-') return '-';
  const millicores = parseCpu(value);
  if (millicores === null) return value;
  if (millicores === 0) return '0';
  const cores = millicores / 1000;
  const fixed = cores >= 1 ? cores.toFixed(2) : cores.toFixed(3);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/**
 * Format memory for display with 3 decimal precision (no rounding).
 * Reference: "19.746 Mi", "18.004 Mi".
 */
function formatMemoryDisplay(value: string): string {
  if (!value || value.trim() === '-') return '-';
  const s = value.trim();
  let num: number;
  let unit: string;
  if (s.endsWith('Ki')) {
    num = parseFloat(s.slice(0, -2));
    unit = 'Ki';
  } else if (s.endsWith('Mi')) {
    num = parseFloat(s.slice(0, -2));
    unit = 'Mi';
  } else if (s.endsWith('Gi')) {
    num = parseFloat(s.slice(0, -2));
    unit = 'Gi';
  } else {
    const mi = parseMemory(value);
    if (mi === null) return value;
    return `${mi.toFixed(3)} Mi`;
  }
  if (!Number.isFinite(num)) return value;
  return `${num.toFixed(3)} ${unit}`;
}

/** CPU in cores with 2–3 decimals (e.g. 0.12, 0.003). Never round non-zero usage to zero. */
function formatCpuCompact(value: string): string {
  if (!value || value.trim() === '-') return '-';
  const millicores = parseCpu(value);
  if (millicores === null) return value;
  if (millicores === 0) return '0';
  const cores = millicores / 1000;
  const fixed = cores >= 1 ? cores.toFixed(2) : cores.toFixed(3);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/** Memory with 2–3 decimals (e.g. 15.55 Mi, 0.36 Mi). Never round non-zero usage to zero. */
function formatMemoryCompact(value: string): string {
  if (!value || value.trim() === '-') return '-';
  const mi = parseMemory(value);
  if (mi === null) return value;
  if (mi === 0) return '0 Mi';
  if (mi >= 1024) {
    const gi = mi / 1024;
    const fixed = gi >= 1 ? gi.toFixed(2) : gi.toFixed(3);
    return `${fixed.replace(/\.?0+$/, '') || '0'} Gi`;
  }
  const fixed = mi >= 1 ? mi.toFixed(2) : mi.toFixed(3);
  return `${fixed.replace(/\.?0+$/, '') || '0'} Mi`;
}

function formatUsageDisplay(value: string, kind: UsageBarKind, displayFormat: 'full' | 'compact' = 'full'): string {
  if (!value || value.trim() === '-') return '-';
  if (displayFormat === 'compact') return kind === 'cpu' ? formatCpuCompact(value) : formatMemoryCompact(value);
  return kind === 'cpu' ? formatCpuDisplay(value) : formatMemoryDisplay(value);
}

/** Fixed scale: 1 core and 2 Gi so bar length is consistent across the app. */
const CPU_DEFAULT_MAX = 1000; // millicores (1 core = full bar)
const MEMORY_DEFAULT_MAX = 1024; // Mi (1 Gi = full bar)

/** Below this ratio we show no fill (only grey track). */
const MIN_RATIO = 0.005;
/** Minimum fill size in px so small non-zero values are visible. */
const MIN_FILL_PX = 4;

export type UsageBarVariant = 'bar' | 'sparkline';

export interface UsageBarProps {
  /** Display value e.g. "200m", "256Mi", or "-" when no metrics. */
  value: string;
  kind: UsageBarKind;
  /** bar = flat solid fill; sparkline when dataPoints provided. */
  variant?: UsageBarVariant;
  /** Optional max for bar length (cpu: millicores, memory: Mi). */
  max?: number;
  /** Bar width in pixels. */
  width?: number;
  /** Time-series for sparkline (current value repeated or real history). When provided with variant=sparkline, draws line + dot (CPU) or filled area + dot (Memory). */
  dataPoints?: number[];
  /** 'compact' = CPU as "45m", Memory as "128 Mi"; 'full' = CPU as "0.045" cores, memory with decimals. */
  displayFormat?: 'full' | 'compact';
  className?: string;
}

/** Match reference: CPU = blue line + dot, Memory = green filled area + dot. */
const CPU_FILL_COLOR = 'hsl(217, 91%, 55%)';
const MEMORY_FILL_COLOR = 'hsl(142, 76%, 36%)';

export function UsageBar({
  value,
  kind,
  variant = 'bar',
  max = kind === 'cpu' ? CPU_DEFAULT_MAX : MEMORY_DEFAULT_MAX,
  width = 60,
  dataPoints,
  displayFormat = 'full',
  className,
}: UsageBarProps) {
  const uniqueId = useId();
  const valueStr = typeof value === 'string' ? value : '-';
  const numeric = kind === 'cpu' ? parseCpu(valueStr) : parseMemory(valueStr);
  const hasValue = numeric !== null && numeric >= 0;
  const displayValue = formatUsageDisplay(valueStr, kind, displayFormat);
  const effectiveMax = max ?? (kind === 'cpu' ? CPU_DEFAULT_MAX : MEMORY_DEFAULT_MAX);

  const isCpu = kind === 'cpu';
  const fillColor = isCpu ? CPU_FILL_COLOR : MEMORY_FILL_COLOR;
  const sparklineGradientId = `usage-fill-${isCpu ? 'cpu' : 'memory'}-${uniqueId.replace(/:/g, '-')}`;

  const tooltipContent = hasValue ? (
    <>
      <p className="font-medium">{isCpu ? 'CPU (cores)' : 'Memory'}</p>
      <p className="text-xs text-muted-foreground">
        From Metrics Server: {displayValue}. Requires metrics-server in cluster.
      </p>
    </>
  ) : (
    <>
      <p className="font-medium">{isCpu ? 'CPU' : 'Memory'} usage</p>
      <p className="text-xs text-muted-foreground">
        No metrics available. Install metrics-server for live usage.
      </p>
    </>
  );

  const barW = width;
  const barH = 16;
  const ratio = hasValue && effectiveMax > 0 ? Math.min(numeric! / effectiveMax, 1) : 0;
  const showFill = hasValue && ratio >= MIN_RATIO;
  const effectiveRatio = showFill ? ratio : 0;
  const fillWidthRaw = showFill ? Math.max(effectiveRatio * barW, MIN_FILL_PX) : 0;
  const fillHeightRaw = showFill ? Math.max(effectiveRatio * barH, MIN_FILL_PX) : 0;
  // Integer px for sharp, flat rect (no sub-pixel jagged edges)
  const fillWidth = Math.min(barW, Math.round(fillWidthRaw));
  const fillHeight = Math.min(barH, Math.round(fillHeightRaw));
  const fillY = Math.max(0, barH - fillHeight);

  const useRealSparkline = variant === 'sparkline' && dataPoints != null && dataPoints.length > 1;
  const points = useRealSparkline
    ? (() => {
        const maxVal = Math.max(...dataPoints, 1);
        return dataPoints.map((v, i) => ({
          x: (i / (dataPoints.length - 1)) * barW,
          y: barH - (v / maxVal) * barH,
        }));
      })()
    : [];
  const pathD = points.length > 0 ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';
  const areaD =
    points.length > 0
      ? `M 0 ${barH} L ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} L ${barW} ${barH} Z`
      : '';
  const lastPoint = points.length > 0 ? points[points.length - 1] : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn('flex items-center gap-2 cursor-help', className)}
          role="presentation"
        >
          <div className="flex-shrink-0 overflow-hidden bg-muted/80" style={{ width: barW, height: barH }}>
            {hasValue ? (
              useRealSparkline ? (
                <svg width={barW} height={barH} className="overflow-visible">
                  <defs>
                    <linearGradient
                      id={sparklineGradientId}
                      x1="0"
                      x2="0"
                      y1="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={fillColor} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={fillColor} stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  <path d={areaD} fill={`url(#${sparklineGradientId})`} />
                  <path
                    d={pathD}
                    fill="none"
                    stroke={fillColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {lastPoint && (
                    <circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill={fillColor} />
                  )}
                </svg>
              ) : (
                <svg width={barW} height={barH} viewBox={`0 0 ${barW} ${barH}`} className="overflow-visible" shapeRendering="crispEdges">
                  {showFill && (
                    <rect
                      x={0}
                      y={fillY}
                      width={fillWidth}
                      height={fillHeight}
                      fill={fillColor}
                      fillOpacity={0.9}
                      shapeRendering="crispEdges"
                    />
                  )}
                </svg>
              )
            ) : (
              <div className="h-full w-full" />
            )}
          </div>
          <span
            className={cn(
              'text-xs font-medium tabular-nums min-w-0',
              hasValue
                ? isCpu
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-[hsl(142,76%,28%)] dark:text-[hsl(142,60%,42%)]'
                : 'text-muted-foreground'
            )}
          >
            {displayValue}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}
