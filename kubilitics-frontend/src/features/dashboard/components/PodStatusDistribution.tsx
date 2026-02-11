import React from "react";
import { Link } from "react-router-dom";
import { Server } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useClusterStore } from "@/stores/clusterStore";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PROVIDER_LABELS: Record<string, string> = {
    eks: "EKS",
    gke: "GKE",
    aks: "AKS",
    minikube: "Minikube",
    kind: "Kind",
    "on-prem": "On-Prem",
};

function formatProvider(p: string): string {
    return PROVIDER_LABELS[p?.toLowerCase()] ?? (p || "Unknown");
}

const data = [
    {
        name: "Status",
        Running: 50,
        Pending: 2,
        Failed: 0,
    },
];

export const PodStatusDistribution = () => {
    const { activeCluster } = useClusterStore();
    const { counts, isConnected } = useResourceCounts();

    const version = activeCluster?.version || "—";
    const provider = formatProvider(activeCluster?.provider ?? "");
    const region = activeCluster?.region || "unknown";
    const namespaces =
        isConnected && counts.namespaces != null
            ? counts.namespaces
            : (activeCluster?.namespaces ?? 0);

    const clusterItems = [
        { label: "Cluster Version", value: version, bold: false },
        { label: "Provider", value: provider, bold: true },
        { label: "Region", value: region, bold: true },
        { label: "Namespaces", value: String(namespaces), bold: false },
    ] as const;

    return (
        <Card className="shadow-sm border-none ring-1 ring-border bg-card min-h-[20rem] flex flex-col">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Pod Status Distribution</CardTitle>
                <CardDescription>Current pod health across namespaces</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="h-[200px] w-full shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            layout="vertical"
                            data={data}
                            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                            barSize={20}
                        >
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide />
                            <Tooltip
                                cursor={{ fill: "transparent" }}
                                contentStyle={{
                                    borderRadius: "8px",
                                    border: "none",
                                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                }}
                            />
                            <Bar dataKey="Running" stackId="a" fill="#00E676" radius={[4, 0, 0, 4]} />
                            <Bar dataKey="Pending" stackId="a" fill="#FFD600" />
                            <Bar dataKey="Failed" stackId="a" fill="#FF1744" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex gap-6 mt-4 justify-center shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-success" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">50</span>
                            <span className="text-xs text-muted-foreground">Running</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-warning" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">2</span>
                            <span className="text-xs text-muted-foreground">Pending</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-error" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">0</span>
                            <span className="text-xs text-muted-foreground">Failed</span>
                        </div>
                    </div>
                </div>
                {/* Cluster details row (reference: four columns, Provider/Region bold) */}
                <div
                    className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-4 shrink-0"
                    aria-label="Cluster details"
                >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 min-w-0 flex-1">
                        {clusterItems.map(({ label, value, bold }) => (
                            <div key={label} className="flex flex-col gap-0.5">
                                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                                <span
                                    className={
                                        bold
                                            ? "text-sm font-bold text-foreground tabular-nums"
                                            : "text-sm font-semibold text-foreground tabular-nums"
                                    }
                                >
                                    {value}
                                </span>
                            </div>
                        ))}
                    </div>

                </div>
            </CardContent>
        </Card>
    );
};
