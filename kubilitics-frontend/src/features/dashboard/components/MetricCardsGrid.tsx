import React from "react";
import { Link } from "react-router-dom";
import {
    Server,
    Activity,
    Layers,
    Globe,
    ArrowUp,
    ArrowDown,
    Minus,
    FolderKanban,
    Database,
    KeyRound,
    Copy,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { useResourceCounts } from "@/hooks/useResourceCounts";

const sparklineData = [
    { value: 40 },
    { value: 30 },
    { value: 60 },
    { value: 45 },
    { value: 70 },
    { value: 55 },
    { value: 85 },
];

export const MetricCardsGrid = () => {
    const { counts } = useResourceCounts();

    const cardConfigs = [
        {
            title: "Nodes",
            value: counts.nodes,
            href: "/nodes",
            trend: "+2",
            trendDir: "up" as const,
            icon: Server,
            accent: "from-blue-600 to-blue-400",
            borderClass: "border-l-blue-500",
            bgClass: "bg-gradient-to-br from-blue-500/8 via-transparent to-transparent",
            iconBg: "bg-blue-500/15",
            iconColor: "text-blue-600",
            chartColor: "#2563EB",
        },
        {
            title: "Pods",
            value: counts.pods,
            href: "/pods",
            trend: "+12",
            trendDir: "up" as const,
            icon: Activity,
            accent: "from-violet-600 to-purple-400",
            borderClass: "border-l-violet-500",
            bgClass: "bg-gradient-to-br from-violet-500/8 via-transparent to-transparent",
            iconBg: "bg-violet-500/15",
            iconColor: "text-violet-600",
            chartColor: "#7C3AED",
        },
        {
            title: "Deployments",
            value: counts.deployments,
            href: "/workloads/deployments",
            trend: "0",
            trendDir: "neutral" as const,
            icon: Layers,
            accent: "from-indigo-600 to-indigo-400",
            borderClass: "border-l-indigo-500",
            bgClass: "bg-gradient-to-br from-indigo-500/8 via-transparent to-transparent",
            iconBg: "bg-indigo-500/15",
            iconColor: "text-indigo-600",
            chartColor: "#4F46E5",
        },
        {
            title: "Services",
            value: counts.services,
            href: "/network/services",
            trend: "+1",
            trendDir: "up" as const,
            icon: Globe,
            accent: "from-cyan-600 to-sky-400",
            borderClass: "border-l-cyan-500",
            bgClass: "bg-gradient-to-br from-cyan-500/8 via-transparent to-transparent",
            iconBg: "bg-cyan-500/15",
            iconColor: "text-cyan-600",
            chartColor: "#0891B2",
        },
        {
            title: "Namespaces",
            value: counts.namespaces,
            href: "/namespaces",
            trend: "+1",
            trendDir: "up" as const,
            icon: FolderKanban,
            accent: "from-emerald-600 to-teal-400",
            borderClass: "border-l-emerald-500",
            bgClass: "bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent",
            iconBg: "bg-emerald-500/15",
            iconColor: "text-emerald-600",
            chartColor: "#059669",
        },
        {
            title: "Ingresses",
            value: counts.ingresses,
            href: "/network/ingresses",
            trend: "0",
            trendDir: "neutral" as const,
            icon: Globe,
            accent: "from-fuchsia-600 to-pink-400",
            borderClass: "border-l-fuchsia-500",
            bgClass: "bg-gradient-to-br from-fuchsia-500/8 via-transparent to-transparent",
            iconBg: "bg-fuchsia-500/15",
            iconColor: "text-fuchsia-600",
            chartColor: "#C026D3",
        },
        {
            title: "PVCs",
            value: counts.persistentvolumeclaims,
            href: "/storage/persistentvolumeclaims",
            trend: "0",
            trendDir: "neutral" as const,
            icon: Database,
            accent: "from-orange-600 to-amber-400",
            borderClass: "border-l-orange-500",
            bgClass: "bg-gradient-to-br from-orange-500/8 via-transparent to-transparent",
            iconBg: "bg-orange-500/15",
            iconColor: "text-orange-600",
            chartColor: "#EA580C",
        },
        {
            title: "StatefulSets",
            value: counts.statefulsets,
            href: "/workloads/statefulsets",
            trend: "0",
            trendDir: "neutral" as const,
            icon: Layers,
            accent: "from-slate-600 to-slate-500",
            borderClass: "border-l-slate-500",
            bgClass: "bg-gradient-to-br from-slate-500/8 via-transparent to-transparent",
            iconBg: "bg-slate-500/15",
            iconColor: "text-slate-700",
            chartColor: "#475569",
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-fr h-full">
            {cardConfigs.map((metric) => (
                <Link key={metric.title} to={metric.href} className="block h-full group hover:no-underline">
                    <Card
                        className={`overflow-hidden relative h-full hover:shadow-lg transition-all duration-300 border border-border/60 border-l-4 ${metric.borderClass} shadow-sm hover:border-l-[6px]`}
                    >
                        {/* Colored background wash */}
                        <div
                            className={`absolute inset-0 pointer-events-none ${metric.bgClass}`}
                            aria-hidden
                        />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 z-10 relative">
                            <CardTitle className="text-sm font-bold text-foreground tracking-tight">
                                {metric.title}
                            </CardTitle>
                            <div
                                className={`p-2 rounded-xl ${metric.iconBg} ${metric.iconColor} shadow-sm transition-transform group-hover:scale-110 duration-300`}
                            >
                                <metric.icon className="h-4 w-4" />
                            </div>
                        </CardHeader>
                        <CardContent className="z-10 relative px-4 pb-4">
                            <div className="flex items-baseline justify-between gap-2">
                                <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
                                    {metric.value}
                                </div>
                                <div className="h-8 w-20 shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={sparklineData}>
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke={metric.chartColor}
                                                strokeWidth={2}
                                                dot={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 flex-wrap">
                                {metric.trendDir === "up" && (
                                    <ArrowUp className="w-3 h-3 text-emerald-600 shrink-0" />
                                )}
                                {metric.trendDir === "down" && (
                                    <ArrowDown className="w-3 h-3 text-rose-600 shrink-0" />
                                )}
                                {metric.trendDir === "neutral" && (
                                    <Minus className="w-3 h-3 text-muted-foreground shrink-0" />
                                )}
                                <span
                                    className={
                                        metric.trendDir === "up"
                                            ? "text-emerald-600 font-semibold"
                                            : metric.trendDir === "down"
                                                ? "text-rose-600 font-semibold"
                                                : "text-muted-foreground"
                                    }
                                >
                                    {metric.trend}
                                </span>
                                <span className="opacity-80">from last check</span>
                            </p>
                        </CardContent>
                    </Card>
                </Link>
            ))}
        </div>
    );
};
