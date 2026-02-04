import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showLive?: boolean;
  className?: string;
}

export function Sparkline({ 
  data, 
  width = 80, 
  height = 24, 
  color = 'hsl(var(--primary))',
  showLive = false,
  className 
}: SparklineProps) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div className={cn('relative', className)}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Gradient fill */}
        <defs>
          <linearGradient id={`gradient-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area */}
        <polygon
          points={areaPoints}
          fill={`url(#gradient-${color.replace(/[^a-z0-9]/gi, '')})`}
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Current value dot */}
        {showLive && data.length > 0 && (
          <motion.circle
            cx={width}
            cy={height - ((data[data.length - 1] - min) / range) * height}
            r="3"
            fill={color}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </svg>
    </div>
  );
}

interface LiveMetricProps {
  label: string;
  value: string;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  data: number[];
  color?: string;
}

export function LiveMetric({ label, value, unit, trend, data, color = 'hsl(var(--primary))' }: LiveMetricProps) {
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendColor = trend === 'up' ? 'text-[hsl(0,72%,51%)]' : trend === 'down' ? 'text-[hsl(142,76%,36%)]' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-2">
      <Sparkline data={data} width={60} height={20} color={color} showLive />
      <div className="text-right">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium">{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
          <span className={cn('text-xs', trendColor)}>{trendIcon}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

// Hook for generating simulated live metrics
export function useLiveMetrics(podName: string) {
  const [cpuData, setCpuData] = useState<number[]>(() => 
    Array.from({ length: 20 }, () => Math.random() * 50 + 10)
  );
  const [memData, setMemData] = useState<number[]>(() => 
    Array.from({ length: 20 }, () => Math.random() * 200 + 50)
  );
  const seedRef = useRef(podName.split('').reduce((a, b) => a + b.charCodeAt(0), 0));

  useEffect(() => {
    const interval = setInterval(() => {
      // Use seeded random for consistent per-pod behavior
      const seed = seedRef.current;
      const randomFactor = Math.sin(seed + Date.now() / 1000) * 0.5 + 0.5;
      
      setCpuData(prev => {
        const last = prev[prev.length - 1];
        const change = (randomFactor - 0.5) * 20;
        const newValue = Math.max(5, Math.min(100, last + change));
        return [...prev.slice(1), newValue];
      });
      
      setMemData(prev => {
        const last = prev[prev.length - 1];
        const change = (randomFactor - 0.5) * 30;
        const newValue = Math.max(20, Math.min(512, last + change));
        return [...prev.slice(1), newValue];
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const cpuValue = Math.round(cpuData[cpuData.length - 1]);
  const memValue = Math.round(memData[memData.length - 1]);
  
  const cpuTrend: 'up' | 'down' | 'stable' = 
    cpuData[cpuData.length - 1] > cpuData[cpuData.length - 3] + 5 ? 'up' :
    cpuData[cpuData.length - 1] < cpuData[cpuData.length - 3] - 5 ? 'down' : 'stable';
  
  const memTrend: 'up' | 'down' | 'stable' = 
    memData[memData.length - 1] > memData[memData.length - 3] + 10 ? 'up' :
    memData[memData.length - 1] < memData[memData.length - 3] - 10 ? 'down' : 'stable';

  return {
    cpu: { data: cpuData, value: `${cpuValue}m`, trend: cpuTrend },
    memory: { data: memData, value: `${memValue}Mi`, trend: memTrend },
  };
}
