import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database,
  Clock,
  Server,
  RotateCcw,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
  Activity,
  Scale,
  HardDrive,
  History,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  MetricsDashboard,
  NodeDetailPopup,
  ScaleDialog,
  RolloutActionsDialog,
  DeleteConfirmDialog,
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

interface StatefulSetResource extends KubernetesResource {
  spec?: {
    replicas?: number;
    serviceName?: string;
    podManagementPolicy?: string;
    updateStrategy?: { type?: string; rollingUpdate?: { partition?: number } };
    selector?: { matchLabels?: Record<string, string> };
    template?: {
      spec?: {
        containers?: Array<{
          name: string;
          image: string;
          ports?: Array<{ containerPort: number; protocol?: string }>;
          resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
        }>;
      };
    };
    volumeClaimTemplates?: Array<{
      metadata?: { name: string };
      spec?: { storageClassName?: string; resources?: { requests?: { storage?: string } } };
    }>;
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    currentReplicas?: number;
    updatedReplicas?: number;
  };
}

const mockStatefulSetResource: StatefulSetResource = {
  apiVersion: 'apps/v1',
  kind: 'StatefulSet',
  metadata: {
    name: 'postgres-primary',
    namespace: 'production',
    uid: 'sts-123-456',
    creationTimestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'postgres', tier: 'database' },
  },
  spec: {
    replicas: 3,
    serviceName: 'postgres-headless',
    podManagementPolicy: 'OrderedReady',
    updateStrategy: { type: 'RollingUpdate', rollingUpdate: { partition: 0 } },
    selector: { matchLabels: { app: 'postgres' } },
    template: {
      spec: {
        containers: [{
          name: 'postgres',
          image: 'postgres:15.4',
          ports: [{ containerPort: 5432, protocol: 'TCP' }],
          resources: { requests: { cpu: '500m', memory: '1Gi' }, limits: { cpu: '2', memory: '4Gi' } },
        }],
      },
    },
    volumeClaimTemplates: [{
      metadata: { name: 'data' },
      spec: { storageClassName: 'standard', resources: { requests: { storage: '100Gi' } } },
    }],
  },
  status: {
    replicas: 3,
    readyReplicas: 3,
    currentReplicas: 3,
    updatedReplicas: 3,
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'statefulset', type: 'statefulset', name: 'postgres-primary', namespace: 'production', status: 'healthy', isCurrent: true },
  { id: 'service', type: 'service', name: 'postgres-headless', namespace: 'production', status: 'healthy' },
  { id: 'pod-0', type: 'pod', name: 'postgres-primary-0', namespace: 'production', status: 'healthy' },
  { id: 'pod-1', type: 'pod', name: 'postgres-primary-1', namespace: 'production', status: 'healthy' },
  { id: 'pod-2', type: 'pod', name: 'postgres-primary-2', namespace: 'production', status: 'healthy' },
  { id: 'pvc-0', type: 'pvc', name: 'data-postgres-primary-0', namespace: 'production', status: 'healthy' },
  { id: 'pvc-1', type: 'pvc', name: 'data-postgres-primary-1', namespace: 'production', status: 'healthy' },
  { id: 'pvc-2', type: 'pvc', name: 'data-postgres-primary-2', namespace: 'production', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'statefulset', to: 'pod-0', label: 'Manages' },
  { from: 'statefulset', to: 'pod-1', label: 'Manages' },
  { from: 'statefulset', to: 'pod-2', label: 'Manages' },
  { from: 'service', to: 'pod-0', label: 'Routes to' },
  { from: 'service', to: 'pod-1', label: 'Routes to' },
  { from: 'service', to: 'pod-2', label: 'Routes to' },
  { from: 'pod-0', to: 'pvc-0', label: 'Mounts' },
  { from: 'pod-1', to: 'pvc-1', label: 'Mounts' },
  { from: 'pod-2', to: 'pvc-2', label: 'Mounts' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: postgres-primary-0', time: '60d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: postgres-primary-1', time: '60d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: postgres-primary-2', time: '60d ago' },
];

export default function StatefulSetDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [showRolloutDialog, setShowRolloutDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: statefulSet, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<StatefulSetResource>(
    'statefulsets',
    name,
    namespace,
    mockStatefulSetResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteStatefulSet = useDeleteK8sResource('statefulsets');
  const updateStatefulSet = useUpdateK8sResource('statefulsets');

  const status: ResourceStatus = statefulSet.status?.readyReplicas === statefulSet.spec?.replicas ? 'Running' : 
    statefulSet.status?.readyReplicas ? 'Pending' : 'Failed';
  
  const desired = statefulSet.spec?.replicas || 0;
  const ready = statefulSet.status?.readyReplicas || 0;
  const current = statefulSet.status?.currentReplicas || 0;
  const updated = statefulSet.status?.updatedReplicas || 0;
  
  const containers: ContainerInfo[] = (statefulSet.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: true,
    restartCount: 0,
    state: 'running',
    ports: c.ports?.map(p => ({ containerPort: p.containerPort, protocol: p.protocol || 'TCP' })) || [],
    resources: c.resources || {},
    currentUsage: { cpu: Math.floor(Math.random() * 40) + 10, memory: Math.floor(Math.random() * 50) + 20 },
  }));

  const volumeClaimTemplates = statefulSet.spec?.volumeClaimTemplates || [];

  const handleNodeClick = useCallback((node: TopologyNode) => {
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
    a.download = `${statefulSet.metadata?.name || 'statefulset'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, statefulSet.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleScale = useCallback(async (replicas: number) => {
    toast.success(`Scaled ${name} to ${replicas} replicas ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleRestart = useCallback(async () => {
    toast.success(`Rollout restart initiated for ${name} ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleRollback = useCallback(async (revision: number) => {
    toast.success(`Rolling back ${name} to revision ${revision} ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updateStatefulSet.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('StatefulSet updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('StatefulSet updated (demo mode)');
    }
  }, [isConnected, name, namespace, updateStatefulSet, refetch]);

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
    { label: 'Ready', value: `${ready}/${desired}`, icon: Server, iconColor: ready === desired ? 'success' as const : 'warning' as const },
    { label: 'Current', value: current, icon: Activity, iconColor: 'info' as const },
    { label: 'Updated', value: updated, icon: RefreshCw, iconColor: 'success' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('replicas: 3', 'replicas: 2'), timestamp: '1 week ago' },
  ];

  const displayEvents = isConnected && events.length > 0 ? events : mockEvents;

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">StatefulSet Information</CardTitle>
                <CardDescription>Configuration and update strategy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Service Name</p>
                    <Button
                      variant="link"
                      className="h-auto p-0 font-mono"
                      onClick={() => navigate(`/services/${namespace}/${statefulSet.spec?.serviceName}`)}
                    >
                      {statefulSet.spec?.serviceName || '-'}
                    </Button>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Pod Management</p>
                    <Badge variant="outline">{statefulSet.spec?.podManagementPolicy || 'OrderedReady'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Update Strategy</p>
                    <Badge variant="outline">{statefulSet.spec?.updateStrategy?.type || 'RollingUpdate'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Partition</p>
                    <p className="font-mono">{statefulSet.spec?.updateStrategy?.rollingUpdate?.partition ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Replica Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Ready</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(ready / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{ready}/{desired}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(current / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{current}/{desired}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Updated</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(updated / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{updated}/{desired}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {volumeClaimTemplates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Volume Claim Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {volumeClaimTemplates.map((vct, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{vct.metadata?.name || `volume-${i}`}</p>
                        <p className="text-xs text-muted-foreground">
                          Storage Class: {vct.spec?.storageClassName || 'default'}
                        </p>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        {vct.spec?.resources?.requests?.storage || 'N/A'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetadataCard title="Labels" items={statefulSet.metadata?.labels || {}} variant="badges" />
            <MetadataCard title="Selector" items={statefulSet.spec?.selector?.matchLabels || {}} variant="default" />
          </div>
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
      content: <YamlViewer yaml={yaml} resourceName={statefulSet.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={statefulSet.metadata?.name || ''} />,
    },
    {
      id: 'topology',
      label: 'Topology',
      content: (
        <>
          <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} />
          <NodeDetailPopup resource={selectedNode} onClose={() => setSelectedNode(null)} />
        </>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Scale, label: 'Scale StatefulSet', description: 'Adjust the number of replicas', onClick: () => setShowScaleDialog(true) },
          { icon: RotateCcw, label: 'Rollout Restart', description: 'Trigger a rolling restart', onClick: () => setShowRolloutDialog(true) },
          { icon: History, label: 'Rollout History', description: 'View and manage revisions', onClick: () => setShowRolloutDialog(true) },
          { icon: Download, label: 'Download YAML', description: 'Export StatefulSet definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete StatefulSet', description: 'Permanently remove this StatefulSet', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="StatefulSet"
        resourceIcon={Database}
        name={statefulSet.metadata?.name || ''}
        namespace={statefulSet.metadata?.namespace}
        status={status}
        backLink="/statefulsets"
        backLabel="StatefulSets"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Server className="h-3.5 w-3.5" />
            {statefulSet.spec?.serviceName}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Scale', icon: Scale, variant: 'outline', onClick: () => setShowScaleDialog(true) },
          { label: 'Restart', icon: RotateCcw, variant: 'outline', onClick: () => setShowRolloutDialog(true) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScaleDialog
        open={showScaleDialog}
        onOpenChange={setShowScaleDialog}
        resourceType="StatefulSet"
        resourceName={statefulSet.metadata?.name || ''}
        namespace={statefulSet.metadata?.namespace}
        currentReplicas={desired}
        onScale={handleScale}
      />

      <RolloutActionsDialog
        open={showRolloutDialog}
        onOpenChange={setShowRolloutDialog}
        resourceType="StatefulSet"
        resourceName={statefulSet.metadata?.name || ''}
        namespace={statefulSet.metadata?.namespace}
        onRestart={handleRestart}
        onRollback={handleRollback}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="StatefulSet"
        resourceName={statefulSet.metadata?.name || ''}
        namespace={statefulSet.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteStatefulSet.mutateAsync({ name, namespace });
            navigate('/statefulsets');
          } else {
            toast.success(`StatefulSet ${name} deleted (demo mode)`);
            navigate('/statefulsets');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
