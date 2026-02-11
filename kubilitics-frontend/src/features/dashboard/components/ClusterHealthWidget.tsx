import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { Progress } from "@/components/ui/progress";
import { Info, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const data = [
    { name: "Healthy", value: 89, color: "url(#colorGradient)" },
    { name: "Issues", value: 11, color: "hsl(var(--muted))" },
];

export const ClusterHealthWidget = () => {
    return (
        <Card className="h-full border-none soft-shadow glass-panel relative overflow-hidden group">
            {/* Decorative background gradient */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <CardHeader className="pb-2 relative z-10">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                        Cluster Health Score
                    </CardTitle>
                    <Tooltip>
                        <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                        </TooltipTrigger>
                        <TooltipContent>Overall cluster health based on node status, pod availability, and event severity.</TooltipContent>
                    </Tooltip>
                </div>
            </CardHeader>

            <CardContent className="h-[calc(100%-4rem)] grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-8 items-center relative z-10">
                {/* Donut Chart */}
                <div className="h-44 relative">
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
                                innerRadius={65}
                                outerRadius={80}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="none"
                                cornerRadius={10}
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
                                                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-5xl font-bold tracking-tighter">
                                                        89
                                                    </tspan>
                                                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground text-xs font-medium uppercase tracking-widest">
                                                        / 100
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

                {/* Breakdown */}
                <div className="space-y-6 pr-4">
                    {/* Status Badge */}
                    <div className="flex justify-end">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/20 text-success text-xs font-semibold shadow-sm backdrop-blur-sm">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Good State</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <HealthBar label="Pod Health" value={95} colorClass="bg-primary" />
                        <HealthBar label="Node Health" value={98} colorClass="bg-success" />
                        <HealthBar label="Stability" value={70} colorClass="bg-cosmic-purple" />
                        <HealthBar label="Event Health" value={80} colorClass="bg-warning" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const HealthBar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
    <div className="space-y-1.5 group">
        <div className="flex justify-between text-xs font-medium">
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
            <span className="text-foreground font-bold">{value}%</span>
        </div>
        <Progress value={value} className="h-2 bg-secondary/50" indicatorClassName={cn(colorClass, "transition-all duration-500")} />
    </div>
);

// Helper for Progress indicator class if not supported by default component prop
function cn(...classes: (string | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}
