import React from "react";
import { ClusterHealthWidget } from "./ClusterHealthWidget";
import { MetricCardsGrid } from "./MetricCardsGrid";
import { PodStatusDistribution } from "./PodStatusDistribution";
import { RecentEventsWidget } from "./RecentEventsWidget";
import { Search, Terminal, Download, CircuitBoard, Cloud } from "lucide-react";

import { AIInsightsPanel } from "./AIInsightsPanel";
import { ClusterTopologyMap } from "./ClusterTopologyMap";
import { cn } from "@/lib/utils";

export const DashboardLayout = () => {
    return (
        <div className="h-full w-full flex flex-col min-h-0 bg-background text-foreground animate-fade-in divide-y divide-border/40">
            {/* Scrollable content with generous bottom padding so cluster details and actions are never cut */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-6 pb-28 space-y-8 scroll-smooth">
                {/* 2. Operational Health & Metrics (Hero Zone) — 2 rows of 4 resource cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[22rem]">
                    <div className="lg:col-span-1 min-h-[22rem]">
                        <ClusterHealthWidget />
                    </div>
                    <div className="lg:col-span-2 min-h-0 flex flex-col h-full">
                        <MetricCardsGrid />
                    </div>
                </div>

                {/* 3. Deep Dive Zone (Topology & AI) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[28rem]">
                    <div className="h-full">
                        <ClusterTopologyMap />
                    </div>
                    <div className="h-full">
                        <AIInsightsPanel />
                    </div>
                </div>

                {/* 4. Activity Stream Zone — min-height so content is not cut; extra bottom padding */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[20rem]">
                    <PodStatusDistribution />
                    <RecentEventsWidget />
                </div>
            </div>
        </div>
    );
};
