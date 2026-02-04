import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHealthScore } from '@/hooks/useHealthScore';
import { cn } from '@/lib/utils';

const statusConfig = {
  excellent: { 
    color: 'text-success', 
    bg: 'bg-success/10', 
    gradient: 'from-success/80 to-success',
    icon: CheckCircle2 
  },
  good: { 
    color: 'text-success', 
    bg: 'bg-success/10', 
    gradient: 'from-success/60 to-success/80',
    icon: CheckCircle2 
  },
  fair: { 
    color: 'text-warning', 
    bg: 'bg-warning/10', 
    gradient: 'from-warning/60 to-warning/80',
    icon: AlertTriangle 
  },
  poor: { 
    color: 'text-warning', 
    bg: 'bg-warning/10', 
    gradient: 'from-warning/80 to-orange-500',
    icon: AlertTriangle 
  },
  critical: { 
    color: 'text-error', 
    bg: 'bg-error/10', 
    gradient: 'from-error/80 to-error',
    icon: AlertTriangle 
  },
};

interface BreakdownItemProps {
  label: string;
  value: number;
  color: string;
}

function BreakdownItem({ label, value, color }: BreakdownItemProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}%</span>
      </div>
      <Progress value={value} className={cn("h-1.5", color)} />
    </div>
  );
}

export function HealthScoreCard() {
  const healthScore = useHealthScore();
  const config = statusConfig[healthScore.status];
  const StatusIcon = config.icon;

  // Calculate stroke dasharray for the circular progress
  const circumference = 2 * Math.PI * 45;
  const strokeDasharray = `${(healthScore.score / 100) * circumference} ${circumference}`;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            Cluster Health Score
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Aggregated score based on pod health (40%), node status (30%), 
                    stability (20%), and events (10%)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <Badge 
            variant="secondary" 
            className={cn("capitalize gap-1", config.bg, config.color)}
          >
            <StatusIcon className="h-3 w-3" />
            {healthScore.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Score Circle */}
          <div className="flex items-center justify-center">
            <div className="relative">
              <svg className="w-32 h-32 -rotate-90">
                {/* Background circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="45"
                  className="fill-none stroke-muted stroke-[8]"
                />
                {/* Progress circle */}
                <motion.circle
                  cx="64"
                  cy="64"
                  r="45"
                  className={cn("fill-none stroke-[8]", config.color)}
                  style={{
                    stroke: `url(#gradient-${healthScore.status})`,
                  }}
                  strokeLinecap="round"
                  strokeDasharray={strokeDasharray}
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  animate={{ strokeDasharray }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
                {/* Gradient definition */}
                <defs>
                  <linearGradient id={`gradient-${healthScore.status}`} gradientTransform="rotate(90)">
                    <stop offset="0%" className={`stop-${config.gradient.split(' ')[0].replace('from-', '')}`} />
                    <stop offset="100%" className={`stop-${config.gradient.split(' ')[1].replace('to-', '')}`} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span 
                  className="text-4xl font-bold"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  {healthScore.score}
                </motion.span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium mb-3">Score Breakdown</h4>
            <BreakdownItem 
              label="Pod Health" 
              value={healthScore.breakdown.podHealth} 
              color="[&>div]:bg-blue-500"
            />
            <BreakdownItem 
              label="Node Health" 
              value={healthScore.breakdown.nodeHealth} 
              color="[&>div]:bg-green-500"
            />
            <BreakdownItem 
              label="Stability" 
              value={healthScore.breakdown.stability} 
              color="[&>div]:bg-purple-500"
            />
            <BreakdownItem 
              label="Event Health" 
              value={healthScore.breakdown.eventHealth} 
              color="[&>div]:bg-amber-500"
            />
          </div>
        </div>

        {/* Insights */}
        {healthScore.details.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
              Insights
            </h4>
            <ul className="space-y-1">
              {healthScore.details.map((detail, i) => (
                <li 
                  key={i} 
                  className={cn(
                    "text-sm flex items-start gap-2",
                    healthScore.status === 'excellent' ? 'text-success' : 'text-muted-foreground'
                  )}
                >
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Trend indicator */}
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground">vs. last 24 hours</span>
          <div className="flex items-center gap-1 text-success text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>+2%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
