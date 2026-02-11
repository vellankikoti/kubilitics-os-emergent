import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Clock, Download, Trash2, Eye, EyeOff, Edit, Copy, RefreshCw, Info, Network, Loader2, FileCode, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { getSecretConsumers } from '@/services/backendApiClient';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { toast } from 'sonner';

interface SecretResource extends KubernetesResource {
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
}

export default function SecretDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { activeCluster } = useClusterStore();
  const breadcrumbSegments = useDetailBreadcrumbs('Secret', name ?? undefined, namespace ?? undefined, activeCluster?.name);
  const clusterId = useActiveClusterId();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const { resource: s, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<SecretResource>(
    'secrets',
    name,
    namespace,
    undefined as unknown as SecretResource
  );
  const { events, refetch: refetchEvents } = useResourceEvents('Secret', namespace, name ?? undefined);
  const { nodes: topologyNodes, edges: topologyEdges, refetch: refetchTopology, isLoading: topologyLoading, error: topologyError } = useResourceTopology('secrets', namespace, name ?? undefined);
  const deleteSecret = useDeleteK8sResource('secrets');
  const updateSecret = useUpdateK8sResource('secrets');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const baseUrl = getEffectiveBackendBaseUrl();
  const consumersQuery = useQuery({
    queryKey: ['secret-consumers', clusterId, namespace, name],
    queryFn: () => getSecretConsumers(baseUrl!, clusterId!, namespace ?? '', name!),
    enabled: !!(isBackendConfigured() && clusterId && namespace && name),
    staleTime: 30_000,
  });
  const consumers = consumersQuery.data;

  const handleRefresh = () => {
    refetch();
    refetchEvents();
    refetchTopology();
  };

  const toggleShow = (key: string) => setShowValues(prev => ({ ...prev, [key]: !prev[key] }));

  const status: ResourceStatus = 'Healthy';
  const secretType = s.type || 'Opaque';
  const data = s.data || {};
  const labels = s.metadata?.labels || {};
  const sName = s.metadata?.name || '';
  const sNamespace = s.metadata?.namespace || '';

  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sName || 'secret'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, sName]);

  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];

  const handleSaveYaml = async (newYaml: string) => {
    if (!namespace || !name) return;
    try {
      await updateSecret.mutateAsync({ name, namespace, yaml: newYaml });
      toast.success('Secret updated successfully');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update Secret');
      throw e;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isConnected && name && !s?.metadata?.name) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Secret not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/secrets')}>
              Back to Secrets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalSizeBytes = Object.values(data).reduce((acc, v) => acc + (typeof v === 'string' ? v.length : 0), 0);
  const totalSizeHuman = totalSizeBytes >= 1024 * 1024 ? `${(totalSizeBytes / (1024 * 1024)).toFixed(1)} MiB` : totalSizeBytes >= 1024 ? `${(totalSizeBytes / 1024).toFixed(1)} KiB` : `${totalSizeBytes} B`;
  const usedByCount = consumers ? (consumers.pods?.length ?? 0) + (consumers.deployments?.length ?? 0) + (consumers.statefulSets?.length ?? 0) + (consumers.daemonSets?.length ?? 0) + (consumers.jobs?.length ?? 0) + (consumers.cronJobs?.length ?? 0) : 0;
  const statusCards = [
    { label: 'Type', value: secretType, icon: KeyRound, iconColor: 'primary' as const },
    { label: 'Keys', value: Object.keys(data).length, icon: KeyRound, iconColor: 'info' as const },
    { label: 'Size', value: totalSizeHuman, icon: KeyRound, iconColor: 'muted' as const },
    { label: 'Used By', value: usedByCount, icon: KeyRound, iconColor: 'primary' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${node.namespace ?? namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${node.namespace ?? namespace}/${node.name}`);
  };

  const usedByContent = !namespace || !name ? (
    <p className="text-muted-foreground text-sm">No resource selected.</p>
  ) : !isBackendConfigured() || !clusterId ? (
    <p className="text-muted-foreground text-sm">Connect to Kubilitics backend to see which Pods and workloads use this Secret.</p>
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
            title="Secret information"
            tooltip={<p className="text-xs text-muted-foreground">Identity and metadata for this Secret</p>}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground mb-1">Name</p><p className="font-mono">{sName}</p></div>
              <div><p className="text-muted-foreground mb-1">Namespace</p><p className="font-mono">{sNamespace}</p></div>
              <div><p className="text-muted-foreground mb-1">Type</p><Badge variant="secondary">{secretType}</Badge></div>
              <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
              <div><p className="text-muted-foreground mb-1">Data keys</p><p className="font-mono">{Object.keys(data).length}</p></div>
              <div><p className="text-muted-foreground mb-1">Immutable</p><Badge variant="outline">{s.immutable ? 'Yes' : 'No'}</Badge></div>
            </div>
          </SectionCard>
          <SectionCard
            icon={KeyRound}
            title="Data keys"
            tooltip={<p className="text-xs text-muted-foreground">Keys defined in this Secret (see Data tab for values)</p>}
          >
            <div className="flex flex-wrap gap-2">
              {Object.keys(data).map((key) => (
                <Badge key={key} variant="secondary" className="font-mono">{key}</Badge>
              ))}
              {Object.keys(data).length === 0 && <p className="text-muted-foreground text-sm">No keys</p>}
            </div>
          </SectionCard>
          <SectionCard icon={Info} title="Labels" tooltip={<p className="text-xs text-muted-foreground">Kubernetes labels on this Secret</p>}>
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
      icon: KeyRound,
      content: (
        <div className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-mono">{key}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleShow(key)}>
                    {showValues[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Copy className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono">
                  {showValues[key] ? (() => { try { return atob(value); } catch { return value; } })() : '••••••••••••'}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'used-by', label: 'Used By', icon: KeyRound, content: usedByContent },
    { id: 'events', label: 'Events', icon: Clock, content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', icon: FileCode, content: <YamlViewer yaml={yaml} resourceName={sName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', icon: GitCompare, content: <YamlCompareViewer versions={yamlVersions} resourceName={sName} /> },
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
          <p className="text-muted-foreground">No related resources in topology for this Secret.</p>
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
          { icon: Edit, label: 'Edit Secret', description: 'Modify secret data' },
          { icon: Copy, label: 'Duplicate', description: 'Create a copy of this Secret' },
          { icon: Download, label: 'Download YAML', description: 'Export Secret definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Secret', description: 'Remove this Secret', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="Secret"
        resourceIcon={KeyRound}
        name={sName}
        namespace={sNamespace}
        status={status}
        backLink="/secrets"
        backLabel="Secrets"
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
        resourceType="Secret"
        resourceName={sName}
        namespace={sNamespace}
        onConfirm={async () => {
          if (isConnected && name && sNamespace) {
            await deleteSecret.mutateAsync({ name, namespace: sNamespace });
            navigate('/secrets');
          } else {
            toast.success(`Secret ${sName} deleted (demo mode)`);
            navigate('/secrets');
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
