import { useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Box,
  Clock,
  Server,
  RotateCcw,
  RefreshCw,
  Download,
  Trash2,
  Terminal,
  FileText,
  ExternalLink,
  Loader2,
  Copy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu,
  MemoryStick,
  Network,
  HardDrive,
  Activity,
  Play,
  Pause,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  ResourceHeader,
  ResourceStatusCards,
  ResourceTabs,
  TopologyViewer,
  ContainersSection,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  MetadataCard,
  ActionsSection,
  LogViewer,
  TerminalViewer,
  DeleteConfirmDialog,
  PortForwardDialog,
  MetricsDashboard,
  NodeDetailPopup,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type ContainerInfo,
  type YamlVersion,
  type ResourceDetail,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { cn } from '@/lib/utils';

interface PodResource extends KubernetesResource {
  status?: {
    phase?: string;
    podIP?: string;
    hostIP?: string;
    qosClass?: string;
    startTime?: string;
    conditions?: Array<{ type: string; status: string; lastTransitionTime: string; reason?: string; message?: string }>;
    containerStatuses?: Array<{
      name: string;
      ready: boolean;
      restartCount: number;
      state: { running?: { startedAt?: string }; waiting?: { reason: string; message?: string }; terminated?: { reason: string; exitCode?: number } };
      image: string;
      imageID?: string;
      containerID?: string;
    }>;
  };
  spec?: {
    nodeName?: string;
    serviceAccountName?: string;
    restartPolicy?: string;
    dnsPolicy?: string;
    terminationGracePeriodSeconds?: number;
    priority?: number;
    containers?: Array<{
      name: string;
      image: string;
      ports?: Array<{ containerPort: number; protocol: string; name?: string }>;
      resources?: {
        requests?: { cpu?: string; memory?: string };
        limits?: { cpu?: string; memory?: string };
      };
      env?: Array<{ name: string; value?: string; valueFrom?: any }>;
      volumeMounts?: Array<{ name: string; mountPath: string; readOnly?: boolean }>;
      livenessProbe?: any;
      readinessProbe?: any;
    }>;
    volumes?: Array<{ name: string; configMap?: { name: string }; secret?: { secretName: string }; emptyDir?: {}; persistentVolumeClaim?: { claimName: string } }>;
    affinity?: any;
    tolerations?: Array<{ key?: string; operator?: string; value?: string; effect?: string }>;
    nodeSelector?: Record<string, string>;
  };
}

const mockPodResource: PodResource = {
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name: 'nginx-deployment-7fb96c846b-abc12',
    namespace: 'production',
    uid: 'cd68340d-d81f-4095-a733-df860f6724f1',
    creationTimestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { 
      app: 'nginx', 
      version: 'v1.0.0', 
      environment: 'production',
      'pod-template-hash': '7fb96c846b',
    },
    annotations: {
      'kubernetes.io/psp': 'eks.privileged',
      'kubectl.kubernetes.io/last-applied-configuration': '{"apiVersion":"v1","kind":"Pod",...}',
    },
    ownerReferences: [{
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      name: 'nginx-deployment-7fb96c846b',
      uid: 'abc-123',
    }],
  },
  status: {
    phase: 'Running',
    podIP: '10.244.1.45',
    hostIP: '192.168.1.10',
    qosClass: 'Burstable',
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    conditions: [
      { type: 'Initialized', status: 'True', lastTransitionTime: new Date().toISOString() },
      { type: 'Ready', status: 'True', lastTransitionTime: new Date().toISOString() },
      { type: 'ContainersReady', status: 'True', lastTransitionTime: new Date().toISOString() },
      { type: 'PodScheduled', status: 'True', lastTransitionTime: new Date().toISOString() },
    ],
    containerStatuses: [
      { 
        name: 'nginx', 
        ready: true, 
        restartCount: 0, 
        state: { running: { startedAt: new Date().toISOString() } }, 
        image: 'nginx:1.25.3',
        imageID: 'docker-pullable://nginx@sha256:abc123...',
        containerID: 'containerd://xyz789...',
      },
    ],
  },
  spec: {
    nodeName: 'worker-node-1',
    serviceAccountName: 'default',
    restartPolicy: 'Always',
    dnsPolicy: 'ClusterFirst',
    terminationGracePeriodSeconds: 30,
    containers: [
      {
        name: 'nginx',
        image: 'nginx:1.25.3',
        ports: [{ containerPort: 80, protocol: 'TCP', name: 'http' }],
        resources: { 
          requests: { cpu: '100m', memory: '128Mi' }, 
          limits: { cpu: '200m', memory: '256Mi' } 
        },
        env: [
          { name: 'NGINX_PORT', value: '80' },
          { name: 'ENVIRONMENT', value: 'production' },
        ],
        volumeMounts: [
          { name: 'config-volume', mountPath: '/etc/nginx/conf.d' },
          { name: 'cache-volume', mountPath: '/var/cache/nginx' },
        ],
        livenessProbe: {
          httpGet: { path: '/health', port: 80 },
          initialDelaySeconds: 30,
          periodSeconds: 10,
        },
        readinessProbe: {
          httpGet: { path: '/ready', port: 80 },
          initialDelaySeconds: 5,
          periodSeconds: 5,
        },
      },
    ],
    volumes: [
      { name: 'config-volume', configMap: { name: 'nginx-config' } },
      { name: 'cache-volume', emptyDir: {} },
    ],
    tolerations: [
      { key: 'node.kubernetes.io/not-ready', operator: 'Exists', effect: 'NoExecute' },
    ],
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', namespace: 'production', status: 'healthy' },
  { id: 'replicaset', type: 'replicaset', name: 'nginx-deployment-7fb96c846b', namespace: 'production', status: 'healthy' },
  { id: 'pod', type: 'pod', name: 'nginx-deployment-7fb96c846b-abc12', namespace: 'production', status: 'healthy', isCurrent: true, traffic: 75 },
  { id: 'pod2', type: 'pod', name: 'nginx-deployment-7fb96c846b-def34', namespace: 'production', status: 'healthy', traffic: 60 },
  { id: 'service', type: 'service', name: 'nginx-svc', namespace: 'production', status: 'healthy', traffic: 85 },
  { id: 'ingress', type: 'ingress', name: 'nginx-ingress', namespace: 'production', status: 'healthy' },
  { id: 'configmap', type: 'configmap', name: 'nginx-config', namespace: 'production', status: 'healthy' },
  { id: 'node', type: 'node', name: 'worker-node-1', status: 'healthy' },
  { id: 'endpoint', type: 'endpoint', name: 'nginx-svc', namespace: 'production', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'deployment', to: 'replicaset', label: 'Creates' },
  { from: 'replicaset', to: 'pod', label: 'Manages', traffic: 75 },
  { from: 'replicaset', to: 'pod2', label: 'Manages', traffic: 60 },
  { from: 'service', to: 'pod', label: 'Routes to', traffic: 40 },
  { from: 'service', to: 'pod2', label: 'Routes to', traffic: 35 },
  { from: 'service', to: 'endpoint', label: 'Creates' },
  { from: 'ingress', to: 'service', label: 'Exposes', traffic: 85 },
  { from: 'pod', to: 'node', label: 'Runs on' },
  { from: 'pod', to: 'configmap', label: 'Mounts' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'Scheduled', message: 'Successfully assigned production/nginx-deployment-7fb96c846b-abc12 to worker-node-1', time: '2 days ago' },
  { type: 'Normal' as const, reason: 'Pulling', message: 'Pulling image "nginx:1.25.3"', time: '2 days ago' },
  { type: 'Normal' as const, reason: 'Pulled', message: 'Successfully pulled image "nginx:1.25.3" in 3.2s', time: '2 days ago' },
  { type: 'Normal' as const, reason: 'Created', message: 'Created container nginx', time: '2 days ago' },
  { type: 'Normal' as const, reason: 'Started', message: 'Started container nginx', time: '2 days ago' },
];

export default function PodDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedLogContainer, setSelectedLogContainer] = useState<string | undefined>(undefined);
  const [selectedTerminalContainer, setSelectedTerminalContainer] = useState<string | undefined>(undefined);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPortForwardDialog, setShowPortForwardDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: pod, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<PodResource>(
    'pods',
    name,
    namespace,
    mockPodResource
  );
  const { events } = useK8sEvents(namespace);
  const deletePod = useDeleteK8sResource('pods');
  const updatePod = useUpdateK8sResource('pods');

  const status = pod.status?.phase as ResourceStatus || 'Unknown';
  const conditions = pod.status?.conditions || [];
  const containerStatuses = pod.status?.containerStatuses || [];
  const readyContainers = containerStatuses.filter(c => c.ready).length;
  const totalRestarts = containerStatuses.reduce((sum, c) => sum + c.restartCount, 0);
  
  const containers: ContainerInfo[] = (pod.spec?.containers || []).map(c => {
    const status = containerStatuses.find(s => s.name === c.name);
    return {
      name: c.name,
      image: c.image,
      ready: status?.ready || false,
      restartCount: status?.restartCount || 0,
      state: status?.state?.running ? 'running' : status?.state?.waiting ? 'waiting' : 'terminated',
      stateReason: status?.state?.waiting?.reason || status?.state?.terminated?.reason,
      ports: c.ports || [],
      resources: c.resources || {},
      currentUsage: { cpu: Math.floor(Math.random() * 40) + 10, memory: Math.floor(Math.random() * 50) + 20 },
    };
  });

  const handleNodeClick = useCallback((node: TopologyNode) => {
    // Convert TopologyNode to ResourceDetail for popup
    const resourceDetail: ResourceDetail = {
      id: node.id,
      type: node.type as any,
      name: node.name,
      namespace: node.namespace,
      status: node.status,
    };
    setSelectedNode(resourceDetail);
  }, []);

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pod.metadata?.name || 'pod'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, pod.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleRestartPod = useCallback(async () => {
    if (isConnected && name && namespace) {
      try {
        await deletePod.mutateAsync({ name, namespace });
        toast.success('Pod restarted (deleted for recreation by controller)');
      } catch (error: any) {
        toast.error(`Failed to restart: ${error.message}`);
      }
    } else {
      toast.success('Pod restart initiated (demo mode)');
    }
  }, [isConnected, name, namespace, deletePod]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updatePod.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('Pod updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('Pod updated (demo mode)');
    }
  }, [isConnected, name, namespace, updatePod, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statusCards = [
    { label: 'Ready', value: `${readyContainers}/${containers.length}`, icon: Server, iconColor: 'success' as const },
    { label: 'Restarts', value: totalRestarts, icon: RotateCcw, iconColor: totalRestarts > 0 ? 'warning' as const : 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
    { label: 'QoS Class', value: pod.status?.qosClass || 'Unknown', icon: Activity, iconColor: 'muted' as const },
  ];

  const volumes = (pod.spec?.volumes || []).map(v => ({
    name: v.name,
    type: v.configMap ? 'ConfigMap' : v.secret ? 'Secret' : v.persistentVolumeClaim ? 'PVC' : v.emptyDir ? 'EmptyDir' : 'Other',
    source: v.configMap?.name || v.secret?.secretName || v.persistentVolumeClaim?.claimName || 'N/A',
  }));
  
  const podName = pod.metadata?.name || '';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('restartCount: 0', 'restartCount: 1').replace('phase: Running', 'phase: Running'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('phase: Running', 'phase: Pending').replace('ready: true', 'ready: false'), timestamp: '2 days ago' },
  ];

  const displayEvents = isConnected && events.length > 0 ? events : mockEvents;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pod Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pod Information</CardTitle>
                <CardDescription>Basic details about this pod</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Pod IP</p>
                    <div className="flex items-center gap-2">
                      <p className="font-mono">{pod.status?.podIP || '-'}</p>
                      {pod.status?.podIP && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => { navigator.clipboard.writeText(pod.status?.podIP || ''); toast.success('Copied'); }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Host IP</p>
                    <p className="font-mono">{pod.status?.hostIP || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Node</p>
                    <Button 
                      variant="link" 
                      className="h-auto p-0 font-mono"
                      onClick={() => navigate(`/nodes/${pod.spec?.nodeName}`)}
                    >
                      {pod.spec?.nodeName || '-'}
                    </Button>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">QoS Class</p>
                    <Badge variant="outline">{pod.status?.qosClass || '-'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Service Account</p>
                    <p className="font-mono text-xs">{pod.spec?.serviceAccountName || 'default'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Restart Policy</p>
                    <p>{pod.spec?.restartPolicy || 'Always'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">DNS Policy</p>
                    <p>{pod.spec?.dnsPolicy || 'ClusterFirst'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Termination Grace</p>
                    <p>{pod.spec?.terminationGracePeriodSeconds || 30}s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conditions</CardTitle>
                <CardDescription>Current pod condition status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conditions.map((condition) => {
                    const isTrue = condition.status === 'True';
                    return (
                      <div key={condition.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          {isTrue ? (
                            <CheckCircle2 className="h-5 w-5 text-[hsl(142,76%,36%)]" />
                          ) : (
                            <XCircle className="h-5 w-5 text-[hsl(0,72%,51%)]" />
                          )}
                          <div>
                            <p className="font-medium text-sm">{condition.type}</p>
                            {condition.message && (
                              <p className="text-xs text-muted-foreground">{condition.message}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(condition.lastTransitionTime).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Labels */}
            <MetadataCard title="Labels" items={pod.metadata?.labels || {}} variant="badges" />

            {/* Volumes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Volumes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {volumes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No volumes configured</p>
                ) : (
                  <div className="space-y-3">
                    {volumes.map((volume) => (
                      <div key={volume.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{volume.name}</p>
                          <p className="text-xs text-muted-foreground">{volume.type}</p>
                        </div>
                        <Badge variant="outline" className="font-mono text-xs">{volume.source}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Annotations */}
          {pod.metadata?.annotations && Object.keys(pod.metadata.annotations).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Annotations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(pod.metadata.annotations).slice(0, 5).map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-muted/50">
                      <p className="font-mono text-xs text-primary break-all">{key}</p>
                      <p className="text-xs text-muted-foreground mt-1 break-all">
                        {typeof value === 'string' && value.length > 200 ? `${value.substring(0, 200)}...` : value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    {
      id: 'containers',
      label: 'Containers',
      badge: containers.length.toString(),
      content: <ContainersSection containers={containers} />,
    },
    {
      id: 'logs',
      label: 'Logs',
      content: (
        <LogViewer 
          podName={name}
          namespace={namespace}
          containerName={selectedLogContainer || containers[0]?.name}
          containers={containers.map(c => c.name)}
          onContainerChange={setSelectedLogContainer}
        />
      ),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      content: (
        <TerminalViewer 
          podName={name}
          namespace={namespace}
          containerName={selectedTerminalContainer || containers[0]?.name}
          containers={containers.map(c => c.name)}
          onContainerChange={setSelectedTerminalContainer}
        />
      ),
    },
    {
      id: 'events',
      label: 'Events',
      badge: displayEvents.length.toString(),
      content: <EventsSection events={displayEvents} />,
    },
    {
      id: 'metrics',
      label: 'Metrics',
      content: <MetricsDashboard resourceType="pod" resourceName={name} namespace={namespace} />,
    },
    {
      id: 'yaml',
      label: 'YAML',
      content: <YamlViewer yaml={yaml} resourceName={podName} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={podName} />,
    },
    {
      id: 'topology',
      label: 'Topology',
      content: (
        <>
          <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} />
          <NodeDetailPopup 
            resource={selectedNode} 
            onClose={() => setSelectedNode(null)} 
          />
        </>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { 
            icon: Terminal, 
            label: 'Execute Shell', 
            description: 'Open interactive terminal in container',
            onClick: () => setActiveTab('terminal'),
          },
          { 
            icon: FileText, 
            label: 'View Logs', 
            description: 'Stream logs from container',
            onClick: () => setActiveTab('logs'),
          },
          { 
            icon: ExternalLink, 
            label: 'Port Forward', 
            description: 'Forward local port to container',
            onClick: () => setShowPortForwardDialog(true),
          },
          { 
            icon: RotateCcw, 
            label: 'Restart Pod', 
            description: 'Delete and recreate the pod',
            onClick: handleRestartPod,
          },
          { 
            icon: Download, 
            label: 'Download YAML', 
            description: 'Export pod definition',
            onClick: handleDownloadYaml,
          },
          { 
            icon: Trash2, 
            label: 'Delete Pod', 
            description: 'Permanently remove this pod', 
            variant: 'destructive',
            onClick: () => setShowDeleteDialog(true),
          },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Pod"
        resourceIcon={Box}
        name={pod.metadata?.name || ''}
        namespace={pod.metadata?.namespace}
        status={status}
        backLink="/pods"
        backLabel="Pods"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Server className="h-3.5 w-3.5" />
            {pod.spec?.nodeName || '-'}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Port Forward', icon: ExternalLink, variant: 'outline', onClick: () => setShowPortForwardDialog(true) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="Pod"
        resourceName={pod.metadata?.name || ''}
        namespace={pod.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deletePod.mutateAsync({ name, namespace });
            navigate('/pods');
          } else {
            toast.success(`Pod ${name} deleted (demo mode)`);
            navigate('/pods');
          }
        }}
      />

      {/* Port Forward Dialog */}
      <PortForwardDialog
        open={showPortForwardDialog}
        onOpenChange={setShowPortForwardDialog}
        podName={pod.metadata?.name || ''}
        namespace={pod.metadata?.namespace || ''}
        containers={(pod.spec?.containers || []).map(c => ({
          name: c.name,
          ports: c.ports,
        }))}
      />
    </motion.div>
  );
}
