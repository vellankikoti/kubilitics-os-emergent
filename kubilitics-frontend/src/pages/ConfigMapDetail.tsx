import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileJson, Clock, Download, Trash2, Copy, Edit, RefreshCw, Info, Network, Loader2, FileCode, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceDetailLayout,
  SectionCard,
  MetadataCard,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  TopologyViewer,
  DeleteConfirmDialog,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { useDeleteK8sResource, useUpdateK8sResource, type KubernetesResource } from '@/hooks/useKubernetes';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { getConfigMapConsumers, BackendApiError } from '@/services/backendApiClient';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ConfigMapResource extends KubernetesResource {
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
}

export default function ConfigMapDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { activeCluster } = useClusterStore();
  const breadcrumbSegments = useDetailBreadcrumbs('ConfigMap', name ?? undefined, namespace ?? undefined, activeCluster?.name);
  const clusterId = useActiveClusterId();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const { resource: cm, isLoading, error: resourceError, age, yaml, isConnected, refetch } = useResourceDetail<ConfigMapResource>(
    'configmaps',
    name,
    namespace,
    undefined as unknown as ConfigMapResource
  );
  const { events, refetch: refetchEvents } = useResourceEvents('ConfigMap', namespace, name ?? undefined);
  const { nodes: topologyNodes, edges: topologyEdges, refetch: refetchTopology, isLoading: topologyLoading, error: topologyError } = useResourceTopology('configmaps', namespace, name ?? undefined);
  const deleteConfigMap = useDeleteK8sResource('configmaps');
  const updateConfigMap = useUpdateK8sResource('configmaps');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const baseUrl = getEffectiveBackendBaseUrl();
  const consumersQuery = useQuery({
    queryKey: ['configmap-consumers', clusterId, namespace, name],
    queryFn: () => getConfigMapConsumers(baseUrl!, clusterId!, namespace ?? '', name!),
    enabled: !!(isBackendConfigured() && clusterId && namespace && name),
    staleTime: 30_000,
  });
  const consumers = consumersQuery.data;

  const data = cm.data || {};
  const dataKeysCount = Object.keys(data).length + (cm.binaryData ? Object.keys(cm.binaryData).length : 0);
  const totalSizeBytes = useMemo(() => {
    let n = 0;
    if (cm.data) for (const v of Object.values(cm.data)) n += (v ?? '').length;
    if (cm.binaryData) for (const v of Object.values(cm.binaryData)) n += (typeof v === 'string' ? v.length : 0);
    return n;
  }, [cm.data, cm.binaryData]);

  const handleRefresh = () => {
    refetch();
    refetchEvents();
    refetchTopology();
  };

  const status: ResourceStatus = 'Healthy';
  const labels = cm.metadata?.labels || {};
  const cmName = cm.metadata?.name || '';
  const cmNamespace = cm.metadata?.namespace || '';

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cmName || 'configmap'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, cmName]);

  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];

  const handleSaveYaml = async (newYaml: string) => {
    if (!namespace || !name) return;
    try {
      await updateConfigMap.mutateAsync({ name, namespace, yaml: newYaml });
      toast.success('ConfigMap updated successfully');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update ConfigMap');
      throw e;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (resourceError) {
    const isBackend404 = resourceError instanceof BackendApiError && resourceError.status === 404;
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-muted-foreground font-medium">Could not load ConfigMap.</p>
            <p className="text-sm text-muted-foreground">
              {isBackend404
                ? 'The backend returned 404. Ensure the Kubilitics backend is running (e.g. port 8080) and the cluster is registered in Settings.'
                : resourceError instanceof Error ? resourceError.message : String(resourceError)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => refetch()}>Retry</Button>
              <Button variant="outline" onClick={() => navigate('/configmaps')}>Back to ConfigMaps</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isConnected && name && !cm?.metadata?.name) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">ConfigMap not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/configmaps')}>
              Back to ConfigMaps
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSizeHuman = totalSizeBytes >= 1024 * 1024
    ? `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MiB`
    : totalSizeBytes >= 1024
      ? `${(totalSizeBytes / 1024).toFixed(1)} KiB`
      : `${totalSizeBytes} B`;
  const usedByCount = consumers
    ? (consumers.pods?.length ?? 0) + (consumers.deployments?.length ?? 0) + (consumers.statefulSets?.length ?? 0) + (consumers.daemonSets?.length ?? 0) + (consumers.jobs?.length ?? 0) + (consumers.cronJobs?.length ?? 0)
    : 0;
  const statusCards = [
    { label: 'Keys', value: dataKeysCount, icon: FileJson, iconColor: 'primary' as const },
    { label: 'Total Size', value: totalSizeHuman, icon: FileJson, iconColor: 'muted' as const },
    { label: 'Used By', value: usedByCount, icon: FileJson, iconColor: 'primary' as const },
    { label: 'Immutable', value: cm.immutable ? 'Yes' : 'No', icon: FileJson, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${node.namespace ?? namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${node.namespace ?? namespace}/${node.name}`);
  };

  const usedByContent = !namespace || !name ? (
    <p className="text-muted-foreground text-sm">No resource selected.</p>
  ) : !isBackendConfigured() || !clusterId ? (
    <p className="text-muted-foreground text-sm">Connect to Kubilitics backend to see which Pods and workloads use this ConfigMap.</p>
  ) : consumersQuery.isLoading ? (
    <Skeleton className="h-32 w-full" />
  ) : consumers ? (
    <div className="space-y-4">
      {[
        { label: 'Pods', items: consumers.pods, path: (ns: string, n: string) => `/pods/${ns}/${n}` },
        { label: 'Deployments', items: consumers.deployments, path: (ns: string, n: string) => `/deployments/${ns}/${n}` },
        { label: 'StatefulSets', items: consumers.statefulSets, path: (ns: string, n: string) => `/statefulsets/${ns}/${n}` },
        { label: 'DaemonSets', items: consumers.daemonSets, path: (ns: string, n: string) => `/daemonsets/${ns}/${n}` },
        { label: 'Jobs', items: consumers.jobs, path: (ns: string, n: string) => `/jobs/${ns}/${n}` },
        { label: 'CronJobs', items: consumers.cronJobs, path: (ns: string, n: string) => `/cronjobs/${ns}/${n}` },
      ].filter((s) => (s.items?.length ?? 0) > 0).map((section) => (
        <Card key={section.label}>
          <CardHeader><CardTitle className="text-base">{section.label}</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {(section.items ?? []).map((ref) => (
                <li key={`${ref.namespace}/${ref.name}`}>
                  <button type="button" className="text-primary hover:underline font-mono text-sm" onClick={() => navigate(section.path(ref.namespace, ref.name))}>
                    {ref.namespace}/{ref.name}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
      {!(consumers.pods?.length || consumers.deployments?.length || consumers.statefulSets?.length || consumers.daemonSets?.length || consumers.jobs?.length || consumers.cronJobs?.length) && (
        <p className="text-muted-foreground text-sm">No consumers found.</p>
      )}
    </div>
  ) : (
    <p className="text-muted-foreground text-sm">Could not load consumers.</p>
  );

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Info,
      content: (
        <div className="space-y-6">
          <SectionCard
            icon={Info}
            title="ConfigMap information"
            tooltip={<p className="text-xs text-muted-foreground">Identity and metadata for this ConfigMap</p>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground mb-1">Name</p><p className="font-mono">{cmName}</p></div>
              <div><p className="text-muted-foreground mb-1">Namespace</p><p className="font-mono">{cmNamespace}</p></div>
              <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
              <div><p className="text-muted-foreground mb-1">Data keys</p><p className="font-mono">{dataKeysCount}</p></div>
              <div><p className="text-muted-foreground mb-1">Immutable</p><Badge variant="outline">{cm.immutable ? 'Yes' : 'No'}</Badge></div>
            </div>
          </SectionCard>
          <SectionCard
            icon={FileJson}
            title="Data keys"
            tooltip={<p className="text-xs text-muted-foreground">Keys defined in this ConfigMap (see Data tab for values)</p>}
          >
            <div className="flex flex-wrap gap-2">
              {Object.keys(data).map((key) => (
                <Badge key={key} variant="secondary" className="font-mono">{key}</Badge>
              ))}
              {cm.binaryData && Object.keys(cm.binaryData).map((key) => (
                <Badge key={`binary-${key}`} variant="secondary" className="font-mono">{key} (binary)</Badge>
              ))}
              {dataKeysCount === 0 && <p className="text-muted-foreground text-sm">No keys</p>}
            </div>
          </SectionCard>
          <SectionCard icon={Info} title="Labels" tooltip={<p className="text-xs text-muted-foreground">Kubernetes labels on this ConfigMap</p>}>
            {Object.keys(labels).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(labels).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="font-mono text-xs">{k}={v}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No labels</p>
            )}
          </SectionCard>
        </div>
      ),
    },
    {
      id: 'data',
      label: 'Data',
      icon: FileJson,
      content: (
        <div className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-mono">{key}</CardTitle>
                <Copy className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
              </CardHeader>
              <CardContent>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-auto max-h-64">{value}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'used-by', label: 'Used By', icon: FileJson, content: usedByContent },
    { id: 'events', label: 'Events', icon: Clock, content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', icon: FileCode, content: <YamlViewer yaml={yaml} resourceName={cmName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', icon: GitCompare, content: <YamlCompareViewer versions={yamlVersions} resourceName={cmName} /> },
    {
      id: 'topology',
      label: 'Topology',
      icon: Network,
      content: !isBackendConfigured() || !clusterId ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Connect to the Kubilitics backend (Settings → Connect) and select a cluster to view resource topology.</p>
        </div>
      ) : topologyLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : topologyError ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <p className="text-destructive text-sm">Topology unavailable: {topologyError instanceof Error ? topologyError.message : String(topologyError)}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetchTopology()}>Retry</Button>
        </div>
      ) : (topologyNodes.length === 0 && topologyEdges.length === 0) ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <Network className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No related resources in topology for this ConfigMap.</p>
        </div>
      ) : (
        <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: Edit,
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit ConfigMap', description: 'Modify configuration data' },
          { icon: Copy, label: 'Duplicate', description: 'Create a copy of this ConfigMap' },
          { icon: Download, label: 'Download YAML', description: 'Export ConfigMap definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete ConfigMap', description: 'Remove this ConfigMap', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="ConfigMap"
        resourceIcon={FileJson}
        name={cmName}
        namespace={cmNamespace}
        status={status}
        backLink="/configmaps"
        backLabel="ConfigMaps"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: handleRefresh },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Edit', icon: Edit, variant: 'outline', onClick: () => { setActiveTab('yaml'); setSearchParams((p) => { const n = new URLSearchParams(p); n.set('tab', 'yaml'); return n; }, { replace: true }); } },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          setActiveTab(tabId);
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (tabId === 'overview') next.delete('tab');
            else next.set('tab', tabId);
            return next;
          }, { replace: true });
        }}
      >
        {breadcrumbSegments.length > 0 && (
          <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        )}
      </ResourceDetailLayout>
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="ConfigMap"
        resourceName={cmName}
        namespace={cmNamespace}
        onConfirm={async () => {
          if (isConnected && name && cmNamespace) {
            await deleteConfigMap.mutateAsync({ name, namespace: cmNamespace });
            navigate('/configmaps');
          } else {
            toast.success(`ConfigMap ${cmName} deleted (demo mode)`);
            navigate('/configmaps');
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
