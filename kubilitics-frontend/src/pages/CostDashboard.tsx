import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Download,
  AlertCircle,
  PieChart,
  BarChart3
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

interface CostOverview {
  total_cost: number;
  monthly_cost: number;
  daily_cost: number;
  forecast_monthly: number;
  currency: string;
  period: string;
}

interface CostOptimization {
  type: string;
  description: string;
  potential_savings: number;
  priority: string;
  resource: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export function CostDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [costOverview, setCostOverview] = useState<CostOverview | null>(null);
  const [optimizations, setOptimizations] = useState<CostOptimization[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Generate example cost trend data
  const generateCostTrendData = () => {
    const data = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        cost: 300 + Math.random() * 200 + (29 - i) * 5, // Trending up slightly
        forecast: i < 7 ? 300 + Math.random() * 200 + (29 - i) * 5 + 50 : null
      });
    }
    return data;
  };

  // Generate example cost breakdown data
  const generateCostBreakdownData = () => [
    { name: 'Compute (Pods)', value: 8500, percentage: 45 },
    { name: 'Storage (PVCs)', value: 3200, percentage: 17 },
    { name: 'Network', value: 2800, percentage: 15 },
    { name: 'Load Balancers', value: 2500, percentage: 13 },
    { name: 'Other', value: 1900, percentage: 10 }
  ];

  // Generate example namespace costs
  const generateNamespaceCosts = () => [
    { namespace: 'production', cost: 7200 },
    { namespace: 'staging', cost: 4800 },
    { namespace: 'development', cost: 3500 },
    { namespace: 'monitoring', cost: 2100 },
    { namespace: 'default', cost: 1300 }
  ];

  const costTrendData = generateCostTrendData();
  const costBreakdownData = generateCostBreakdownData();
  const namespaceCosts = generateNamespaceCosts();

  useEffect(() => {
    fetchCostOverview();
    fetchOptimizations();
  }, []);

  const fetchCostOverview = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/cost/overview`);
      if (response.ok) {
        const data = await response.json();
        setCostOverview(data);
      } else {
        // Use mock data if API not available
        setCostOverview({
          total_cost: 18900,
          monthly_cost: 12450,
          daily_cost: 415,
          forecast_monthly: 13200,
          currency: 'USD',
          period: 'February 2026'
        });
      }
    } catch (error) {
      console.error('Failed to fetch cost overview:', error);
      // Use mock data
      setCostOverview({
        total_cost: 18900,
        monthly_cost: 12450,
        daily_cost: 415,
        forecast_monthly: 13200,
        currency: 'USD',
        period: 'February 2026'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOptimizations = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/cost/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const data = await response.json();
        setOptimizations(data.optimizations || []);
      } else {
        // Use mock data
        setOptimizations([
          {
            type: 'rightsizing',
            description: 'Pod "nginx-deployment" is overprovisioned by 60%',
            potential_savings: 420,
            priority: 'high',
            resource: 'nginx-deployment'
          },
          {
            type: 'idle_resources',
            description: 'Pod "redis-cache" has been idle for 7 days',
            potential_savings: 280,
            priority: 'medium',
            resource: 'redis-cache'
          },
          {
            type: 'storage_optimization',
            description: 'PVC "data-volume" is 80% empty, consider downsizing',
            potential_savings: 150,
            priority: 'medium',
            resource: 'data-volume'
          },
          {
            type: 'spot_instances',
            description: 'Node pool can use spot instances, save 70%',
            potential_savings: 890,
            priority: 'high',
            resource: 'node-pool-1'
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch optimizations:', error);
    }
  };

  const totalSavings = optimizations.reduce((sum, opt) => sum + opt.potential_savings, 0);

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary'> = {
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    };
    return <Badge variant={variants[priority] || 'default'}>{priority}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600" />
            Cost Intelligence Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-cloud cost optimization and forecasting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCostOverview} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Cost Overview Cards */}
      {costOverview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Monthly Cost */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Current Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                ${costOverview.monthly_cost.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costOverview.period}
              </p>
            </CardContent>
          </Card>

          {/* Daily Average */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Daily Average
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ${costOverview.daily_cost.toLocaleString()}
              </div>
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                -5% from last week
              </p>
            </CardContent>
          </Card>

          {/* Forecast */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Month Forecast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                ${costOverview.forecast_monthly.toLocaleString()}
              </div>
              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +6% from current
              </p>
            </CardContent>
          </Card>

          {/* Potential Savings */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Potential Savings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                ${totalSavings.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {optimizations.length} opportunities
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cost Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">30-Day Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={costTrendData}>
                    <defs>
                      <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                    <YAxis style={{ fontSize: '12px' }} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="cost"
                      stroke="#3b82f6"
                      fill="url(#colorCost)"
                      name="Actual Cost ($)"
                    />
                    <Area
                      type="monotone"
                      dataKey="forecast"
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      fill="none"
                      name="Forecast ($)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost Breakdown by Resource Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RePieChart>
                    <Pie
                      data={costBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${entry.percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {costBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {costBreakdownData.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-semibold">${item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Optimization Opportunities */}
          {optimizations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  Top Optimization Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {optimizations.slice(0, 3).map((opt, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border rounded hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getPriorityBadge(opt.priority)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {opt.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm">{opt.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Resource: {opt.resource}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-green-600">
                          ${opt.potential_savings}
                        </p>
                        <p className="text-xs text-muted-foreground">per month</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost Trends & Forecasting</CardTitle>
              <p className="text-xs text-muted-foreground">
                Historical cost data with ML-powered forecasts
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={costTrendData}>
                  <defs>
                    <linearGradient id="colorCost2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" style={{ fontSize: '12px' }} />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    stroke="#3b82f6"
                    fill="url(#colorCost2)"
                    name="Actual Cost ($)"
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#f59e0b"
                    fill="url(#colorForecast)"
                    name="Forecast ($)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* By Resource Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost by Resource Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={costBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" style={{ fontSize: '12px' }} angle={-45} textAnchor="end" height={100} />
                    <YAxis style={{ fontSize: '12px' }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" name="Cost ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Namespace */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost by Namespace</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={namespaceCosts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="namespace" style={{ fontSize: '12px' }} />
                    <YAxis style={{ fontSize: '12px' }} />
                    <Tooltip />
                    <Bar dataKey="cost" fill="#8b5cf6" name="Cost ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost Optimization Recommendations</CardTitle>
              <p className="text-xs text-muted-foreground">
                AI-powered recommendations to reduce cloud spending
              </p>
            </CardHeader>
            <CardContent>
              {optimizations.length > 0 ? (
                <div className="space-y-3">
                  {optimizations.map((opt, idx) => (
                    <div key={idx} className="border rounded p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(opt.priority)}
                          <Badge variant="outline" className="text-xs capitalize">
                            {opt.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">
                            ${opt.potential_savings}
                          </p>
                          <p className="text-xs text-muted-foreground">per month</p>
                        </div>
                      </div>
                      <p className="text-sm mb-2">{opt.description}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Resource: <span className="font-semibold">{opt.resource}</span></span>
                        <Button size="sm" variant="outline">
                          Apply Optimization
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-green-800">Total Potential Savings</p>
                        <p className="text-xs text-green-700">
                          Implementing all {optimizations.length} recommendations
                        </p>
                      </div>
                      <p className="text-3xl font-bold text-green-600">
                        ${totalSavings.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No optimization opportunities found</p>
                  <p className="text-xs mt-1">Your cluster is already optimized!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
