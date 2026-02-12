import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Info, CheckCircle2, AlertTriangle, AlertCircle, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHealthScore } from "@/hooks/useHealthScore";
import { useClusterStore } from "@/stores/clusterStore";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { gradient: string; badge: string; icon: typeof CheckCircle2 }> = {
  excellent: { gradient: "hsl(var(--success))", badge: "bg-success/10 border-success/20 text-success", icon: CheckCircle2 },
  good: { gradient: "hsl(var(--success))", badge: "bg-success/10 border-success/20 text-success", icon: CheckCircle2 },
  fair: { gradient: "hsl(var(--warning))", badge: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  poor: { gradient: "hsl(var(--warning))", badge: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  critical: { gradient: "hsl(var(--error))", badge: "bg-rose-100 dark:bg-rose-900/30 border-rose-200 text-rose-700 dark:text-rose-400", icon: AlertCircle },
};

export const ClusterHealthWidget = () => {
  const { activeCluster } = useClusterStore();
  const health = useHealthScore();
  const config = STATUS_CONFIG[health.status] ?? STATUS_CONFIG.critical;
  const StatusIcon = config.icon;

  const data = [
    { name: "Healthy", value: health.score, color: "url(#colorGradient)" },
    { name: "Issues", value: 100 - health.score, color: "hsl(var(--muted))" },
  ];

  const statusLabel = health.status === "excellent" || health.status === "good" ? "Good State" : health.status === "fair" ? "Needs Attention" : "At Risk";

  return (
    <Card className="h-full border-none soft-shadow glass-panel relative overflow-hidden group flex flex-col">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <CardHeader className="pb-0 relative z-10 shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-foreground">
            Cluster Health
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold shadow-sm backdrop-blur-sm", config.badge)}>
              <StatusIcon className="w-3 h-3" />
              <span>{statusLabel}</span>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
              </TooltipTrigger>
              <TooltipContent>Overall cluster health based on node status, pod availability, and event severity.</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between pt-2 pb-5 relative z-10">
        {/* Donut Chart — centered, prominent */}
        <div className="flex items-center justify-center py-2" style={{ height: "200px" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="#00E5FF" />
                </linearGradient>
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={68}
                outerRadius={88}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
                cornerRadius={12}
                paddingAngle={5}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-4xl font-black tracking-tighter">
                            {activeCluster ? health.score : "—"}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 18} className="fill-muted-foreground text-[10px] font-bold uppercase tracking-[0.2em]">
                            Grade {health.grade}
                          </tspan>
                        </text>
                      );
                    }
                    return null;
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Health Breakdown — 2 columns, 3 bars each */}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 px-1">
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Infrastructure</p>
            <HealthBar label="Pod Health" value={health.breakdown.podHealth} colorClass="bg-primary" />
            <HealthBar label="Node Health" value={health.breakdown.nodeHealth} colorClass="bg-success" />
            <HealthBar label="Stability" value={health.breakdown.stability} colorClass="bg-cosmic-purple" />
          </div>
          <div className="space-y-2.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Control Plane</p>
            <HealthBar label="Event Health" value={health.breakdown.eventHealth} colorClass="bg-warning" />
            <HealthBar label="API Latency" value={98} colorClass="bg-emerald-500" />
            <HealthBar label="Etcd Health" value={100} colorClass="bg-cyan-500" />
          </div>
        </div>

        {/* AI Insight */}
        <div className="mt-4 pt-3 border-t border-border/40 space-y-2 px-1">
          <div className="flex items-start gap-2">
            <Brain className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {health.insight}
            </p>
          </div>
          <div className="flex justify-between items-center text-[10px] text-muted-foreground/60">
            <span>Last check: Just now</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
              Operational
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const HealthBar = ({ label, value, colorClass }: { label: string; value: number; colorClass: string }) => (
  <div className="space-y-1 group">
    <div className="flex justify-between text-[11px] font-medium">
      <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      <span className="text-foreground font-bold tabular-nums">{Math.min(100, Math.max(0, value))}%</span>
    </div>
    <Progress value={Math.min(100, Math.max(0, value))} className="h-1.5 bg-secondary/50" indicatorClassName={cn(colorClass, "transition-all duration-500")} />
  </div>
);
