import React from "react";
import { Link } from "react-router-dom";
import { Network, Map, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TopologyViewer } from "@/components/resources/TopologyViewer";
import { useClusterTopologyForViewer } from "@/hooks/useClusterTopologyForViewer";

/**
 * Dashboard Topology card: 3-level hierarchy — Cluster (center) → Nodes → Deployments → Pods.
 * Uses TopologyViewer in card variant so it fits the card without breaking layout.
 */
export const ClusterTopologyMap = () => {
  const { nodes, edges, isLoading } = useClusterTopologyForViewer();

  return (
    <Card className="h-full rounded-xl border border-border/50 bg-card/30 overflow-hidden flex flex-col">
      <CardHeader className="pb-2 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            Topology
          </CardTitle>
          <Link to="/topology" className="text-xs text-primary hover:underline flex items-center gap-1">
            <Map className="h-3.5 w-3.5" />
            View full map
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex-1 relative p-0 overflow-hidden min-h-[260px] flex flex-col">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 min-h-[260px]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/10 p-4 min-h-[260px]">
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              No topology data. Connect your cluster and ensure the backend is reachable, or add a cluster in Settings.
            </p>
          </div>
        ) : (
          <TopologyViewer
            nodes={nodes}
            edges={edges}
            variant="card"
            className="flex-1 min-h-[220px] w-full border-0 rounded-none bg-transparent"
          />
        )}
      </CardContent>
    </Card>
  );
};
