import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Cpu, HardDrive, Network, Activity, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { cn } from '@/lib/utils';

interface MetricDataPoint {
  time: string;
  value: number;
}

interface ResourceMetrics {
  cpu: MetricDataPoint[];
  memory: MetricDataPoint[];
  network: { time: string; in: number; out: number }[];
}

interface MetricsDashboardProps {
  resourceType: 'pod' | 'node' | 'cluster';
  resourceName?: string;
  namespace?: string;
}

// Generate mock time series data
function generateMetricData(baseValue: number, variance: number, points: number = 20): MetricDataPoint[] {
  const now = new Date();
  return Array.from({ length: points }, (_, i) => {
    const time = new Date(now.getTime() - (points - i - 1) * 60000);
    const randomVariance = (Math.random() - 0.5) * variance * 2;
    return {
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: Math.max(0, Math.min(100, baseValue + randomVariance)),
    };
  });
}

function generateNetworkData(points: number = 20) {
  const now = new Date();
  return Array.from({ length: points }, (_, i) => {
    const time = new Date(now.getTime() - (points - i - 1) * 60000);
    return {
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      in: Math.floor(Math.random() * 50 + 10),
      out: Math.floor(Math.random() * 30 + 5),
    };
  });
}

const mockPodMetrics: ResourceMetrics = {
  cpu: generateMetricData(35, 15),
  memory: generateMetricData(62, 10),
  network: generateNetworkData(),
};

const mockNodeMetrics: ResourceMetrics = {
  cpu: generateMetricData(55, 20),
  memory: generateMetricData(72, 15),
  network: generateNetworkData(),
};

const mockClusterMetrics: ResourceMetrics = {
  cpu: generateMetricData(45, 10),
  memory: generateMetricData(58, 12),
  network: generateNetworkData(),
};

export function MetricsDashboard({ resourceType, resourceName, namespace }: MetricsDashboardProps) {
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    // Simulate loading metrics
    setIsLoading(true);
    const timer = setTimeout(() => {
      switch (resourceType) {
        case 'pod':
          setMetrics(mockPodMetrics);
          break;
        case 'node':
          setMetrics(mockNodeMetrics);
          break;
        case 'cluster':
          setMetrics(mockClusterMetrics);
          break;
      }
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [resourceType, resourceName]);

  const handleRefresh = () => {
    setMetrics({
      cpu: generateMetricData(resourceType === 'node' ? 55 : 35, 15),
      memory: generateMetricData(resourceType === 'node' ? 72 : 62, 10),
      network: generateNetworkData(),
    });
  };

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const currentCpu = metrics.cpu[metrics.cpu.length - 1]?.value || 0;
  const currentMemory = metrics.memory[metrics.memory.length - 1]?.value || 0;
  const prevCpu = metrics.cpu[metrics.cpu.length - 2]?.value || currentCpu;
  const prevMemory = metrics.memory[metrics.memory.length - 2]?.value || currentMemory;

  const cpuTrend = currentCpu - prevCpu;
  const memoryTrend = currentMemory - prevMemory;

  const totalNetworkIn = metrics.network.reduce((sum, d) => sum + d.in, 0);
  const totalNetworkOut = metrics.network.reduce((sum, d) => sum + d.out, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Resource Metrics</h3>
          <p className="text-sm text-muted-foreground">
            Real-time performance data for {resourceName || resourceType}
            {namespace && ` in ${namespace}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <Activity className="h-3 w-3" />
            Live
          </Badge>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Cpu className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CPU Usage</p>
                  <p className="text-2xl font-semibold">{currentCpu.toFixed(1)}%</p>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-1 text-sm',
                cpuTrend >= 0 ? 'text-error' : 'text-success'
              )}>
                {cpuTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(cpuTrend).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <HardDrive className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Memory Usage</p>
                  <p className="text-2xl font-semibold">{currentMemory.toFixed(1)}%</p>
                </div>
              </div>
              <div className={cn(
                'flex items-center gap-1 text-sm',
                memoryTrend >= 0 ? 'text-error' : 'text-success'
              )}>
                {memoryTrend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {Math.abs(memoryTrend).toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Network className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Network I/O</p>
                  <p className="text-2xl font-semibold">{(totalNetworkIn + totalNetworkOut).toFixed(0)} MB</p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                ↓{totalNetworkIn}MB ↑{totalNetworkOut}MB
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cpu">CPU</TabsTrigger>
          <TabsTrigger value="memory">Memory</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">CPU Usage Over Time</CardTitle>
                <CardDescription>Last 20 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.cpu}>
                      <defs>
                        <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        fill="url(#cpuGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Memory Usage Over Time</CardTitle>
                <CardDescription>Last 20 minutes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.memory}>
                      <defs>
                        <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(270, 70%, 60%)"
                        fill="url(#memoryGradient)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cpu" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">CPU Utilization</CardTitle>
              <CardDescription>Detailed CPU usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.cpu}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Memory Utilization</CardTitle>
              <CardDescription>Detailed memory usage over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.memory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(270, 70%, 60%)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: 'hsl(270, 70%, 60%)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Network I/O</CardTitle>
              <CardDescription>Inbound and outbound traffic over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.network}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="in" name="Inbound" fill="hsl(142, 70%, 45%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="out" name="Outbound" fill="hsl(200, 70%, 50%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
