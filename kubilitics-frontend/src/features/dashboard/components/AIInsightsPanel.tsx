import React from "react";
import { Sparkles, ArrowRight, Zap, TrendingUp, Cpu, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const insights = [
    {
        type: "prediction",
        title: "Resource Spike Predicted",
        description: "Traffic likely to increase by 40% in 2 hours based on historical patterns.",
        action: "Scale Up",
        icon: TrendingUp,
        color: "text-purple-600",
        bg: "bg-purple-100",
    },
    {
        type: "optimization",
        title: "Cost Saving Opportunity",
        description: "3 nodes are underutilized. Consolidating could save $120/mo.",
        action: "Optimize",
        icon: Zap,
        color: "text-amber-600",
        bg: "bg-amber-100",
    },
    {
        type: "alert",
        title: "High Memory Pod Detected",
        description: "nginx-deployment-abc123 in default is at 92% memory. Consider increasing limits or scaling.",
        action: "View Pod",
        icon: Cpu,
        color: "text-rose-600",
        bg: "bg-rose-100",
    },
    {
        type: "security",
        title: "Image Update Available",
        description: "5 workloads use base images with known CVEs. Update to patched versions.",
        action: "Review",
        icon: Shield,
        color: "text-blue-600",
        bg: "bg-blue-100",
    },
];

export const AIInsightsPanel = () => {
    return (
        <Card className="h-full border-none glass-panel relative overflow-hidden flex flex-col">
            {/* Gradient Header Background */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cosmic-purple to-primary" />

            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Sparkles className="w-4 h-4 text-cosmic-purple fill-current" />
                        <span className="text-gradient font-bold">AI Insights</span>
                    </CardTitle>
                    <div className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground border border-border/50">
                        LIVE
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto space-y-3 pt-2 pb-4">
                {insights.map((item, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-white/60 dark:bg-white/5 border border-border/50 hover:bg-white/80 dark:hover:bg-white/10 transition-colors shadow-sm group">
                        <div className="flex gap-3 items-start">
                            <div className={`p-2 rounded-lg ${item.bg} ${item.color} mt-0.5 shrink-0`}>
                                <item.icon className="w-4 h-4" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-0">
                                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {item.description}
                                </p>
                                <div className="pt-1.5">
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 hover:text-primary hover:border-primary/30 bg-transparent">
                                        {item.action} <ArrowRight className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
};
