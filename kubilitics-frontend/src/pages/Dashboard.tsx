import { motion } from 'framer-motion';
import { 
  Server, 
  Box, 
  Layers, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  ArrowUpRight,
  Cpu,
  HardDrive,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useClusterStore } from '@/stores/clusterStore';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { HealthScoreCard } from '@/components/dashboard/HealthScoreCard';
import { DashboardTour, useDashboardTour } from '@/components/onboarding/DashboardTour';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const recentEvents = [
  { type: 'Normal', reason: 'Scheduled', message: 'Successfully assigned pod nginx-deployment-abc123 to node-1', time: '2m ago', namespace: 'production' },
  { type: 'Warning', reason: 'BackOff', message: 'Back-off restarting failed container', time: '5m ago', namespace: 'staging' },
  { type: 'Normal', reason: 'Pulled', message: 'Container image "nginx:latest" already present', time: '8m ago', namespace: 'production' },
  { type: 'Normal', reason: 'Created', message: 'Created container nginx', time: '10m ago', namespace: 'default' },
  { type: 'Normal', reason: 'Started', message: 'Started container nginx', time: '10m ago', namespace: 'default' },
];

const resourceCards = [
  { label: 'Nodes', count: 12, icon: Server, status: 'healthy', path: '/nodes', change: '+2' },
  { label: 'Pods', count: 160, icon: Box, status: 'warning', path: '/pods', change: '+12' },
  { label: 'Deployments', count: 24, icon: Layers, status: 'healthy', path: '/deployments', change: '0' },
  { label: 'Services', count: 18, icon: Globe, status: 'healthy', path: '/services', change: '+1' },
];

export default function Dashboard() {
  const { activeCluster } = useClusterStore();
  const { showTour, completeTour, skipTour } = useDashboardTour();

  if (!activeCluster) {
    return null;
  }

  const healthScore = activeCluster.status === 'healthy' ? 98 : activeCluster.status === 'warning' ? 85 : 60;

  return (
    <>
      {showTour && (
        <DashboardTour onComplete={completeTour} onSkip={skipTour} />
      )}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-6"
        data-tour="dashboard"
      >
      {/* Page Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Cluster overview for {activeCluster.name}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>Live</span>
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-soft" />
        </div>
      </motion.div>

      {/* Cluster Health Score */}
      <motion.div variants={item}>
        <HealthScoreCard />
      </motion.div>

      {/* Resource Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {resourceCards.map((resource) => (
          <Link key={resource.label} to={resource.path}>
            <Card className="hover:shadow-kube-md transition-all duration-200 cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className={cn(
                    'p-2.5 rounded-xl transition-colors',
                    resource.status === 'healthy' ? 'bg-primary/10 group-hover:bg-primary/15' : 'bg-warning/10 group-hover:bg-warning/15'
                  )}>
                    <resource.icon className={cn(
                      'h-5 w-5',
                      resource.status === 'healthy' ? 'text-primary' : 'text-warning'
                    )} />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{resource.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">{resource.count}</span>
                    {resource.change !== '0' && (
                      <span className={cn(
                        'text-xs font-medium',
                        resource.change.startsWith('+') ? 'text-success' : 'text-error'
                      )}>
                        {resource.change}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </motion.div>

      {/* Pod Status + Events */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pod Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pod Status Distribution</CardTitle>
            <CardDescription>Current pod health across namespaces</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-muted">
                  <div 
                    className="bg-success transition-all duration-500" 
                    style={{ width: `${(activeCluster.pods.running / (activeCluster.pods.running + activeCluster.pods.pending + activeCluster.pods.failed)) * 100}%` }} 
                  />
                  <div 
                    className="bg-warning transition-all duration-500" 
                    style={{ width: `${(activeCluster.pods.pending / (activeCluster.pods.running + activeCluster.pods.pending + activeCluster.pods.failed)) * 100}%` }} 
                  />
                  <div 
                    className="bg-error transition-all duration-500" 
                    style={{ width: `${(activeCluster.pods.failed / (activeCluster.pods.running + activeCluster.pods.pending + activeCluster.pods.failed)) * 100}%` }} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-success" />
                  <div>
                    <p className="text-sm font-medium">{activeCluster.pods.running}</p>
                    <p className="text-xs text-muted-foreground">Running</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-warning" />
                  <div>
                    <p className="text-sm font-medium">{activeCluster.pods.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-error" />
                  <div>
                    <p className="text-sm font-medium">{activeCluster.pods.failed}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Events</CardTitle>
              <CardDescription>Latest cluster activity</CardDescription>
            </div>
            <Link to="/events" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentEvents.slice(0, 4).map((event, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className={cn(
                    'p-1 rounded-full mt-0.5',
                    event.type === 'Normal' ? 'bg-muted' : 'bg-warning/10'
                  )}>
                    {event.type === 'Normal' ? (
                      <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-warning" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{event.reason}</p>
                    <p className="text-xs text-muted-foreground truncate">{event.message}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {event.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div variants={item}>
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cluster Version</p>
                <p className="text-lg font-medium">{activeCluster.version}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Provider</p>
                <p className="text-lg font-medium capitalize">{activeCluster.provider}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Region</p>
                <p className="text-lg font-medium">{activeCluster.region}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Namespaces</p>
                <p className="text-lg font-medium">{activeCluster.namespaces}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </motion.div>
    </>
  );
}
