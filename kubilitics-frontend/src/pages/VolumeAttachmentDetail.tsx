import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Database, Clock, Server, Download, Trash2, HardDrive, RefreshCw, Info, Network, Loader2, Edit, FileCode, GitCompare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  ResourceDetailLayout,
  SectionCard,
  TopologyViewer,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useResourceTopology } from '@/hooks/useResourceTopology';
import { useDeleteK8sResource, useUpdateK8sResource, type KubernetesResource } from '@/hooks/useKubernetes';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { Button } from '@/components/ui/button';

interface K8sVolumeAttachment extends KubernetesResource {
  spec?: {
    attacher?: string;
    nodeName?: string;
    source?: { persistentVolumeName?: string };
  };
  status?: {
    attached?: boolean;
    attachError?: { message?: string };
    detachError?: { message?: string };
    attachmentMetadata?: Record<string, string>;
  };
}

export default function VolumeAttachmentDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { activeCluster } = useClusterStore();
  const breadcrumbSegments = useDetailBreadcrumbs('VolumeAttachment', name ?? undefined, undefined, activeCluster?.name);
  const clusterId = useActiveClusterId();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const { resource: va, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<K8sVolumeAttachment>(
    'volumeattachments',
    name ?? '',
    undefined,
    undefined as unknown as K8sVolumeAttachment
  );
  const { events, refetch: refetchEvents } = useResourceEvents('VolumeAttachment', '', name ?? undefined);
  const { nodes: topologyNodes, edges: topologyEdges, refetch: refetchTopology, isLoading: topologyLoading, error: topologyError } = useResourceTopology('volumeattachments', '', name ?? undefined);
  const deleteVA = useDeleteK8sResource('volumeattachments');
  const updateVA = useUpdateK8sResource('volumeattachments');

  useEffect(() => {
    if (!name?.trim()) navigate('/volumeattachments', { replace: true });
  }, [name, navigate]);

  const handleRefresh = () => {
    refetch();
    refetchEvents();
    refetchTopology();
  };

  const handleDownloadYaml = useCallback(() => {
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${va?.metadata?.name || 'volumeattachment'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, va?.metadata?.name]);

  if (!name?.trim()) return null;
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isConnected && name && !va?.metadata?.name) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">VolumeAttachment not found.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/volumeattachments')}>
              Back to Volume Attachments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vaName = va?.metadata?.name ?? '';
  const attacher = va?.spec?.attacher ?? '—';
  const nodeName = va?.spec?.nodeName ?? '—';
  const pvName = va?.spec?.source?.persistentVolumeName ?? '—';
  const attached = !!va?.status?.attached;
  const status: ResourceStatus = attached ? 'Healthy' : 'Pending';
  const attachError = va?.status?.attachError?.message ?? va?.status?.detachError?.message ?? '—';
  const attachmentMetadata = va?.status?.attachmentMetadata ?? {};

  const statusCards = [
    { label: 'Status', value: attached ? 'Attached' : 'Detached', icon: Database, iconColor: 'success' as const },
    { label: 'Node', value: nodeName, icon: Server, iconColor: 'info' as const },
    { label: 'PV', value: pvName, icon: HardDrive, iconColor: 'primary' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];
  const handleSaveYaml = async (newYaml: string) => {
    if (!name) return;
    try {
      await updateVA.mutateAsync({ name, yaml: newYaml });
      toast.success('VolumeAttachment updated successfully');
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update VolumeAttachment');
      throw e;
    }
  };

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pv' && node.name !== vaName) navigate(`/persistentvolumes/${node.name}`);
    else if (node.type === 'node') navigate(`/nodes/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Info,
      content: (
        <div className="space-y-6">
          <SectionCard icon={Database} title="Attachment information" tooltip={<p className="text-xs text-muted-foreground">Volume attachment status and references</p>}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div><p className="text-muted-foreground mb-1">Attacher</p><p className="font-mono text-xs">{attacher}</p></div>
              <div><p className="text-muted-foreground mb-1">Status</p><Badge variant={attached ? 'default' : 'secondary'}>{attached ? 'Attached' : 'Detached'}</Badge></div>
              <div><p className="text-muted-foreground mb-1">Node</p><button type="button" className="font-medium text-primary hover:underline" onClick={() => nodeName !== '—' && navigate(`/nodes/${nodeName}`)}>{nodeName}</button></div>
              <div><p className="text-muted-foreground mb-1">PersistentVolume</p><button type="button" className="font-mono text-xs text-primary hover:underline" onClick={() => pvName !== '—' && navigate(`/persistentvolumes/${pvName}`)}>{pvName}</button></div>
              <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
              {attachError !== '—' && <div className="col-span-2 md:col-span-3"><p className="text-muted-foreground mb-1">Attach Error</p><p className="text-destructive text-sm">{attachError}</p></div>}
            </div>
          </SectionCard>
          {Object.keys(attachmentMetadata).length > 0 && (
            <SectionCard icon={Info} title="Attachment Metadata" tooltip={<p className="text-xs text-muted-foreground">Driver-specific metadata</p>}>
              <div className="space-y-2">
                {Object.entries(attachmentMetadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{key}</span>
                    <span className="font-mono text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      ),
    },
    { id: 'events', label: 'Events', icon: Clock, content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', icon: FileCode, content: <YamlViewer yaml={yaml} resourceName={vaName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', icon: GitCompare, content: <YamlCompareViewer versions={yamlVersions} resourceName={vaName} /> },
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
          <p className="text-muted-foreground">No related resources in topology for this VolumeAttachment.</p>
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
          { icon: Download, label: 'Download YAML', description: 'Export VolumeAttachment definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Attachment', description: 'Remove this volume attachment', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="VolumeAttachment"
        resourceIcon={Database}
        name={vaName}
        status={status}
        backLink="/volumeattachments"
        backLabel="Volume Attachments"
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
        resourceType="VolumeAttachment"
        resourceName={vaName}
        onConfirm={async () => {
          if (isConnected && name) {
            await deleteVA.mutateAsync({ name });
            navigate('/volumeattachments');
          } else {
            toast.success(`VolumeAttachment ${vaName} deleted (demo mode)`);
            navigate('/volumeattachments');
          }
        }}
        requireNameConfirmation
      />
    </>
  );
}
