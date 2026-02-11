import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  Loader2,
  Info,
  Layers,
  FileText,
  Terminal,
  Box,
  LayoutDashboard,
  CalendarClock,
  BarChart2,
  FileCode,
  GitCompare,
  Network,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ResourceDetailLayout,
  SectionCard,
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
  LogViewer,
  TerminalViewer,
  RolloutActionsDialog,
  DeleteConfirmDialog,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type ContainerInfo,
  type YamlVersion,
  type ResourceDetail,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, usePatchK8sResource, useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { useClusterStore } from '@/stores/clusterStore';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDeploymentRolloutHistory, postDeploymentRollback, BackendApiError } from '@/services/backendApiClient';
import { getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';

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

export default function DeploymentDetail() {
  const { namespace, name } = useParams();
  const { activeCluster } = useClusterStore();
  const clusterId = useActiveClusterId();
  const breadcrumbSegments = useDetailBreadcrumbs(
    'Deployment',
    name ?? undefined,
    namespace ?? undefined,
    activeCluster?.name
  );
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showScaleDialog, setShowScaleDialog] = useState(false);
  const [showRolloutDialog, setShowRolloutDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  const [selectedLogPod, setSelectedLogPod] = useState<string>('');
  const [selectedLogContainer, setSelectedLogContainer] = useState<string>('');
  const [selectedTerminalPod, setSelectedTerminalPod] = useState<string>('');
  const [selectedTerminalContainer, setSelectedTerminalContainer] = useState<string>('');

  const { isConnected } = useConnectionStatus();
  const { resource: deployment, isLoading, error, age, yaml, refetch } = useResourceDetail<DeploymentResource>(
    'deployments',
    name,
    namespace,
    {} as DeploymentResource
  );
  const resourceEvents = useResourceEvents('Deployment', namespace ?? undefined, name ?? undefined);
  const displayEvents = resourceEvents.events;
  const backendBaseUrl = getEffectiveBackendBaseUrl(useBackendConfigStore((s) => s.backendBaseUrl));
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const queryClient = useQueryClient();
  const rolloutHistoryQuery = useQuery({
    queryKey: ['backend', 'deployment-rollout-history', clusterId, namespace, name],
    queryFn: () => getDeploymentRolloutHistory(backendBaseUrl!, clusterId!, namespace!, name!),
    enabled: !!(isBackendConfigured() && clusterId && namespace && name),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
  const rolloutRevisions = rolloutHistoryQuery.data?.revisions ?? [];
  const deleteDeployment = useDeleteK8sResource('deployments');
  const updateDeployment = useUpdateK8sResource('deployments');
  const patchDeployment = usePatchK8sResource('deployments');

  const useBackendTopology = isBackendConfigured() && !!clusterId;
  const resourceTopology = useResourceTopology('deployments', namespace ?? undefined, name ?? undefined);
  const topologyNodesFromBackend = useMemo(
    () =>
      resourceTopology.nodes.map((n) => ({
        ...n,
        isCurrent: n.type === 'deployment' && n.name === name && n.namespace === namespace,
      })),
    [resourceTopology.nodes, name, namespace]
  );
  const topologyEdgesFromBackend = resourceTopology.edges;
  const topologyLoading = useBackendTopology ? resourceTopology.isLoading : false;
  const topologyError = resourceTopology.error;

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
  }));

  const { data: podsList } = useK8sResourceList<KubernetesResource & { metadata?: { name?: string; labels?: Record<string, string> }; status?: { phase?: string }; spec?: { nodeName?: string } }>(
    'pods',
    namespace ?? undefined,
    { enabled: !!namespace && !!deployment?.spec?.selector?.matchLabels }
  );
  const matchLabels = deployment.spec?.selector?.matchLabels ?? {};
  const deploymentPods = (podsList?.items ?? []).filter((pod) => {
    const labels = pod.metadata?.labels ?? {};
    return Object.entries(matchLabels).every(([k, v]) => labels[k] === v);
  });

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
    if (!isConnected) {
      toast.error('Connect cluster to scale deployment');
      return;
    }
    if (!name || !namespace) return;
    if (!isBackendConfigured()) {
      toast.error('Connect to Kubilitics backend in Settings to scale, restart, or rollback.');
      return;
    }
    if (!clusterId) {
      toast.error('Select a cluster from the cluster list to perform this action.');
      return;
    }
    try {
      await patchDeployment.mutateAsync({ name, namespace, patch: { spec: { replicas } } });
      toast.success(`Scaled ${name} to ${replicas} replicas`);
      refetch();
      if (clusterId && namespace && name) {
        queryClient.invalidateQueries({ queryKey: ['backend', 'deployment-rollout-history', clusterId, namespace, name] });
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to scale');
      throw err;
    }
  }, [isConnected, name, namespace, clusterId, patchDeployment, refetch, queryClient]);

  const handleRestart = useCallback(async () => {
    if (!isConnected) {
      toast.error('Connect cluster to restart deployment');
      return;
    }
    if (!name || !namespace) return;
    if (!isBackendConfigured()) {
      toast.error('Connect to Kubilitics backend in Settings to scale, restart, or rollback.');
      return;
    }
    if (!clusterId) {
      toast.error('Select a cluster from the cluster list to perform this action.');
      return;
    }
    try {
      const patch = {
        spec: {
          template: {
            metadata: {
              annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() },
            },
          },
        },
      };
      await patchDeployment.mutateAsync({ name, namespace, patch });
      toast.success(`Rollout restart initiated for ${name}`);
      refetch();
      if (clusterId && namespace && name) {
        queryClient.invalidateQueries({ queryKey: ['backend', 'deployment-rollout-history', clusterId, namespace, name] });
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to restart');
      throw err;
    }
  }, [isConnected, name, namespace, clusterId, patchDeployment, refetch, queryClient]);

  const handleRollback = useCallback(async (revision: number) => {
    if (!isConnected) {
      toast.error('Connect cluster to rollback deployment');
      return;
    }
    if (!name || !namespace) return;
    if (!isBackendConfigured()) {
      toast.error('Connect to Kubilitics backend in Settings to scale, restart, or rollback.');
      return;
    }
    if (!clusterId) {
      toast.error('Select a cluster from the cluster list to perform this action.');
      return;
    }
    const backendBase = getEffectiveBackendBaseUrl(useBackendConfigStore.getState().backendBaseUrl);
    try {
      await postDeploymentRollback(backendBase, clusterId, namespace, name, { revision });
      toast.success(`Rolled back ${name} to revision ${revision}`);
      refetch();
      if (clusterId && namespace && name) {
        queryClient.invalidateQueries({ queryKey: ['backend', 'deployment-rollout-history', clusterId, namespace, name] });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message ?? 'Failed to rollback');
      throw err;
    }
  }, [isConnected, name, namespace, clusterId, refetch, queryClient]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (!isConnected || !name || !namespace) {
      toast.error('Connect cluster to update deployment');
      throw new Error('Not connected');
    }
    try {
      await updateDeployment.mutateAsync({ name, yaml: newYaml, namespace });
      toast.success('Deployment updated successfully');
      refetch();
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
      throw error;
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

  if (!deployment?.metadata?.name) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Deployment not found.</p>
            {error && <p className="text-sm text-destructive mt-2">{String(error)}</p>}
            <Button variant="outline" className="mt-4" onClick={() => navigate('/deployments')}>
              Back to Deployments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const revisionLabel = deployment.metadata?.annotations?.['deployment.kubernetes.io/revision'] ?? 'current';
  const strategyLabel = deployment.spec?.strategy?.type === 'Recreate'
    ? 'Recreate'
    : `RollingUpdate (${deployment.spec?.strategy?.rollingUpdate?.maxSurge ?? '25%'} / ${deployment.spec?.strategy?.rollingUpdate?.maxUnavailable ?? '25%'})`;
  const statusCards = [
    { label: 'Ready', value: `${ready}/${desired}`, icon: Server, iconColor: ready === desired ? 'success' as const : 'warning' as const },
    { label: 'Up-to-Date', value: updated, icon: RefreshCw, iconColor: 'info' as const },
    { label: 'Available', value: available, icon: CheckCircle2, iconColor: 'success' as const },
    { label: 'Revision', value: revisionLabel, icon: History, iconColor: 'primary' as const },
    { label: 'Strategy', value: strategyLabel, icon: Layers, iconColor: 'primary' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
  ];
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: `Current (Revision ${revisionLabel})`, yaml, timestamp: 'now' },
  ];

  const firstPodName = deploymentPods[0]?.metadata?.name ?? '';
  const logPod = selectedLogPod || firstPodName;
  const terminalPod = selectedTerminalPod || firstPodName;
  const logPodContainers = (deploymentPods.find((p) => p.metadata?.name === logPod) as { spec?: { containers?: Array<{ name: string }> } } | undefined)?.spec?.containers?.map((c) => c.name) ?? containers.map((c) => c.name);
  const terminalPodContainers = (deploymentPods.find((p) => p.metadata?.name === terminalPod) as { spec?: { containers?: Array<{ name: string }> } } | undefined)?.spec?.containers?.map((c) => c.name) ?? containers.map((c) => c.name);

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard icon={Info} title="Deployment Information" tooltip={<p className="text-xs text-muted-foreground">Configuration and status details</p>}>
              <div className="space-y-4">
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
              </div>
            </SectionCard>

            <SectionCard icon={Layers} title="Replica Status" tooltip={<p className="text-xs text-muted-foreground">Current replica distribution</p>}>
              <div className="space-y-4">
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
              </div>
            </SectionCard>
          </div>

          <SectionCard icon={Activity} title="Conditions" tooltip={<p className="text-xs text-muted-foreground">Deployment condition status</p>}>
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
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MetadataCard title="Labels" items={deployment.metadata?.labels || {}} variant="badges" />
            <MetadataCard title="Selector" items={deployment.spec?.selector?.matchLabels || {}} variant="default" />
          </div>
        </div>
      ),
    },
    {
      id: 'rollout-history',
      label: 'Rollout History',
      content: (
        <SectionCard icon={History} title="Rollout History" tooltip={<p className="text-xs text-muted-foreground">Revisions and rollback</p>}>
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm text-muted-foreground">Revisions for this deployment. Roll back to a previous revision or trigger a restart.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => rolloutHistoryQuery.refetch()} disabled={rolloutHistoryQuery.isLoading} className="gap-2">
                  <RefreshCw className={rolloutHistoryQuery.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                  Refresh
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRolloutDialog(true)} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Restart / Rollback
                </Button>
              </div>
            </div>
            {rolloutHistoryQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading revision history…
              </div>
            ) : rolloutHistoryQuery.isError ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">
                  {rolloutHistoryQuery.error instanceof Error
                    ? rolloutHistoryQuery.error.message
                    : 'Failed to load rollout history.'}
                </p>
                {rolloutHistoryQuery.error instanceof BackendApiError && rolloutHistoryQuery.error.status === 404 && (
                  <p className="text-xs text-muted-foreground">
                    Your cluster is connected (the metrics and resources above come from it). Rollout History is loaded from the Kubilitics backend. Ensure the backend is running and has this cluster added via Settings → Connect, then select this cluster from the header dropdown.
                  </p>
                )}
                <Button variant="outline" size="sm" onClick={() => rolloutHistoryQuery.refetch()} className="mt-2">
                  Try again
                </Button>
              </div>
            ) : !isBackendConfigured() || !clusterId ? (
              <p className="text-sm text-muted-foreground">Rollout History is provided by the Kubilitics backend. Configure the backend (Settings → Connect) and select this cluster to view revisions and rollback.</p>
            ) : rolloutRevisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revision history yet, or no ReplicaSets owned by this deployment.</p>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Revision</th>
                      <th className="text-left p-3 font-medium">Created</th>
                      <th className="text-left p-3 font-medium">Change cause</th>
                      <th className="text-left p-3 font-medium">Ready / Desired</th>
                      <th className="text-left p-3 font-medium">ReplicaSet</th>
                      <th className="text-right p-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...rolloutRevisions].reverse().map((rev) => {
                      const isCurrent = String(rev.revision) === revisionLabel;
                      return (
                        <tr key={rev.revision} className="border-t">
                          <td className="p-3 font-mono">
                            {rev.revision}
                            {isCurrent && (
                              <Badge variant="secondary" className="ml-2 text-xs">current</Badge>
                            )}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {rev.creationTimestamp ? new Date(rev.creationTimestamp).toLocaleString() : '—'}
                          </td>
                          <td className="p-3 text-muted-foreground">{rev.changeCause || '—'}</td>
                          <td className="p-3 font-mono">{rev.ready} / {rev.desired}</td>
                          <td className="p-3 font-mono text-xs truncate max-w-[120px]" title={rev.name}>{rev.name}</td>
                          <td className="p-3 text-right">
                            {!isCurrent && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRollback(rev.revision)}
                              >
                                Rollback
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>
      ),
    },
    {
      id: 'scaling',
      label: 'Scaling',
      icon: Scale,
      content: (
        <SectionCard icon={Scale} title="Scaling" tooltip={<p className="text-xs text-muted-foreground">Replica count and scale control</p>}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-foreground">Desired</p>
                  <p className="text-2xl font-semibold">{desired}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-foreground">Ready</p>
                  <p className="text-2xl font-semibold">{ready}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-foreground">Available</p>
                  <p className="text-2xl font-semibold">{available}</p>
                </CardContent>
              </Card>
            </div>
            <Button variant="outline" onClick={() => setShowScaleDialog(true)} className="gap-2">
              <Scale className="h-4 w-4" />
              Change replica count
            </Button>
          </div>
        </SectionCard>
      ),
    },
    {
      id: 'pods',
      label: 'Pods',
      icon: Box,
      badge: deploymentPods.length.toString(),
      content: (
        <SectionCard icon={Box} title="Pods" tooltip={<p className="text-xs text-muted-foreground">Pods managed by this deployment</p>}>
          {deploymentPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods match this deployment&apos;s selector yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Node</th>
                    <th className="text-left p-3 font-medium">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {deploymentPods.map((pod) => {
                    const podName = pod.metadata?.name ?? '';
                    const podNs = pod.metadata?.namespace ?? namespace ?? '';
                    const phase = (pod.status as { phase?: string } | undefined)?.phase ?? '-';
                    const nodeName = (pod.spec as { nodeName?: string } | undefined)?.nodeName ?? '-';
                    const created = pod.metadata?.creationTimestamp ? calculateAge(pod.metadata.creationTimestamp) : '-';
                    return (
                      <tr key={podName} className="border-t">
                        <td className="p-3">
                          <Link to={`/pods/${podNs}/${podName}`} className="text-primary hover:underline font-medium">
                            {podName}
                          </Link>
                        </td>
                        <td className="p-3">{phase}</td>
                        <td className="p-3 font-mono text-xs">{nodeName}</td>
                        <td className="p-3">{created}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      ),
    },
    {
      id: 'containers',
      label: 'Containers',
      icon: Layers,
      badge: containers.length.toString(),
      content: <ContainersSection containers={containers} />,
    },
    {
      id: 'logs',
      label: 'Logs',
      icon: FileText,
      content: (
        <SectionCard icon={FileText} title="Logs" tooltip={<p className="text-xs text-muted-foreground">Stream logs from deployment pods</p>}>
          {deploymentPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods available. Select a deployment with running pods to view logs.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Pod</Label>
                  <Select value={logPod} onValueChange={setSelectedLogPod}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select pod" />
                    </SelectTrigger>
                    <SelectContent>
                      {deploymentPods.map((p) => (
                        <SelectItem key={p.metadata?.name} value={p.metadata?.name ?? ''}>
                          {p.metadata?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Container</Label>
                  <Select value={selectedLogContainer || logPodContainers[0]} onValueChange={setSelectedLogContainer}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select container" />
                    </SelectTrigger>
                    <SelectContent>
                      {logPodContainers.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <LogViewer
                podName={logPod}
                namespace={namespace ?? undefined}
                containerName={selectedLogContainer || logPodContainers[0]}
                containers={logPodContainers}
                onContainerChange={setSelectedLogContainer}
              />
            </div>
          )}
        </SectionCard>
      ),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: Terminal,
      content: (
        <SectionCard icon={Terminal} title="Terminal" tooltip={<p className="text-xs text-muted-foreground">Exec into deployment pods</p>}>
          {deploymentPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods available. Select a deployment with running pods to open a terminal.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <Label>Pod</Label>
                  <Select value={terminalPod} onValueChange={setSelectedTerminalPod}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select pod" />
                    </SelectTrigger>
                    <SelectContent>
                      {deploymentPods.map((p) => (
                        <SelectItem key={p.metadata?.name} value={p.metadata?.name ?? ''}>
                          {p.metadata?.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Container</Label>
                  <Select value={selectedTerminalContainer || terminalPodContainers[0]} onValueChange={setSelectedTerminalContainer}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select container" />
                    </SelectTrigger>
                    <SelectContent>
                      {terminalPodContainers.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <TerminalViewer
                podName={terminalPod}
                namespace={namespace ?? undefined}
                containerName={selectedTerminalContainer || terminalPodContainers[0]}
                containers={terminalPodContainers}
                onContainerChange={setSelectedTerminalContainer}
              />
            </div>
          )}
        </SectionCard>
      ),
    },
    {
      id: 'events',
      label: 'Events',
      icon: CalendarClock,
      badge: displayEvents.length.toString(),
      content: <EventsSection events={displayEvents} />,
    },
    {
      id: 'metrics',
      label: 'Metrics',
      icon: BarChart2,
      content: <MetricsDashboard resourceType="deployment" resourceName={name} namespace={namespace} clusterId={clusterId} />,
    },
    {
      id: 'yaml',
      label: 'YAML',
      icon: FileCode,
      content: <YamlViewer yaml={yaml} resourceName={deployment.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      content: <YamlCompareViewer versions={yamlVersions} resourceName={deployment.metadata?.name || ''} />,
    },
    {
      id: 'topology',
      label: 'Topology',
      icon: Network,
      content: (
        <>
          {topologyLoading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : topologyError ? (
            <div className="flex items-center justify-center min-h-[400px] text-muted-foreground text-sm">
              Topology unavailable: {topologyError instanceof Error ? topologyError.message : String(topologyError)}
            </div>
          ) : (
            <TopologyViewer nodes={topologyNodesFromBackend} edges={topologyEdgesFromBackend} onNodeClick={handleNodeClick} />
          )}
          <NodeDetailPopup
            resource={selectedNode}
            onClose={() => setSelectedNode(null)}
            sourceResourceType="Deployment"
            sourceResourceName={deployment?.metadata?.name ?? name ?? ''}
          />
        </>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: Settings,
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
    <>
      <ResourceDetailLayout
        resourceType="Deployment"
        resourceIcon={Container}
        name={deployment.metadata?.name || ''}
        namespace={deployment.metadata?.namespace}
        status={status}
        backLink="/deployments"
        backLabel="Deployments"
        headerMetadata={
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
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => { refetch(); resourceEvents.refetch(); } },
          { label: 'Scale', icon: Scale, variant: 'outline', onClick: () => setShowScaleDialog(true) },
          { label: 'Restart', icon: RotateCcw, variant: 'outline', onClick: () => setShowRolloutDialog(true) },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {breadcrumbSegments.length > 0 && (
          <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        )}
      </ResourceDetailLayout>

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
        revisions={[]}
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
          if (!isConnected || !name || !namespace) {
            toast.error('Connect cluster to delete deployment');
            return;
          }
          await deleteDeployment.mutateAsync({ name, namespace });
          toast.success(`Deployment ${name} deleted`);
          navigate('/deployments');
        }}
        requireNameConfirmation
      />
    </>
  );
}
