/**
 * Cluster Connect Page
 * Entry point for the Kubilitics application (Desktop & Helm modes)
 * Replaces SaaS-style Landing page with cluster connection flow
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { KubernetesLogo } from '@/components/icons/KubernetesIcons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClusterStore } from '@/stores/clusterStore';
import { toast } from 'sonner';

interface DetectedCluster {
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
    transition: { staggerChildren: 0.1 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

// Mock detected clusters for demo
const mockDetectedClusters: DetectedCluster[] = [
  { name: 'production', context: 'prod-us-east-1', server: 'https://api.prod.k8s.io:6443', status: 'healthy', namespace: 'default' },
  { name: 'staging', context: 'staging-us-east-1', server: 'https://api.staging.k8s.io:6443', status: 'healthy', namespace: 'default' },
  { name: 'development', context: 'dev-local', server: 'https://127.0.0.1:6443', status: 'checking' },
];

// Common kubeconfig locations
const kubeconfigLocations = [
  { path: '~/.kube/config', desc: 'Default location' },
  { path: '~/.config/k3s/k3s.yaml', desc: 'K3s config' },
  { path: '$KUBECONFIG', desc: 'Environment variable' },
  { path: '~/.kube/config.d/*', desc: 'Config directory' },
];

export default function ClusterConnect() {
  const navigate = useNavigate();
  const { setActiveCluster, setDemo } = useClusterStore();
  const [mode, setMode] = useState<'auto' | 'upload' | 'helm'>('auto');
  const [isScanning, setIsScanning] = useState(true);
  const [detectedClusters, setDetectedClusters] = useState<DetectedCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Simulate auto-detection on mount
  useEffect(() => {
    const scanClusters = async () => {
      setIsScanning(true);
      // Simulate scanning
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate finding clusters with health checks
      const clusters = [...mockDetectedClusters];
      setDetectedClusters(clusters);
      
      // Simulate health checks completing
      for (let i = 0; i < clusters.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setDetectedClusters(prev => prev.map((c, idx) => 
          idx === i ? { ...c, status: idx < 2 ? 'healthy' : 'unhealthy' } : c
        ));
      }
      
      setIsScanning(false);
    };
    
    if (mode === 'auto') {
      scanClusters();
    }
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      setUploadProgress(i);
    }
    
    // Simulate parsing kubeconfig
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Add detected clusters from file
    setDetectedClusters([
      { name: 'imported-cluster', context: 'imported-ctx', server: 'https://imported.k8s.io:6443', status: 'checking' },
      ...detectedClusters,
    ]);
    
    setIsUploading(false);
    setMode('auto'); // Switch to cluster selection
    toast.success('Kubeconfig parsed successfully', {
      description: 'Found 1 new cluster context'
    });
  };

  const handleConnect = async (cluster: DetectedCluster) => {
    setIsConnecting(true);
    setSelectedCluster(cluster.context);
    
    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Set the active cluster and navigate
    setActiveCluster({
      id: cluster.context,
      name: cluster.name,
      context: cluster.context,
      version: 'v1.28.0',
      status: 'healthy',
      region: 'unknown',
      provider: 'on-prem',
      nodes: 3,
      namespaces: 10,
      pods: { running: 50, pending: 2, failed: 0 },
      cpu: { used: 45, total: 100 },
      memory: { used: 60, total: 100 },
    });
    
    toast.success(`Connected to ${cluster.name}`, {
      description: `Context: ${cluster.context}`
    });
    
    navigate('/dashboard');
  };

  const handleDemoMode = () => {
    setDemo(true);
    navigate('/dashboard');
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

  return (
    <div className="min-h-screen bg-background flex">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial="hidden"
          animate="show"
          variants={container}
          className="w-full max-w-2xl"
        >
          {/* Logo & Header */}
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

          {/* Mode Tabs */}
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

              {/* Auto-Detect Mode */}
              <TabsContent value="auto">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">Detected Clusters</h3>
                      <p className="text-sm text-muted-foreground">
                        Scanning kubeconfig locations...
                      </p>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setMode('auto')}
                      disabled={isScanning}
                    >
                      <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>

                  {/* Scanning locations */}
                  {isScanning && detectedClusters.length === 0 && (
                    <div className="space-y-2 mb-4">
                      {kubeconfigLocations.map((loc, i) => (
                        <motion.div
                          key={loc.path}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.2 }}
                          className="flex items-center gap-3 text-sm text-muted-foreground"
                        >
                          <Folder className="h-4 w-4" />
                          <span className="font-mono">{loc.path}</span>
                          <Loader2 className="h-3 w-3 animate-spin ml-auto" />
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Detected clusters list */}
                  {detectedClusters.length > 0 && (
                    <div className="space-y-2">
                      {detectedClusters.map((cluster) => (
                        <motion.div
                          key={cluster.context}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`
                            p-4 rounded-lg border transition-all cursor-pointer
                            ${selectedCluster === cluster.context 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                            }
                            ${cluster.status === 'unhealthy' ? 'opacity-60' : ''}
                          `}
                          onClick={() => cluster.status === 'healthy' && setSelectedCluster(cluster.context)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(cluster.status)}
                              <div>
                                <p className="font-medium">{cluster.name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{cluster.server}</p>
                              </div>
                            </div>
                            {cluster.status === 'healthy' && (
                              <Button 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConnect(cluster);
                                }}
                                disabled={isConnecting}
                              >
                                {isConnecting && selectedCluster === cluster.context ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    Connect
                                    <ArrowRight className="h-4 w-4 ml-1" />
                                  </>
                                )}
                              </Button>
                            )}
                            {cluster.status === 'unhealthy' && (
                              <Badge variant="destructive" className="text-xs">Unreachable</Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* No clusters found */}
                  {!isScanning && detectedClusters.length === 0 && (
                    <div className="text-center py-8">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        No kubeconfig found in standard locations
                      </p>
                      <Button variant="outline" onClick={() => setMode('upload')}>
                        Upload Kubeconfig
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Upload Mode */}
              <TabsContent value="upload">
                <Card className="p-6">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`
                      relative rounded-xl border-2 border-dashed p-12 transition-all duration-300 text-center
                      ${isDragging
                        ? 'border-primary bg-primary/5 scale-[1.02]'
                        : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50'
                      }
                    `}
                  >
                    {isUploading ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="h-6 w-6 text-primary animate-spin" />
                          <span className="text-lg font-medium">Parsing kubeconfig...</span>
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
                              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports YAML kubeconfig files
                        </p>
                      </>
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* In-Cluster Mode */}
              <TabsContent value="helm">
                <Card className="p-6">
                  <div className="text-center py-8">
                    <div className="p-4 rounded-2xl bg-primary/10 w-fit mx-auto mb-4">
                      <Cloud className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">In-Cluster Mode Detected</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Kubilitics is running inside a Kubernetes cluster. 
                      It will automatically use the service account credentials.
                    </p>
                    <Button onClick={() => handleConnect({
                      name: 'in-cluster',
                      context: 'in-cluster',
                      server: 'kubernetes.default.svc',
                      status: 'healthy'
                    })}>
                      <Terminal className="h-4 w-4 mr-2" />
                      Connect to Current Cluster
                    </Button>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </motion.div>

          {/* Demo Mode */}
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

      {/* Right Side Branding */}
      <div className="hidden lg:flex w-[400px] bg-gradient-to-br from-primary to-primary/80 items-center justify-center p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="text-center text-primary-foreground"
        >
          <KubernetesLogo size={64} className="mx-auto mb-6 opacity-90" />
          <h2 className="text-2xl font-bold mb-3">
            The Kubernetes Operating System
          </h2>
          <p className="text-sm opacity-80 mb-8">
            Make Kubernetes understandable, explorable, and calm.
          </p>

          {/* Key Points */}
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
