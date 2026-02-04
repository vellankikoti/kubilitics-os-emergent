import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Cpu,
  Clock,
  Server,
  RotateCcw,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  CheckCircle2,
  Activity,
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

interface DaemonSetResource extends KubernetesResource {
  spec?: {
    selector?: { matchLabels?: Record<string, string> };
    updateStrategy?: { type: string; rollingUpdate?: { maxUnavailable?: string } };
    template?: {
      spec?: {
        containers?: Array<{
          name: string;
          image: string;
          ports?: Array<{ containerPort: number; protocol: string }>;
          resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
        }>;
        nodeSelector?: Record<string, string>;
        tolerations?: Array<{ key?: string; operator?: string; value?: string; effect?: string }>;
      };
    };
  };
  status?: {
    currentNumberScheduled?: number;
    desiredNumberScheduled?: number;
    numberReady?: number;
    numberAvailable?: number;
    updatedNumberScheduled?: number;
    numberMisscheduled?: number;
  };
}

const mockDaemonSetResource: DaemonSetResource = {
  apiVersion: 'apps/v1',
  kind: 'DaemonSet',
  metadata: {
    name: 'fluentd',
    namespace: 'kube-system',
    uid: 'ds-123-456',
    creationTimestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'fluentd', 'app.kubernetes.io/name': 'fluentd' },
  },
  spec: {
    selector: { matchLabels: { app: 'fluentd' } },
    updateStrategy: { type: 'RollingUpdate', rollingUpdate: { maxUnavailable: '1' } },
    template: {
      spec: {
        containers: [{
          name: 'fluentd',
          image: 'fluent/fluentd:v1.16',
          ports: [{ containerPort: 24224, protocol: 'TCP' }],
          resources: { requests: { cpu: '100m', memory: '200Mi' }, limits: { cpu: '500m', memory: '500Mi' } },
        }],
        tolerations: [{ operator: 'Exists' }],
      },
    },
  },
  status: {
    currentNumberScheduled: 5,
    desiredNumberScheduled: 5,
    numberReady: 5,
    numberAvailable: 5,
    updatedNumberScheduled: 5,
    numberMisscheduled: 0,
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'daemonset', type: 'daemonset', name: 'fluentd', namespace: 'kube-system', status: 'healthy', isCurrent: true },
  { id: 'pod-1', type: 'pod', name: 'fluentd-abc12', namespace: 'kube-system', status: 'healthy' },
  { id: 'pod-2', type: 'pod', name: 'fluentd-def34', namespace: 'kube-system', status: 'healthy' },
  { id: 'pod-3', type: 'pod', name: 'fluentd-ghi56', namespace: 'kube-system', status: 'healthy' },
  { id: 'node-1', type: 'node', name: 'node-1', status: 'healthy' },
  { id: 'node-2', type: 'node', name: 'node-2', status: 'healthy' },
  { id: 'node-3', type: 'node', name: 'node-3', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'daemonset', to: 'pod-1', label: 'Manages' },
  { from: 'daemonset', to: 'pod-2', label: 'Manages' },
  { from: 'daemonset', to: 'pod-3', label: 'Manages' },
  { from: 'pod-1', to: 'node-1', label: 'Runs on' },
  { from: 'pod-2', to: 'node-2', label: 'Runs on' },
  { from: 'pod-3', to: 'node-3', label: 'Runs on' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: fluentd-abc12', time: '90d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: fluentd-def34', time: '90d ago' },
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: fluentd-ghi56', time: '90d ago' },
];

export default function DaemonSetDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRolloutDialog, setShowRolloutDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: daemonSet, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<DaemonSetResource>(
    'daemonsets',
    name,
    namespace,
    mockDaemonSetResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteDaemonSet = useDeleteK8sResource('daemonsets');
  const updateDaemonSet = useUpdateK8sResource('daemonsets');

  const status: ResourceStatus = daemonSet.status?.numberReady === daemonSet.status?.desiredNumberScheduled ? 'Running' : 
    daemonSet.status?.numberReady ? 'Pending' : 'Failed';
  
  const desired = daemonSet.status?.desiredNumberScheduled || 0;
  const current = daemonSet.status?.currentNumberScheduled || 0;
  const ready = daemonSet.status?.numberReady || 0;
  const available = daemonSet.status?.numberAvailable || 0;
  const updated = daemonSet.status?.updatedNumberScheduled || 0;
  
  const containers: ContainerInfo[] = (daemonSet.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: true,
    restartCount: 0,
    state: 'running',
    ports: c.ports || [],
    resources: c.resources || {},
    currentUsage: { cpu: Math.floor(Math.random() * 40) + 10, memory: Math.floor(Math.random() * 50) + 20 },
  }));

  const tolerations = daemonSet.spec?.template?.spec?.tolerations || [];
  const nodeSelector = daemonSet.spec?.template?.spec?.nodeSelector || {};

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
    a.download = `${daemonSet.metadata?.name || 'daemonset'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, daemonSet.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleRestart = useCallback(async () => {
    toast.success(`Rollout restart initiated for ${name} ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updateDaemonSet.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('DaemonSet updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('DaemonSet updated (demo mode)');
    }
  }, [isConnected, name, namespace, updateDaemonSet, refetch]);

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
    { label: 'Desired', value: desired, icon: Server, iconColor: 'primary' as const },
    { label: 'Ready', value: `${ready}/${desired}`, icon: CheckCircle2, iconColor: ready === desired ? 'success' as const : 'warning' as const },
    { label: 'Available', value: available, icon: Activity, iconColor: 'success' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('v1.16', 'v1.15'), timestamp: '1 week ago' },
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
                <CardTitle className="text-base">DaemonSet Information</CardTitle>
                <CardDescription>Configuration and update strategy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Update Strategy</p>
                    <Badge variant="outline">{daemonSet.spec?.updateStrategy?.type || 'RollingUpdate'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Max Unavailable</p>
                    <p className="font-mono">{daemonSet.spec?.updateStrategy?.rollingUpdate?.maxUnavailable || '1'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Misscheduled</p>
                    <p className="font-mono">{daemonSet.status?.numberMisscheduled || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Updated</p>
                    <p className="font-mono">{updated}/{desired}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pod Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Scheduled</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(current / desired) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{current}/{desired}</span>
                    </div>
                  </div>
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
                </div>
              </CardContent>
            </Card>
          </div>

          {tolerations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tolerations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tolerations.map((t, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/50 font-mono text-sm">
                      {t.operator === 'Exists' ? (
                        <span>Tolerates all taints</span>
                      ) : (
                        <span>{t.key}={t.value}:{t.effect}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetadataCard title="Labels" items={daemonSet.metadata?.labels || {}} variant="badges" />
            <MetadataCard title="Node Selector" items={nodeSelector} variant="default" />
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
      content: <YamlViewer yaml={yaml} resourceName={daemonSet.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={daemonSet.metadata?.name || ''} />,
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
          { icon: RotateCcw, label: 'Rollout Restart', description: 'Trigger a rolling restart of all pods', onClick: () => setShowRolloutDialog(true) },
          { icon: Download, label: 'Download YAML', description: 'Export DaemonSet definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete DaemonSet', description: 'Permanently remove this DaemonSet', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="DaemonSet"
        resourceIcon={Cpu}
        name={daemonSet.metadata?.name || ''}
        namespace={daemonSet.metadata?.namespace}
        status={status}
        backLink="/daemonsets"
        backLabel="DaemonSets"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Server className="h-3.5 w-3.5" />
            {desired} nodes
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Restart', icon: RotateCcw, variant: 'outline', onClick: () => setShowRolloutDialog(true) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <RolloutActionsDialog
        open={showRolloutDialog}
        onOpenChange={setShowRolloutDialog}
        resourceType="DaemonSet"
        resourceName={daemonSet.metadata?.name || ''}
        namespace={daemonSet.metadata?.namespace}
        onRestart={handleRestart}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="DaemonSet"
        resourceName={daemonSet.metadata?.name || ''}
        namespace={daemonSet.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteDaemonSet.mutateAsync({ name, namespace });
            navigate('/daemonsets');
          } else {
            toast.success(`DaemonSet ${name} deleted (demo mode)`);
            navigate('/daemonsets');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
