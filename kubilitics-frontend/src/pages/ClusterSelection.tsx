import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Server, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  Star
} from 'lucide-react';
import { KubernetesLogo } from '@/components/icons/KubernetesIcons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useKubeConfigStore, ParsedCluster } from '@/stores/kubeConfigStore';
import { useClusterStore, Cluster } from '@/stores/clusterStore';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ClusterWithHealth extends ParsedCluster {
  isChecking: boolean;
  lastChecked?: Date;
  version?: string;
  nodeCount?: number;
  provider?: string;
}

export default function ClusterSelection() {
  const navigate = useNavigate();
  const { parsedClusters, selectCluster, setAuthenticated } = useKubeConfigStore();
  const { setDemo, setClusters, setActiveCluster } = useClusterStore();
  
  const [clusters, setClustersState] = useState<ClusterWithHealth[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [primaryClusterId, setPrimaryClusterId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Initialize clusters with health check status
  useEffect(() => {
    if (parsedClusters.length > 0) {
      const clustersWithHealth: ClusterWithHealth[] = parsedClusters.map(c => ({
        ...c,
        isChecking: true,
        status: 'unknown',
      }));
      setClustersState(clustersWithHealth);
      
      // Simulate health checks
      clustersWithHealth.forEach((cluster, index) => {
        setTimeout(() => {
          setClustersState(prev => prev.map(c => {
            if (c.id === cluster.id) {
              // Simulate different results
              const statuses: ParsedCluster['status'][] = ['healthy', 'healthy', 'healthy', 'warning', 'error'];
              const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
              return {
                ...c,
                isChecking: false,
                status: randomStatus,
                lastChecked: new Date(),
                version: 'v1.28.4',
                nodeCount: Math.floor(Math.random() * 10) + 1,
                provider: detectProvider(c.server),
              };
            }
            return c;
          }));
        }, 1000 + index * 500);
      });
    } else {
      // Demo mode if no clusters
      const demoClusters: ClusterWithHealth[] = [
        {
          id: 'prod-eks',
          name: 'production-eks',
          server: 'https://eks.us-east-1.amazonaws.com',
          context: 'prod-eks',
          user: 'admin',
          namespace: 'default',
          isConnected: false,
          status: 'healthy',
          isChecking: false,
          version: 'v1.28.4',
          nodeCount: 12,
          provider: 'EKS',
        },
        {
          id: 'staging-gke',
          name: 'staging-gke',
          server: 'https://gke.us-central1.google.com',
          context: 'staging-gke',
          user: 'admin',
          namespace: 'default',
          isConnected: false,
          status: 'healthy',
          isChecking: false,
          version: 'v1.27.8',
          nodeCount: 5,
          provider: 'GKE',
        },
        {
          id: 'dev-minikube',
          name: 'dev-minikube',
          server: 'https://192.168.49.2:8443',
          context: 'minikube',
          user: 'minikube',
          namespace: 'default',
          isConnected: false,
          status: 'warning',
          isChecking: false,
          version: 'v1.29.0',
          nodeCount: 1,
          provider: 'Minikube',
        },
      ];
      setClustersState(demoClusters);
    }
  }, [parsedClusters]);

  const detectProvider = (server: string): string => {
    if (server.includes('eks') || server.includes('amazonaws')) return 'EKS';
    if (server.includes('gke') || server.includes('google')) return 'GKE';
    if (server.includes('aks') || server.includes('azure')) return 'AKS';
    if (server.includes('192.168') || server.includes('localhost')) return 'Minikube';
    return 'On-Prem';
  };

  const handleRetry = (clusterId: string) => {
    setClustersState(prev => prev.map(c => {
      if (c.id === clusterId) {
        return { ...c, isChecking: true, status: 'unknown' };
      }
      return c;
    }));

    setTimeout(() => {
      setClustersState(prev => prev.map(c => {
        if (c.id === clusterId) {
          return { ...c, isChecking: false, status: 'healthy', lastChecked: new Date() };
        }
        return c;
      }));
      toast.success('Connection successful!');
    }, 2000);
  };

  const handleRemove = (clusterId: string) => {
    setClustersState(prev => prev.filter(c => c.id !== clusterId));
    if (selectedClusterId === clusterId) setSelectedClusterId(null);
    if (primaryClusterId === clusterId) setPrimaryClusterId(null);
    toast.success('Cluster removed');
  };

  const handleSetPrimary = (clusterId: string) => {
    setPrimaryClusterId(clusterId);
    toast.success('Primary cluster set');
  };

  const handleConnect = async () => {
    if (!selectedClusterId) return;
    
    setIsConnecting(true);
    const cluster = clusters.find(c => c.id === selectedClusterId);
    
    // Simulate connection
    await new Promise(r => setTimeout(r, 1500));
    
    if (cluster) {
      selectCluster(cluster.id);
      setAuthenticated(true);
      
      // Create proper cluster object for store
      const activeCluster: Cluster = {
        id: cluster.id,
        name: cluster.name,
        context: cluster.context,
        version: cluster.version || 'v1.28.4',
        status: cluster.status === 'error' ? 'error' : cluster.status === 'warning' ? 'warning' : 'healthy',
        region: 'us-east-1',
        provider: (cluster.provider?.toLowerCase() || 'eks') as Cluster['provider'],
        nodes: cluster.nodeCount || 5,
        namespaces: 8,
        pods: { running: 120, pending: 3, failed: 1 },
        cpu: { used: 65, total: 100 },
        memory: { used: 70, total: 100 },
      };
      
      setActiveCluster(activeCluster);
      setDemo(true);
    }
    
    navigate('/dashboard');
  };

  const healthyCount = clusters.filter(c => c.status === 'healthy').length;
  const warningCount = clusters.filter(c => c.status === 'warning').length;
  const errorCount = clusters.filter(c => c.status === 'error').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="flex items-center gap-3">
            <KubernetesLogo size={32} className="text-primary" />
            <span className="text-xl font-semibold">Kubilitics Setup</span>
          </div>
          <Button variant="ghost" onClick={() => navigate('/setup/kubeconfig')}>
            Back
          </Button>
        </motion.div>

        {/* Progress Steps */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="flex items-center justify-center gap-4">
            {['Upload', 'Select Cluster', 'Connect'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    i < 1 ? 'bg-primary text-primary-foreground' :
                    i === 1 ? 'bg-primary/20 text-primary border-2 border-primary' :
                    'bg-muted text-muted-foreground'
                  )}
                >
                  {i < 1 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn(
                  "text-sm font-medium",
                  i === 1 ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
                {i < 2 && <div className="w-8 h-px bg-border mx-2" />}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Select Cluster</h1>
            <p className="text-muted-foreground">
              Choose which cluster to connect to. You can switch clusters anytime.
            </p>
          </div>

          {/* Summary stats */}
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span className="text-muted-foreground">{healthyCount} Healthy</span>
            </div>
            {warningCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-muted-foreground">{warningCount} Warning</span>
              </div>
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 rounded-full bg-error" />
                <span className="text-muted-foreground">{errorCount} Unreachable</span>
              </div>
            )}
          </div>

          {/* Cluster List */}
          <div className="space-y-3 mb-8">
            {clusters.map((cluster) => (
              <Card
                key={cluster.id}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedClusterId === cluster.id
                    ? 'ring-2 ring-primary border-primary'
                    : 'hover:border-primary/50',
                  cluster.status === 'error' && 'opacity-75'
                )}
                onClick={() => cluster.status !== 'error' && setSelectedClusterId(cluster.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Status icon */}
                    <div className={cn(
                      "p-2.5 rounded-lg",
                      cluster.isChecking ? 'bg-muted' :
                      cluster.status === 'healthy' ? 'bg-success/10' :
                      cluster.status === 'warning' ? 'bg-warning/10' : 'bg-error/10'
                    )}>
                      {cluster.isChecking ? (
                        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                      ) : cluster.status === 'healthy' ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : cluster.status === 'warning' ? (
                        <AlertCircle className="h-5 w-5 text-warning" />
                      ) : (
                        <XCircle className="h-5 w-5 text-error" />
                      )}
                    </div>

                    {/* Cluster info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{cluster.name}</span>
                        {primaryClusterId === cluster.id && (
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <Star className="h-2.5 w-2.5" />
                            Primary
                          </Badge>
                        )}
                        {cluster.provider && (
                          <Badge variant="outline" className="text-[10px]">
                            {cluster.provider}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {cluster.version && <span>{cluster.version}</span>}
                        {cluster.nodeCount && <span>{cluster.nodeCount} nodes</span>}
                        <span className="font-mono truncate">{cluster.server}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {cluster.status === 'error' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleRetry(cluster.id); }}
                          disabled={cluster.isChecking}
                        >
                          <RefreshCw className={cn("h-4 w-4 mr-1", cluster.isChecking && "animate-spin")} />
                          Retry
                        </Button>
                      ) : (
                        <>
                          {primaryClusterId !== cluster.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleSetPrimary(cluster.id); }}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleRemove(cluster.id); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Selection indicator */}
                    {selectedClusterId === cluster.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button 
              variant="outline" 
              onClick={() => navigate('/setup/kubeconfig')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Another Cluster
            </Button>
            
            <Button
              onClick={handleConnect}
              disabled={!selectedClusterId || isConnecting}
              className="gap-2 min-w-[150px]"
            >
              {isConnecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Connect
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
