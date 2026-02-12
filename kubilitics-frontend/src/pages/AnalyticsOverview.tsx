import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Brain,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8080';

interface SystemHealth {
  security_score: number;
  security_grade: string;
  anomalies_24h: number;
  monthly_cost: number;
  cost_trend: 'up' | 'down' | 'stable';
  compliance_score: number;
  critical_issues: number;
}

interface Insight {
  category: 'security' | 'ml' | 'cost';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  link: string;
}

export function AnalyticsOverview() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSystemHealth();
    generateInsights();
  }, []);

  const fetchSystemHealth = async () => {
    setIsLoading(true);
    try {
      // In production, these would be actual API calls
      // For now, using mock data
      setSystemHealth({
        security_score: 75,
        security_grade: 'B',
        anomalies_24h: 12,
        monthly_cost: 12450,
        cost_trend: 'up',
        compliance_score: 78.5,
        critical_issues: 3
      });
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInsights = () => {
    // Cross-module insights combining Security, ML, and Cost data
    setInsights([
      {
        category: 'security',
        priority: 'critical',
        title: 'Critical Security Vulnerabilities Detected',
        description: '2 container images with critical CVEs need immediate attention',
        action: 'Review and Update Images',
        link: '/security'
      },
      {
        category: 'cost',
        priority: 'high',
        title: 'Cost Spike Detected',
        description: 'Monthly costs increased by 15% - potential optimization: $2,100/month',
        action: 'View Cost Optimizations',
        link: '/cost'
      },
      {
        category: 'ml',
        priority: 'high',
        title: 'Unusual Resource Pattern',
        description: '12 anomalies detected in CPU usage - possible performance issue',
        action: 'Investigate Anomalies',
        link: '/ml-analytics'
      },
      {
        category: 'security',
        priority: 'medium',
        title: 'Compliance Gap',
        description: 'CIS Kubernetes Benchmark compliance at 78.5% - 3 checks failing',
        action: 'Fix Compliance Issues',
        link: '/security'
      },
      {
        category: 'cost',
        priority: 'medium',
        title: 'Idle Resources',
        description: '3 pods idle for >7 days, wasting $280/month',
        action: 'Review Idle Resources',
        link: '/cost'
      }
    ]);
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-green-600';
      case 'B': return 'text-blue-600';
      case 'C': return 'text-yellow-600';
      case 'D': return 'text-orange-600';
      case 'F': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary'> = {
      critical: 'destructive',
      high: 'destructive',
      medium: 'default',
      low: 'secondary'
    };
    return <Badge variant={variants[priority]}>{priority.toUpperCase()}</Badge>;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return <Shield className="h-4 w-4 text-blue-600" />;
      case 'ml':
        return <Brain className="h-4 w-4 text-purple-600" />;
      case 'cost':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading || !systemHealth) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Analytics Overview</h1>
        <p className="text-muted-foreground mt-1">
          Unified insights from Security, ML Analytics, and Cost Intelligence
        </p>
      </div>

      {/* System Health Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Security Score */}
        <Link to="/security">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Security
                </CardTitle>
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <div className={`text-4xl font-bold ${getGradeColor(systemHealth.security_grade)}`}>
                  {systemHealth.security_grade}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold">{systemHealth.security_score}</p>
                  <p className="text-xs text-muted-foreground">out of 100</p>
                </div>
              </div>
              {systemHealth.critical_issues > 0 ? (
                <div className="flex items-center gap-1 text-red-600 text-xs">
                  <XCircle className="h-3 w-3" />
                  {systemHealth.critical_issues} critical issues
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-xs">
                  <CheckCircle2 className="h-3 w-3" />
                  No critical issues
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* ML Analytics */}
        <Link to="/ml-analytics">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  ML Analytics
                </CardTitle>
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {systemHealth.anomalies_24h}
              </div>
              <p className="text-xs text-muted-foreground">
                Anomalies detected (24h)
              </p>
              {systemHealth.anomalies_24h > 10 ? (
                <div className="flex items-center gap-1 text-orange-600 text-xs mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  Above normal threshold
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-xs mt-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Within normal range
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Cost Intelligence */}
        <Link to="/cost">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cost (Monthly)
                </CardTitle>
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600 mb-2">
                ${systemHealth.monthly_cost.toLocaleString()}
              </div>
              <div className={`flex items-center gap-1 text-xs ${systemHealth.cost_trend === 'up' ? 'text-red-600' :
                  systemHealth.cost_trend === 'down' ? 'text-green-600' :
                    'text-gray-600'
                }`}>
                {systemHealth.cost_trend === 'up' ? (
                  <>
                    <TrendingUp className="h-3 w-3" />
                    +6% from last month
                  </>
                ) : systemHealth.cost_trend === 'down' ? (
                  <>
                    <TrendingDown className="h-3 w-3" />
                    -3% from last month
                  </>
                ) : (
                  <>Stable</>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Compliance */}
        <Link to="/security">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Compliance
                </CardTitle>
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {systemHealth.compliance_score.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                CIS Kubernetes
              </p>
              {systemHealth.compliance_score < 80 ? (
                <div className="flex items-center gap-1 text-orange-600 text-xs mt-2">
                  <AlertTriangle className="h-3 w-3" />
                  Needs improvement
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600 text-xs mt-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Good standing
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Cross-Module Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Key Insights & Recommendations
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            AI-powered insights combining security, performance, and cost data
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(insight.category)}
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {insight.category}
                    </span>
                    {getPriorityBadge(insight.priority)}
                  </div>
                </div>
                <h4 className="font-semibold mb-1">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>
                <Link to={insight.link}>
                  <Button variant="outline" size="sm">
                    {insight.action}
                    <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/security">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                Security Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                View vulnerability scans, security issues, and compliance reports
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Go to Security
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/ml-analytics">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                ML Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Anomaly detection, forecasting, and model explainability
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Go to ML Analytics
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link to="/cost">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                Cost Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Cost optimization, forecasting, and multi-cloud pricing
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Go to Cost Dashboard
                <ArrowRight className="h-3 w-3 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold">API Status</p>
                  <p className="text-xs text-muted-foreground">All systems operational</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-600 text-white">Online</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold">ML Models</p>
                  <p className="text-xs text-muted-foreground">2 models active</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-600 text-white">Active</Badge>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-semibold">Data Collection</p>
                  <p className="text-xs text-muted-foreground">Real-time monitoring</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-purple-600 text-white">Running</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
