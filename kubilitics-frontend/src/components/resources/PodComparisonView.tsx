import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  GitCompare, 
  FileText, 
  Activity, 
  ScrollText,
  ChevronDown,
  Plus,
  Minus,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkline } from './PodSparkline';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PodForComparison {
  name: string;
  namespace: string;
  status: string;
  yaml: string;
  metrics: {
    cpu: { data: number[]; value: string };
    memory: { data: number[]; value: string };
  };
  logs: string[];
}

interface PodComparisonViewProps {
  open: boolean;
  onClose: () => void;
  availablePods: Array<{ name: string; namespace: string; status: string }>;
}

// Mock YAML generator
function generateMockYaml(name: string, namespace: string): string {
  return `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
    app: ${name.split('-')[0]}
spec:
  containers:
  - name: main
    image: nginx:latest
    ports:
    - containerPort: 80
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 500m
        memory: 512Mi
`;
}

// Mock logs generator
function generateMockLogs(name: string): string[] {
  const now = new Date();
  return [
    `${now.toISOString()} [INFO] Starting ${name}...`,
    `${now.toISOString()} [INFO] Container initialized`,
    `${now.toISOString()} [INFO] Health check passed`,
    `${now.toISOString()} [DEBUG] Processing request batch`,
    `${now.toISOString()} [INFO] Connection established`,
    `${now.toISOString()} [WARN] High memory usage detected`,
    `${now.toISOString()} [INFO] Cache refreshed`,
    `${now.toISOString()} [DEBUG] Metrics collected`,
  ];
}

export function PodComparisonView({ open, onClose, availablePods }: PodComparisonViewProps) {
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('yaml');

  const podsData: PodForComparison[] = useMemo(() => {
    return selectedPods.map(podKey => {
      const [namespace, name] = podKey.split('/');
      const pod = availablePods.find(p => p.name === name && p.namespace === namespace);
      return {
        name: name || '',
        namespace: namespace || '',
        status: pod?.status || 'Unknown',
        yaml: generateMockYaml(name || '', namespace || ''),
        metrics: {
          cpu: {
            data: Array.from({ length: 20 }, () => Math.random() * 80 + 10),
            value: `${Math.round(Math.random() * 80 + 10)}m`,
          },
          memory: {
            data: Array.from({ length: 20 }, () => Math.random() * 300 + 50),
            value: `${Math.round(Math.random() * 300 + 50)}Mi`,
          },
        },
        logs: generateMockLogs(name || ''),
      };
    });
  }, [selectedPods, availablePods]);

  const handleAddPod = (podKey: string) => {
    if (selectedPods.length >= 4) {
      toast.error('Maximum 4 pods can be compared at once');
      return;
    }
    if (!selectedPods.includes(podKey)) {
      setSelectedPods([...selectedPods, podKey]);
    }
  };

  const handleRemovePod = (podKey: string) => {
    setSelectedPods(selectedPods.filter(p => p !== podKey));
  };

  const handleExportComparison = () => {
    const comparison = {
      timestamp: new Date().toISOString(),
      pods: podsData.map(p => ({
        name: p.name,
        namespace: p.namespace,
        status: p.status,
        yaml: p.yaml,
        metrics: {
          cpu: p.metrics.cpu.value,
          memory: p.metrics.memory.value,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pod-comparison.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Comparison exported');
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-7xl max-h-[90vh] flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <GitCompare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Pod Comparison</h2>
              <p className="text-sm text-muted-foreground">
                Compare YAML, metrics, and logs side-by-side
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportComparison} disabled={podsData.length < 2}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Pod Selection */}
        <div className="px-6 py-3 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Select pods to compare:</span>
            <Select onValueChange={handleAddPod}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Add pod..." />
              </SelectTrigger>
              <SelectContent>
                {availablePods
                  .filter(p => !selectedPods.includes(`${p.namespace}/${p.name}`))
                  .map(pod => (
                    <SelectItem key={`${pod.namespace}/${pod.name}`} value={`${pod.namespace}/${pod.name}`}>
                      <span className="font-medium">{pod.name}</span>
                      <span className="text-muted-foreground ml-2">({pod.namespace})</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 flex-1 overflow-x-auto">
              {selectedPods.map(podKey => {
                const [namespace, name] = podKey.split('/');
                return (
                  <Badge key={podKey} variant="secondary" className="gap-1.5 shrink-0">
                    {name}
                    <button onClick={() => handleRemovePod(podKey)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-2 border-b">
            <TabsList>
              <TabsTrigger value="yaml" className="gap-1.5">
                <FileText className="h-4 w-4" />
                YAML
              </TabsTrigger>
              <TabsTrigger value="metrics" className="gap-1.5">
                <Activity className="h-4 w-4" />
                Metrics
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5">
                <ScrollText className="h-4 w-4" />
                Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="yaml" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {podsData.length < 2 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <GitCompare className="h-12 w-12 mb-4 opacity-50" />
                      <p>Select at least 2 pods to compare</p>
                    </div>
                  ) : (
                    <div className={cn(
                      'grid gap-4',
                      podsData.length === 2 && 'grid-cols-2',
                      podsData.length === 3 && 'grid-cols-3',
                      podsData.length >= 4 && 'grid-cols-4'
                    )}>
                      {podsData.map((pod, index) => (
                        <Card key={`${pod.namespace}/${pod.name}`}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium truncate">{pod.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">{pod.namespace}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <ScrollArea className="h-80">
                              <pre className="p-4 text-xs font-mono whitespace-pre bg-muted/30">
                                {pod.yaml}
                              </pre>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="metrics" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {podsData.length < 2 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <Activity className="h-12 w-12 mb-4 opacity-50" />
                      <p>Select at least 2 pods to compare metrics</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* CPU Comparison */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">CPU Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={cn(
                            'grid gap-4',
                            podsData.length === 2 && 'grid-cols-2',
                            podsData.length === 3 && 'grid-cols-3',
                            podsData.length >= 4 && 'grid-cols-4'
                          )}>
                            {podsData.map(pod => (
                              <div key={`${pod.namespace}/${pod.name}-cpu`} className="p-4 rounded-lg bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium truncate">{pod.name}</span>
                                  <Badge variant="secondary">{pod.metrics.cpu.value}</Badge>
                                </div>
                                <Sparkline 
                                  data={pod.metrics.cpu.data} 
                                  width={200} 
                                  height={40}
                                  color="hsl(var(--primary))"
                                  showLive
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      {/* Memory Comparison */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Memory Usage</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={cn(
                            'grid gap-4',
                            podsData.length === 2 && 'grid-cols-2',
                            podsData.length === 3 && 'grid-cols-3',
                            podsData.length >= 4 && 'grid-cols-4'
                          )}>
                            {podsData.map(pod => (
                              <div key={`${pod.namespace}/${pod.name}-mem`} className="p-4 rounded-lg bg-muted/30">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium truncate">{pod.name}</span>
                                  <Badge variant="secondary">{pod.metrics.memory.value}</Badge>
                                </div>
                                <Sparkline 
                                  data={pod.metrics.memory.data} 
                                  width={200} 
                                  height={40}
                                  color="hsl(142, 76%, 36%)"
                                  showLive
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="logs" className="h-full m-0">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {podsData.length < 2 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <ScrollText className="h-12 w-12 mb-4 opacity-50" />
                      <p>Select at least 2 pods to compare logs</p>
                    </div>
                  ) : (
                    <div className={cn(
                      'grid gap-4',
                      podsData.length === 2 && 'grid-cols-2',
                      podsData.length === 3 && 'grid-cols-3',
                      podsData.length >= 4 && 'grid-cols-4'
                    )}>
                      {podsData.map(pod => (
                        <Card key={`${pod.namespace}/${pod.name}-logs`}>
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium truncate">{pod.name}</CardTitle>
                              <Badge variant="outline" className="text-xs">{pod.namespace}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="p-0">
                            <ScrollArea className="h-80">
                              <div className="p-4 space-y-1 font-mono text-xs bg-muted/30">
                                {pod.logs.map((log, i) => (
                                  <div 
                                    key={i} 
                                    className={cn(
                                      'py-0.5',
                                      log.includes('[WARN]') && 'text-[hsl(45,93%,47%)]',
                                      log.includes('[ERROR]') && 'text-[hsl(0,72%,51%)]',
                                      log.includes('[DEBUG]') && 'text-muted-foreground'
                                    )}
                                  >
                                    {log}
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </motion.div>
  );
}
