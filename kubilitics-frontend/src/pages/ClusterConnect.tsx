/**
 * Cluster Connect Page
 * Entry point for the Kubilitics application (Desktop & Helm modes).
 * Uses backend cluster list when configured; no mock data.
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload,
  Server,
  Zap,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Monitor,
  Cloud,
  Terminal,
  Folder,
  CheckCircle2,
  XCircle,
  Circle,
  Settings,
} from 'lucide-react';
import { KubernetesLogo } from '@/components/icons/KubernetesIcons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { DEFAULT_BACKEND_BASE_URL } from '@/lib/backendConstants';
import { useClustersFromBackend } from '@/hooks/useClustersFromBackend';
import { addClusterWithUpload, type BackendCluster } from '@/services/backendApiClient';
import { backendClusterToCluster } from '@/lib/backendClusterAdapter';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface DetectedCluster {
  id: string;
  name: string;
  context: string;
  server: string;
  status: 'checking' | 'healthy' | 'unhealthy' | 'unknown';
  namespace?: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

function mapBackendStatus(s?: string): DetectedCluster['status'] {
  if (s === 'connected') return 'healthy';
  if (s === 'disconnected') return 'unhealthy';
  return 'unknown';
}

function backendToDetected(b: BackendCluster): DetectedCluster {
  const server = b.server_url ?? b.server ?? '';
  return {
    id: b.id,
    name: b.name,
    context: b.context,
    server,
    status: mapBackendStatus(b.status),
  };
}

// Common kubeconfig locations (informational only when backend is used)
const kubeconfigLocations = [
  { path: '~/.kube/config', desc: 'Default location' },
  { path: '~/.config/k3s/k3s.yaml', desc: 'K3s config' },
  { path: '$KUBECONFIG', desc: 'Environment variable' },
  { path: '~/.kube/config.d/*', desc: 'Config directory' },
];

export default function ClusterConnect() {
  const navigate = useNavigate();
  const { activeCluster, setActiveCluster, setClusters, setDemo } = useClusterStore();
  const storedBackendUrl = useBackendConfigStore((s) => s.backendBaseUrl);
  const backendBaseUrl = getEffectiveBackendBaseUrl(storedBackendUrl);
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const setCurrentClusterId = useBackendConfigStore((s) => s.setCurrentClusterId);
  const clustersFromBackend = useClustersFromBackend();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'auto' | 'upload' | 'helm'>('auto');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Already connected (e.g. from persist): redirect to dashboard so user doesn't sit on Connect.
  useEffect(() => {
    if (activeCluster) {
      navigate('/dashboard', { replace: true });
    }
  }, [activeCluster, navigate]);

  // Clusters from backend API (GET /api/v1/clusters) – real status from backend
  const detectedClusters: DetectedCluster[] =
    isBackendConfigured && clustersFromBackend.data
      ? clustersFromBackend.data.map(backendToDetected)
      : [];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleUploadedFile(file);
  }, []);

  const handleUploadedFile = async (file: File) => {
    if (!isBackendConfigured || !backendBaseUrl?.trim()) {
      toast.error('Set backend URL in Settings first');
      return;
    }
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const bytes = await file.arrayBuffer();
      setUploadProgress(30);
      const base64 = btoa(
        new Uint8Array(bytes).reduce((acc, b) => acc + String.fromCharCode(b), '')
      );
      setUploadProgress(60);
      const text = new TextDecoder().decode(bytes);
      let contextName = 'default';
      try {
        const currentMatch = text.match(/current-context:\s*(\S+)/);
        if (currentMatch) contextName = currentMatch[1].trim();
        else {
          const nameMatch = text.match(/contexts:\s*[\s\S]*?name:\s*(\S+)/);
          if (nameMatch) contextName = nameMatch[1].trim();
        }
      } catch {
        /* use default */
      }
      setUploadProgress(80);
      await addClusterWithUpload(backendBaseUrl, base64, contextName);
      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ['backend', 'clusters'] });
      await clustersFromBackend.refetch();
      toast.success('Cluster added', { description: `Context: ${contextName}` });
      setMode('auto');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add cluster');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConnect = (cluster: DetectedCluster) => {
    if (!isBackendConfigured || !clustersFromBackend.data) return;
    const backendItem = clustersFromBackend.data.find((c) => c.id === cluster.id);
    if (!backendItem) return;
    setIsConnecting(true);
    const connectedClusters = clustersFromBackend.data.map(backendClusterToCluster);
    const connectedCluster = backendClusterToCluster(backendItem);
    setCurrentClusterId(backendItem.id);
    setClusters(connectedClusters);
    setActiveCluster(connectedCluster);
    setDemo(false);
    setIsConnecting(false);
    queryClient.invalidateQueries({ queryKey: ['backend', 'clusters'] });
    clustersFromBackend.refetch();
    toast.success(`Connected to ${cluster.name}`, { description: `Context: ${cluster.context}` });
    navigate('/dashboard', { replace: true });
  };

  const handleDemoMode = () => {
    setDemo(true);
    navigate('/dashboard', { replace: true });
  };

  const getStatusIcon = (status: DetectedCluster['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleRefreshClusters = () => {
    queryClient.invalidateQueries({ queryKey: ['backend', 'clusters'] });
    clustersFromBackend.refetch();
  };

  // Brief loading only when already connected and redirecting (avoids flash of Connect form).
  if (activeCluster) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="w-full max-w-2xl"
        >
          <motion.div variants={item} className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-6">
              <KubernetesLogo size={48} className="text-primary" />
              <span className="text-3xl font-bold tracking-tight">Kubilitics</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">
              Connect Your Cluster
            </h1>
            <p className="text-muted-foreground">
              Choose how you'd like to connect to your Kubernetes cluster
            </p>
          </motion.div>

          <motion.div variants={item}>
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="auto" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Auto-Detect
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Config
                </TabsTrigger>
                <TabsTrigger value="helm" className="gap-2">
                  <Server className="h-4 w-4" />
                  In-Cluster
                </TabsTrigger>
              </TabsList>

              {/* Auto-Detect: backend clusters when configured, else empty state */}
              <TabsContent value="auto">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Detected Clusters</h3>
                      <p className="text-sm text-muted-foreground">
                        {isBackendConfigured
                          ? clustersFromBackend.isLoading
                            ? 'Loading clusters from backend…'
                            : 'Clusters registered with your backend'
                          : 'Set backend URL in Settings to see clusters'}
                      </p>
                    </div>
                    {isBackendConfigured && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshClusters}
                        disabled={clustersFromBackend.isFetching}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${clustersFromBackend.isFetching ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    )}
                  </div>

                  {!isBackendConfigured && (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Configure the Kubilitics backend URL in Settings (e.g. {DEFAULT_BACKEND_BASE_URL})
                        to see and connect to your clusters.
                      </p>
                      <Button variant="outline" onClick={() => navigate('/settings')}>
                        Open Settings
                      </Button>
                    </div>
                  )}

                  {isBackendConfigured && clustersFromBackend.isLoading && (
                    <div className="space-y-2 mb-4">
                      {kubeconfigLocations.map((loc, i) => (
                        <motion.div
                          key={loc.path}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-3 text-sm text-muted-foreground"
                        >
                          <Folder className="h-4 w-4" />
                          <span className="font-mono">{loc.path}</span>
                          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {isBackendConfigured && clustersFromBackend.error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-destructive">
                          {clustersFromBackend.error instanceof Error
                            ? clustersFromBackend.error.message
                            : 'Failed to load clusters'}
                        </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => clustersFromBackend.refetch()}
                        disabled={clustersFromBackend.isFetching}
                      >
                        <RefreshCw
                          className={cn('h-4 w-4 mr-1', clustersFromBackend.isFetching && 'animate-spin')}
                        />
                        Retry
                      </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        The desktop app starts the backend automatically. In the browser, run the backend at {DEFAULT_BACKEND_BASE_URL} or open Settings to change the URL.
                      </p>
                    </div>
                  )}

                  {isBackendConfigured &&
                    clustersFromBackend.data &&
                    detectedClusters.length > 0 && (
                      <div className="space-y-2">
                        {detectedClusters.map((cluster) => (
                          <motion.div
                            key={cluster.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`
                              p-4 rounded-lg border transition-all cursor-pointer
                              ${selectedClusterId === cluster.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                              ${cluster.status === 'unhealthy' ? 'opacity-60' : ''}
                            `}
                            onClick={() => setSelectedClusterId(cluster.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(cluster.status)}
                                <div>
                                  <p className="font-medium">{cluster.name}</p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {cluster.server || '—'}
                                  </p>
                                </div>
                              </div>
                              {(cluster.status === 'healthy' || cluster.status === 'unhealthy') && (
                                <>
                                  {cluster.status === 'unhealthy' && (
                                    <Badge variant="destructive" className="text-xs mr-2">
                                      Unreachable
                                    </Badge>
                                  )}
                                  <Button
                                    size="sm"
                                    variant={cluster.status === 'unhealthy' ? 'outline' : 'default'}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConnect(cluster);
                                    }}
                                    disabled={isConnecting}
                                  >
                                    {isConnecting && selectedClusterId === cluster.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        {cluster.status === 'unhealthy' ? 'Try connect' : 'Connect'}
                                        <ArrowRight className="h-4 w-4 ml-1" />
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}

                  {isBackendConfigured &&
                    clustersFromBackend.data &&
                    clustersFromBackend.data.length === 0 &&
                    !clustersFromBackend.isLoading && (
                      <div className="text-center py-8">
                        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground mb-4">
                          No clusters registered. Upload a kubeconfig or add a cluster in Cluster
                          Management.
                        </p>
                        <Button variant="outline" onClick={() => setMode('upload')}>
                          Upload Kubeconfig
                        </Button>
                        <Button
                          variant="outline"
                          className="ml-2"
                          onClick={() => navigate('/setup/clusters')}
                        >
                          Cluster Management
                        </Button>
                      </div>
                    )}
                </Card>
              </TabsContent>

              {/* Upload: send to backend when configured */}
              <TabsContent value="upload">
                <Card className="p-6">
                  {!isBackendConfigured ? (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Set the backend URL in Settings to add clusters by uploading a kubeconfig
                        file.
                      </p>
                      <Button variant="outline" onClick={() => navigate('/settings')}>
                        Open Settings
                      </Button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className={`
                        relative rounded-xl border-2 border-dashed p-12 transition-all duration-300 text-center
                        border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50
                      `}
                    >
                      {isUploading ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-3">
                            <Loader2 className="h-6 w-6 text-primary animate-spin" />
                            <span className="text-lg font-medium">Adding cluster…</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
                            <motion.div
                              className="h-full bg-primary rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4">
                            <Upload className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-lg font-medium mb-2">Drop your kubeconfig here</p>
                          <p className="text-sm text-muted-foreground mb-4">
                            or{' '}
                            <label className="text-primary hover:underline cursor-pointer">
                              browse files
                              <input
                                type="file"
                                className="hidden"
                                accept=".yaml,.yml,.config,*"
                                onChange={(e) =>
                                  e.target.files?.[0] && handleUploadedFile(e.target.files[0])
                                }
                              />
                            </label>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            File is sent to the backend and the cluster is registered. You can then
                            connect from Auto-Detect.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* In-Cluster Mode */}
              <TabsContent value="helm">
                <Card className="p-6">
                  <div className="text-center py-8">
                    <div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4">
                      <Cloud className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">In-Cluster Mode</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      When Kubilitics runs inside a Kubernetes cluster it uses the service account
                      credentials automatically.
                    </p>
                    <Button
                      onClick={() =>
                        handleConnect({
                          id: 'in-cluster',
                          name: 'in-cluster',
                          context: 'in-cluster',
                          server: 'kubernetes.default.svc',
                          status: 'healthy',
                        })
                      }
                      disabled={!isBackendConfigured}
                    >
                      <Terminal className="h-4 w-4 mr-2" />
                      Connect to Current Cluster
                    </Button>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>

          <motion.div variants={item} className="mt-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="mt-4 text-muted-foreground hover:text-foreground"
              onClick={handleDemoMode}
            >
              Try Demo Mode
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <div className="hidden lg:flex w-[400px] bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-primary-foreground"
        >
          <KubernetesLogo size={64} className="mx-auto mb-6 opacity-90" />
          <h2 className="text-2xl font-bold mb-3">The Kubernetes Operating System</h2>
          <p className="text-sm opacity-80 mb-8">
            Make Kubernetes understandable, explorable, and calm.
          </p>
          <div className="space-y-4 text-left">
            {[
              { icon: Monitor, text: 'Desktop-first, works offline' },
              { icon: Server, text: 'Or deploy in-cluster via Helm' },
              { icon: Zap, text: '50+ resource types supported' },
              { icon: Check, text: '100% open source (Apache 2.0)' },
            ].map((point, i) => (
              <motion.div
                key={point.text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="p-1.5 rounded-lg bg-white/20">
                  <point.icon className="h-4 w-4" />
                </div>
                <span className="text-sm opacity-90">{point.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
