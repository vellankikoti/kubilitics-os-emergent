import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Container,
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

interface DeploymentResource extends KubernetesResource {
  spec?: {
    replicas?: number;
    strategy?: { type: string; rollingUpdate?: { maxSurge?: string; maxUnavailable?: string } };
    selector?: { matchLabels?: Record<string, string> };
    template?: {
      spec?: {
        containers?: Array<{
          name: string;
          image: string;
          ports?: Array<{ containerPort: number; protocol: string; name?: string }>;
          resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
          env?: Array<{ name: string; value?: string }>;
        }>;
      };
    };
    minReadySeconds?: number;
    revisionHistoryLimit?: number;
    progressDeadlineSeconds?: number;
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    updatedReplicas?: number;
    availableReplicas?: number;
    conditions?: Array<{ type: string; status: string; lastTransitionTime: string; reason?: string; message?: string }>;
    observedGeneration?: number;
  };
}

const mockDeploymentResource: DeploymentResource = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'nginx-deployment',
    namespace: 'production',
    uid: 'abc-123-def-456',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'nginx', environment: 'production', version: 'v1.0.0' },
    annotations: { 'deployment.kubernetes.io/revision': '3' },
  },
  spec: {
    replicas: 3,
    strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: '25%', maxUnavailable: '25%' } },
    selector: { matchLabels: { app: 'nginx' } },
    template: {
      spec: {
        containers: [{
          name: 'nginx',
          image: 'nginx:1.25.3',
          ports: [{ containerPort: 80, protocol: 'TCP', name: 'http' }],
          resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '200m', memory: '256Mi' } },
        }],
      },
    },
    minReadySeconds: 10,
    revisionHistoryLimit: 10,
    progressDeadlineSeconds: 600,
  },
  status: {
    replicas: 3,
    readyReplicas: 3,
    updatedReplicas: 3,
    availableReplicas: 3,
    observedGeneration: 5,
    conditions: [
      { type: 'Available', status: 'True', lastTransitionTime: new Date().toISOString(), reason: 'MinimumReplicasAvailable' },
      { type: 'Progressing', status: 'True', lastTransitionTime: new Date().toISOString(), reason: 'NewReplicaSetAvailable' },
    ],
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', namespace: 'production', status: 'healthy', isCurrent: true },
  { id: 'replicaset-1', type: 'replicaset', name: 'nginx-deployment-7fb96c846b', namespace: 'production', status: 'healthy' },
  { id: 'replicaset-2', type: 'replicaset', name: 'nginx-deployment-6d4b75cb6d', namespace: 'production', status: 'healthy' },
  { id: 'pod-1', type: 'pod', name: 'nginx-deployment-7fb96c846b-abc12', namespace: 'production', status: 'healthy', traffic: 75 },
  { id: 'pod-2', type: 'pod', name: 'nginx-deployment-7fb96c846b-def34', namespace: 'production', status: 'healthy', traffic: 60 },
  { id: 'pod-3', type: 'pod', name: 'nginx-deployment-7fb96c846b-ghi56', namespace: 'production', status: 'healthy', traffic: 55 },
  { id: 'service', type: 'service', name: 'nginx-svc', namespace: 'production', status: 'healthy', traffic: 85 },
  { id: 'hpa', type: 'hpa', name: 'nginx-hpa', namespace: 'production', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'deployment', to: 'replicaset-1', label: 'Current' },
  { from: 'deployment', to: 'replicaset-2', label: 'Previous' },
  { from: 'replicaset-1', to: 'pod-1', label: 'Manages', traffic: 75 },
  { from: 'replicaset-1', to: 'pod-2', label: 'Manages', traffic: 60 },
  { from: 'replicaset-1', to: 'pod-3', label: 'Manages', traffic: 55 },
  { from: 'service', to: 'pod-1', label: 'Routes to', traffic: 40 },
  { from: 'service', to: 'pod-2', label: 'Routes to', traffic: 35 },
  { from: 'service', to: 'pod-3', label: 'Routes to', traffic: 30 },
  { from: 'hpa', to: 'deployment', label: 'Scales' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'ScalingReplicaSet', message: 'Scaled up replica set nginx-deployment-7fb96c846b to 3', time: '5m ago' },
  { type: 'Normal' as const, reason: 'ScalingReplicaSet', message: 'Scaled down replica set nginx-deployment-6d4b75cb6d to 0', time: '5m ago' },
  { type: 'Normal' as const, reason: 'DeploymentRollback', message: 'Rolled back deployment to revision 2', time: '1h ago' },
];

export default function DeploymentDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [showRolloutDialog, setShowRolloutDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: deployment, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<DeploymentResource>(
    'deployments',
    name,
    namespace,
    mockDeploymentResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteDeployment = useDeleteK8sResource('deployments');
  const updateDeployment = useUpdateK8sResource('deployments');

  const status: ResourceStatus = deployment.status?.readyReplicas === deployment.spec?.replicas ? 'Running' : 
    deployment.status?.readyReplicas ? 'Pending' : 'Failed';
  
  const conditions = deployment.status?.conditions || [];
  const desired = deployment.spec?.replicas || 0;
  const ready = deployment.status?.readyReplicas || 0;
  const updated = deployment.status?.updatedReplicas || 0;
  const available = deployment.status?.availableReplicas || 0;
  
  const containers: ContainerInfo[] = (deployment.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: true,
    restartCount: 0,
    state: 'running',
    ports: c.ports || [],
    resources: c.resources || {},
    currentUsage: { cpu: Math.floor(Math.random() * 40) + 10, memory: Math.floor(Math.random() * 50) + 20 },
  }));

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
    a.download = `${deployment.metadata?.name || 'deployment'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, deployment.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleScale = useCallback(async (replicas: number) => {
    if (isConnected) {
      toast.success(`Scaled ${name} to ${replicas} replicas`);
    } else {
      toast.success(`Scaled ${name} to ${replicas} replicas (demo mode)`);
    }
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
        await updateDeployment.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('Deployment updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('Deployment updated (demo mode)');
    }
  }, [isConnected, name, namespace, updateDeployment, refetch]);

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
    { label: 'Updated', value: updated, icon: RefreshCw, iconColor: 'info' as const },
    { label: 'Available', value: available, icon: CheckCircle2, iconColor: 'success' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current (Revision 3)', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous (Revision 2)', yaml: yaml.replace('replicas: 3', 'replicas: 2'), timestamp: '1 hour ago' },
    { id: 'initial', label: 'Initial (Revision 1)', yaml: yaml.replace('replicas: 3', 'replicas: 1'), timestamp: '30 days ago' },
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
                <CardTitle className="text-base">Deployment Information</CardTitle>
                <CardDescription>Configuration and status details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Strategy</p>
                    <Badge variant="outline">{deployment.spec?.strategy?.type || 'RollingUpdate'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Min Ready Seconds</p>
                    <p className="font-mono">{deployment.spec?.minReadySeconds || 0}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Revision History Limit</p>
                    <p className="font-mono">{deployment.spec?.revisionHistoryLimit || 10}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Progress Deadline</p>
                    <p className="font-mono">{deployment.spec?.progressDeadlineSeconds || 600}s</p>
                  </div>
                  {deployment.spec?.strategy?.rollingUpdate && (
                    <>
                      <div>
                        <p className="text-muted-foreground mb-1">Max Surge</p>
                        <p className="font-mono">{deployment.spec.strategy.rollingUpdate.maxSurge || '25%'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Max Unavailable</p>
                        <p className="font-mono">{deployment.spec.strategy.rollingUpdate.maxUnavailable || '25%'}</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Replica Status</CardTitle>
                <CardDescription>Current replica distribution</CardDescription>
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
                    <span className="text-sm">Updated</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(updated / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{updated}/{desired}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Available</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(available / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{available}/{desired}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conditions</CardTitle>
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
                          <p className="text-xs text-muted-foreground">{condition.reason}</p>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetadataCard title="Labels" items={deployment.metadata?.labels || {}} variant="badges" />
            <MetadataCard title="Selector" items={deployment.spec?.selector?.matchLabels || {}} variant="default" />
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
      content: <YamlViewer yaml={yaml} resourceName={deployment.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={deployment.metadata?.name || ''} />,
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
          { icon: Scale, label: 'Scale Deployment', description: 'Adjust the number of replicas', onClick: () => setShowScaleDialog(true) },
          { icon: RotateCcw, label: 'Rollout Restart', description: 'Trigger a rolling restart', onClick: () => setShowRolloutDialog(true) },
          { icon: History, label: 'Rollout History', description: 'View and manage revisions', onClick: () => setShowRolloutDialog(true) },
          { icon: Download, label: 'Download YAML', description: 'Export deployment definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Deployment', description: 'Permanently remove this deployment', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Deployment"
        resourceIcon={Container}
        name={deployment.metadata?.name || ''}
        namespace={deployment.metadata?.namespace}
        status={status}
        backLink="/deployments"
        backLabel="Deployments"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Activity className="h-3.5 w-3.5" />
            {deployment.spec?.strategy?.type || 'RollingUpdate'}
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
        resourceType="Deployment"
        resourceName={deployment.metadata?.name || ''}
        namespace={deployment.metadata?.namespace}
        currentReplicas={desired}
        onScale={handleScale}
      />

      <RolloutActionsDialog
        open={showRolloutDialog}
        onOpenChange={setShowRolloutDialog}
        resourceType="Deployment"
        resourceName={deployment.metadata?.name || ''}
        namespace={deployment.metadata?.namespace}
        onRestart={handleRestart}
        onRollback={handleRollback}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="Deployment"
        resourceName={deployment.metadata?.name || ''}
        namespace={deployment.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteDeployment.mutateAsync({ name, namespace });
            navigate('/deployments');
          } else {
            toast.success(`Deployment ${name} deleted (demo mode)`);
            navigate('/deployments');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
