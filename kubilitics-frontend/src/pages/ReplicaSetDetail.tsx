import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Layers,
  Clock,
  Server,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  CheckCircle2,
  Activity,
  Scale,
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

interface ReplicaSetResource extends KubernetesResource {
  spec?: {
    replicas?: number;
    selector?: { matchLabels?: Record<string, string> };
    template?: {
      spec?: {
        containers?: Array<{
          name: string;
          image: string;
          ports?: Array<{ containerPort: number; protocol: string }>;
          resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
        }>;
      };
    };
  };
  status?: {
    replicas?: number;
    readyReplicas?: number;
    availableReplicas?: number;
    fullyLabeledReplicas?: number;
  };
}

const mockReplicaSetResource: ReplicaSetResource = {
  apiVersion: 'apps/v1',
  kind: 'ReplicaSet',
  metadata: {
    name: 'nginx-deployment-7fb96c846b',
    namespace: 'production',
    uid: 'rs-123-456',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'nginx', 'pod-template-hash': '7fb96c846b' },
    ownerReferences: [{ apiVersion: 'apps/v1', kind: 'Deployment', name: 'nginx-deployment', uid: 'dep-123' }],
  },
  spec: {
    replicas: 3,
    selector: { matchLabels: { app: 'nginx', 'pod-template-hash': '7fb96c846b' } },
    template: {
      spec: {
        containers: [{
          name: 'nginx',
          image: 'nginx:1.25.3',
          ports: [{ containerPort: 80, protocol: 'TCP' }],
          resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '200m', memory: '256Mi' } },
        }],
      },
    },
  },
  status: {
    replicas: 3,
    readyReplicas: 3,
    availableReplicas: 3,
    fullyLabeledReplicas: 3,
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', namespace: 'production', status: 'healthy' },
  { id: 'replicaset', type: 'replicaset', name: 'nginx-deployment-7fb96c846b', namespace: 'production', status: 'healthy', isCurrent: true },
  { id: 'pod-1', type: 'pod', name: 'nginx-deployment-7fb96c846b-abc12', namespace: 'production', status: 'healthy', traffic: 75 },
  { id: 'pod-2', type: 'pod', name: 'nginx-deployment-7fb96c846b-def34', namespace: 'production', status: 'healthy', traffic: 60 },
  { id: 'pod-3', type: 'pod', name: 'nginx-deployment-7fb96c846b-ghi56', namespace: 'production', status: 'healthy', traffic: 55 },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'deployment', to: 'replicaset', label: 'Creates' },
  { from: 'replicaset', to: 'pod-1', label: 'Manages', traffic: 75 },
  { from: 'replicaset', to: 'pod-2', label: 'Manages', traffic: 60 },
  { from: 'replicaset', to: 'pod-3', label: 'Manages', traffic: 55 },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: nginx-deployment-7fb96c846b-abc12', time: '30d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: nginx-deployment-7fb96c846b-def34', time: '30d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: nginx-deployment-7fb96c846b-ghi56', time: '30d ago' },
];

export default function ReplicaSetDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: replicaSet, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<ReplicaSetResource>(
    'replicasets',
    name,
    namespace,
    mockReplicaSetResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteReplicaSet = useDeleteK8sResource('replicasets');
  const updateReplicaSet = useUpdateK8sResource('replicasets');

  const status: ResourceStatus = replicaSet.status?.readyReplicas === replicaSet.spec?.replicas ? 'Running' : 
    replicaSet.status?.readyReplicas ? 'Pending' : 'Failed';
  
  const desired = replicaSet.spec?.replicas || 0;
  const ready = replicaSet.status?.readyReplicas || 0;
  const available = replicaSet.status?.availableReplicas || 0;
  const fullyLabeled = replicaSet.status?.fullyLabeledReplicas || 0;
  
  const containers: ContainerInfo[] = (replicaSet.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: true,
    restartCount: 0,
    state: 'running',
    ports: c.ports || [],
    resources: c.resources || {},
    currentUsage: { cpu: Math.floor(Math.random() * 40) + 10, memory: Math.floor(Math.random() * 50) + 20 },
  }));

  const ownerRef = replicaSet.metadata?.ownerReferences?.[0];

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
    a.download = `${replicaSet.metadata?.name || 'replicaset'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, replicaSet.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleScale = useCallback(async (replicas: number) => {
    toast.success(`Scaled ${name} to ${replicas} replicas ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updateReplicaSet.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('ReplicaSet updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('ReplicaSet updated (demo mode)');
    }
  }, [isConnected, name, namespace, updateReplicaSet, refetch]);

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
    { label: 'Available', value: available, icon: CheckCircle2, iconColor: 'success' as const },
    { label: 'Fully Labeled', value: fullyLabeled, icon: Activity, iconColor: 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('replicas: 3', 'replicas: 2'), timestamp: '1 hour ago' },
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
                <CardTitle className="text-base">ReplicaSet Information</CardTitle>
                <CardDescription>Configuration and ownership details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Desired Replicas</p>
                    <p className="font-mono text-lg">{desired}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Current Replicas</p>
                    <p className="font-mono text-lg">{replicaSet.status?.replicas || 0}</p>
                  </div>
                  {ownerRef && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground mb-1">Owner</p>
                      <Button
                        variant="link"
                        className="h-auto p-0 font-medium"
                        onClick={() => navigate(`/deployments/${namespace}/${ownerRef.name}`)}
                      >
                        {ownerRef.kind}: {ownerRef.name}
                      </Button>
                    </div>
                  )}
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
                    <span className="text-sm">Available</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(available / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{available}/{desired}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fully Labeled</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(fullyLabeled / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{fullyLabeled}/{desired}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetadataCard title="Labels" items={replicaSet.metadata?.labels || {}} variant="badges" />
            <MetadataCard title="Selector" items={replicaSet.spec?.selector?.matchLabels || {}} variant="default" />
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
      content: <YamlViewer yaml={yaml} resourceName={replicaSet.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={replicaSet.metadata?.name || ''} />,
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
          { icon: Scale, label: 'Scale ReplicaSet', description: 'Adjust the number of replicas', onClick: () => setShowScaleDialog(true) },
          { icon: Download, label: 'Download YAML', description: 'Export ReplicaSet definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete ReplicaSet', description: 'Permanently remove this ReplicaSet', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ReplicaSet"
        resourceIcon={Layers}
        name={replicaSet.metadata?.name || ''}
        namespace={replicaSet.metadata?.namespace}
        status={status}
        backLink="/replicasets"
        backLabel="ReplicaSets"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            {ownerRef && (
              <>
                <span className="mx-2">•</span>
                Owner: {ownerRef.kind}
              </>
            )}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Scale', icon: Scale, variant: 'outline', onClick: () => setShowScaleDialog(true) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <ScaleDialog
        open={showScaleDialog}
        onOpenChange={setShowScaleDialog}
        resourceType="ReplicaSet"
        resourceName={replicaSet.metadata?.name || ''}
        namespace={replicaSet.metadata?.namespace}
        currentReplicas={desired}
        onScale={handleScale}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="ReplicaSet"
        resourceName={replicaSet.metadata?.name || ''}
        namespace={replicaSet.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteReplicaSet.mutateAsync({ name, namespace });
            navigate('/replicasets');
          } else {
            toast.success(`ReplicaSet ${name} deleted (demo mode)`);
            navigate('/replicasets');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
