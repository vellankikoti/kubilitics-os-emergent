import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, Info, Clock, ChevronRight, StopCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EventActivityChart } from "./EventActivityChart";

const events = [
    {
        type: "success",
        title: "Scheduled",
        message: "Successfully assigned pod nginx-deployment-abc123 to node-1",
        time: "2m ago",
        icon: CheckCircle2,
        color: "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400",
    },
    {
        type: "warning",
        title: "BackOff",
        message: "Back-off restarting failed container",
        time: "5m ago",
        icon: AlertTriangle,
        color: "text-amber-600 bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400",
    },
    {
        type: "info",
        title: "Pulled",
        message: "Container image \"nginx:latest\" already present on machine",
        time: "8m ago",
        icon: Info,
        color: "text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400",
    },
    {
        type: "success",
        title: "Created",
        message: "Created container nginx",
        time: "10m ago",
        icon: CheckCircle2,
        color: "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400",
    },
    {
        type: "info",
        title: "Killing",
        message: "Stopping container nginx in pod nginx-deployment-abc123_default",
        time: "12m ago",
        icon: StopCircle,
        color: "text-slate-600 bg-slate-100 dark:bg-slate-900/20 dark:text-slate-400",
    },
    {
        type: "success",
        title: "Started",
        message: "Started container nginx in pod nginx-deployment-abc123_default",
        time: "15m ago",
        icon: CheckCircle2,
        color: "text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400",
    },
];

export const RecentEventsWidget = () => {
    return (
        <Card className="min-h-[20rem] flex flex-col border-none glass-panel overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-blue-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
                <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
                    <CardDescription>Latest cluster activity</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-primary hover:text-primary/80 h-8" asChild>
                    <Link to="/events">View all <ChevronRight className="w-3 h-3 ml-1" /></Link>
                </Button>
            </CardHeader>

            {/* Activity Visualization */}
            <div className="h-16 px-6 pb-2 shrink-0 border-b border-border/40">
                <EventActivityChart />
            </div>

            <CardContent className="pt-4 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-6">
                    {events.slice(0, 5).map((event, idx) => (
                        <div key={idx} className="flex gap-4 group">
                            <div className={`mt-1 p-2 rounded-full h-fit flex-shrink-0 ${event.color}`}>
                                <event.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <p className="text-base font-semibold text-foreground leading-none">{event.title}</p>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5" /> {event.time}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                    {event.message}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
