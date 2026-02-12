import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useClusterStore } from "@/stores/clusterStore";
import { useResourceCounts } from "@/hooks/useResourceCounts";
import { useK8sResourceList } from "@/hooks/useKubernetes";
import { Loader2 } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
    eks: "EKS",
    gke: "GKE",
    aks: "AKS",
    minikube: "Minikube",
    kind: "Kind",
    "docker-desktop": "Docker",
    "on-prem": "On-Prem",
};

function formatProvider(p: string): string {
    return PROVIDER_LABELS[p?.toLowerCase()] ?? (p || "Unknown");
}

const STATUS_COLORS = {
    Running: "#00E676",
    Pending: "#FFD600",
    Failed: "#FF1744",
    Succeeded: "#00E676",
    Unknown: "#9E9E9E",
} as const;

export const PodStatusDistribution = () => {
    const { activeCluster } = useClusterStore();
    const { counts, isConnected } = useResourceCounts();
    const { data: podsList, isLoading: podsLoading } = useK8sResourceList(
        "pods",
        undefined,
        { enabled: !!activeCluster, limit: 5000 }
    );

    const { running, pending, failed, succeeded, unknown } = useMemo(() => {
        const items = (podsList as { items?: unknown[] })?.items ?? [];
        const stats = { running: 0, pending: 0, failed: 0, succeeded: 0, unknown: 0 };
        for (const pod of items as { status?: { phase?: string } }[]) {
            const phase = (pod?.status?.phase ?? "Unknown").toLowerCase();
            if (phase === "running") stats.running++;
            else if (phase === "pending") stats.pending++;
            else if (phase === "failed" || phase === "unknown") stats.failed++;
            else if (phase === "succeeded") stats.succeeded++;
            else stats.unknown++;
        }
        return stats;
    }, [podsList]);

    const chartData = useMemo(
        () => [
            { name: "Status", Running: running, Pending: pending, Failed: failed, Succeeded: succeeded },
        ],
        [running, pending, failed, succeeded]
    );

    const hasAnyPods = running + pending + failed + succeeded > 0;

    const version = activeCluster?.version || "—";
    const provider = formatProvider(activeCluster?.provider ?? activeCluster?.name ?? "");
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
        <Card className="min-h-[20rem] flex flex-col border-none glass-panel relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-blue-500" />
            <CardHeader>
                <CardTitle className="text-base font-semibold">Pod Status Distribution</CardTitle>
                <CardDescription>Current pod health across namespaces</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
                <div className="h-[200px] w-full shrink-0">
                    {podsLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !hasAnyPods ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                            No pod data yet
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                layout="vertical"
                                data={chartData}
                                margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                                barSize={32}
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
                                    formatter={(value: number, name: string) => [value, name]}
                                />
                                <Bar dataKey="Running" stackId="a" fill={STATUS_COLORS.Running} radius={[4, 0, 0, 4]} />
                                <Bar dataKey="Pending" stackId="a" fill={STATUS_COLORS.Pending} />
                                <Bar dataKey="Failed" stackId="a" fill={STATUS_COLORS.Failed} />
                                <Bar dataKey="Succeeded" stackId="a" fill={STATUS_COLORS.Succeeded} radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
                <div className="flex gap-6 mt-4 justify-center shrink-0 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-success" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">{running}</span>
                            <span className="text-xs text-muted-foreground">Running</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-warning" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">{pending}</span>
                            <span className="text-xs text-muted-foreground">Pending</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-signal-error" />
                        <div className="flex flex-col">
                            <span className="text-lg font-bold leading-none">{failed}</span>
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
