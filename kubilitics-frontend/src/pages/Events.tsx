import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bell, Filter, RefreshCw, Clock, AlertTriangle, CheckCircle2, XCircle, ExternalLink, Play, Pause } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { cn } from '@/lib/utils';

interface K8sEvent {
  name: string;
  namespace: string;
  type: 'Normal' | 'Warning' | 'Error';
  reason: string;
  objectKind: string;
  objectName: string;
  objectNamespace: string;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  source: string;
}

interface K8sEventResource extends KubernetesResource {
  type?: string;
  reason?: string;
  message?: string;
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  involvedObject?: {
    kind?: string;
    name?: string;
    namespace?: string;
  };
  source?: {
    component?: string;
  };
}

const mockEvents: K8sEvent[] = [
  { name: 'nginx-deployment.17abc1234', namespace: 'production', type: 'Normal', reason: 'ScalingReplicaSet', objectKind: 'Deployment', objectName: 'nginx-deployment', objectNamespace: 'production', message: 'Scaled up replica set nginx-deployment-7fb96c846b to 3', count: 1, firstSeen: '2h ago', lastSeen: '2h ago', source: 'deployment-controller' },
  { name: 'api-pod.17def5678', namespace: 'production', type: 'Warning', reason: 'FailedScheduling', objectKind: 'Pod', objectName: 'api-pod-abc12', objectNamespace: 'production', message: 'Insufficient memory: 0/3 nodes are available', count: 5, firstSeen: '1h ago', lastSeen: '10m ago', source: 'scheduler' },
  { name: 'redis.17ghi9012', namespace: 'staging', type: 'Normal', reason: 'Pulled', objectKind: 'Pod', objectName: 'redis-master-0', objectNamespace: 'staging', message: 'Container image "redis:7.0" already present on machine', count: 1, firstSeen: '30m ago', lastSeen: '30m ago', source: 'kubelet' },
  { name: 'node-1.17jkl3456', namespace: '', type: 'Normal', reason: 'NodeReady', objectKind: 'Node', objectName: 'node-1', objectNamespace: '', message: 'Node node-1 status is now: NodeReady', count: 1, firstSeen: '3h ago', lastSeen: '3h ago', source: 'kubelet' },
  { name: 'pvc-data.17mno7890', namespace: 'production', type: 'Normal', reason: 'ProvisioningSucceeded', objectKind: 'PersistentVolumeClaim', objectName: 'data-pvc', objectNamespace: 'production', message: 'Successfully provisioned volume pv-data-001', count: 1, firstSeen: '90d ago', lastSeen: '90d ago', source: 'persistent-volume-controller' },
  { name: 'web-hpa.17pqr1234', namespace: 'production', type: 'Normal', reason: 'SuccessfulRescale', objectKind: 'HorizontalPodAutoscaler', objectName: 'web-hpa', objectNamespace: 'production', message: 'New size: 5; reason: CPU utilization above target', count: 3, firstSeen: '15m ago', lastSeen: '5m ago', source: 'horizontal-pod-autoscaler' },
  { name: 'ingress.17stu5678', namespace: 'production', type: 'Warning', reason: 'BackendError', objectKind: 'Ingress', objectName: 'main-ingress', objectNamespace: 'production', message: 'Backend service not found', count: 10, firstSeen: '45m ago', lastSeen: '1m ago', source: 'ingress-controller' },
  { name: 'secret.17vwx9012', namespace: 'kube-system', type: 'Normal', reason: 'Created', objectKind: 'Secret', objectName: 'default-token', objectNamespace: 'kube-system', message: 'Successfully created secret', count: 1, firstSeen: '180d ago', lastSeen: '180d ago', source: 'service-account-controller' },
];

const typeConfig = {
  Normal: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
  Warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  Error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
};

// Generate object link based on kind
function getObjectLink(kind: string, name: string, namespace: string): string {
  const kindMap: Record<string, string> = {
    Pod: 'pods',
    Deployment: 'deployments',
    ReplicaSet: 'replicasets',
    StatefulSet: 'statefulsets',
    DaemonSet: 'daemonsets',
    Job: 'jobs',
    CronJob: 'cronjobs',
    Service: 'services',
    Ingress: 'ingresses',
    ConfigMap: 'configmaps',
    Secret: 'secrets',
    PersistentVolumeClaim: 'persistentvolumeclaims',
    PersistentVolume: 'persistentvolumes',
    Node: 'nodes',
    Namespace: 'namespaces',
    HorizontalPodAutoscaler: 'horizontalpodautoscalers',
    ServiceAccount: 'serviceaccounts',
  };
  
  const path = kindMap[kind];
  if (!path) return '#';
  
  if (kind === 'Node' || kind === 'PersistentVolume' || kind === 'Namespace') {
    return `/${path}/${name}`;
  }
  return `/${path}/${namespace}/${name}`;
}

export default function Events() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sEventResource>('events');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'Normal' | 'Warning' | 'Error'>('all');
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | 'all'>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const rawEvents: K8sEvent[] = config.isConnected && data?.items
    ? data.items.map((ev) => ({
        name: ev.metadata.name,
        namespace: ev.metadata.namespace || '',
        type: (ev.type || 'Normal') as 'Normal' | 'Warning' | 'Error',
        reason: ev.reason || '-',
        objectKind: ev.involvedObject?.kind || '-',
        objectName: ev.involvedObject?.name || '-',
        objectNamespace: ev.involvedObject?.namespace || '',
        message: ev.message || '-',
        count: ev.count || 1,
        firstSeen: ev.firstTimestamp ? calculateAge(ev.firstTimestamp) + ' ago' : '-',
        lastSeen: ev.lastTimestamp ? calculateAge(ev.lastTimestamp) + ' ago' : '-',
        source: ev.source?.component || '-',
      }))
    : mockEvents;

  // Get unique values for filters
  const namespaces = ['all', ...Array.from(new Set(rawEvents.map(e => e.namespace).filter(Boolean)))];
  const sources = ['all', ...Array.from(new Set(rawEvents.map(e => e.source).filter(s => s !== '-')))];

  // Filter events
  const events = rawEvents.filter(event => {
    const matchesSearch = searchQuery === '' || 
      event.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.objectName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || event.type === typeFilter;
    const matchesNamespace = namespaceFilter === 'all' || event.namespace === namespaceFilter;
    const matchesSource = sourceFilter === 'all' || event.source === sourceFilter;
    
    return matchesSearch && matchesType && matchesNamespace && matchesSource;
  });

  // Count by type
  const normalCount = rawEvents.filter(e => e.type === 'Normal').length;
  const warningCount = rawEvents.filter(e => e.type === 'Warning').length;
  const errorCount = rawEvents.filter(e => e.type === 'Error').length;

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        refetch();
      }, 5000);
      setRefreshInterval(interval);
      return () => clearInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  }, [autoRefresh, refetch]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Events
          </h1>
          <p className="text-muted-foreground">Cluster events from all namespaces</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              {autoRefresh ? (
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" /> Live
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Pause className="h-3 w-3" /> Paused
                </span>
              )}
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setTypeFilter('all')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Events</p>
                <p className="text-2xl font-bold">{rawEvents.length}</p>
              </div>
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setTypeFilter('Normal')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Normal</p>
                <p className="text-2xl font-bold text-muted-foreground">{normalCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-warning/50 transition-colors" onClick={() => setTypeFilter('Warning')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-warning">{warningCount}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive/50 transition-colors" onClick={() => setTypeFilter('Error')}>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-destructive">{errorCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-64">
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Warning">Warning</SelectItem>
                <SelectItem value="Error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={namespaceFilter} onValueChange={setNamespaceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Namespace" />
              </SelectTrigger>
              <SelectContent>
                {namespaces.map(ns => (
                  <SelectItem key={ns} value={ns}>{ns === 'all' ? 'All Namespaces' : ns}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map(src => (
                  <SelectItem key={src} value={src}>{src === 'all' ? 'All Sources' : src}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last 1h</SelectItem>
                <SelectItem value="6h">Last 6h</SelectItem>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7d</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Events ({events.length})</CardTitle>
          <CardDescription>
            {autoRefresh && <span className="text-success">● Live updates enabled</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No events match your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const config = typeConfig[event.type];
                const EventIcon = config.icon;
                const objectLink = getObjectLink(event.objectKind, event.objectName, event.objectNamespace);
                
                return (
                  <div key={event.name} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className={cn('p-2 rounded-full mt-0.5', config.bg)}>
                      <EventIcon className={cn('h-4 w-4', config.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={event.type === 'Normal' ? 'secondary' : event.type === 'Warning' ? 'outline' : 'destructive'}>
                          {event.reason}
                        </Badge>
                        {objectLink !== '#' ? (
                          <Link 
                            to={objectLink}
                            className="font-mono text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {event.objectKind}/{event.objectName}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="font-mono text-sm text-muted-foreground">
                            {event.objectKind}/{event.objectName}
                          </span>
                        )}
                        {event.namespace && (
                          <Badge variant="outline" className="text-xs">{event.namespace}</Badge>
                        )}
                        {event.count > 1 && (
                          <Badge variant="secondary" className="text-xs">×{event.count}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{event.message}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last seen: {event.lastSeen}
                        </span>
                        <span>First seen: {event.firstSeen}</span>
                        <span>Source: {event.source}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
