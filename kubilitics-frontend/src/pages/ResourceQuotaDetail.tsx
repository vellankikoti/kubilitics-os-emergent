import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gauge, Clock, Download, Trash2, Box, RefreshCw, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ResourceDetailLayout,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  MetadataCard,
  ResourceTopologyView,
  type ResourceStatus,
  type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, type KubernetesResource } from '@/hooks/useKubernetes';
import { normalizeKindForTopology } from '@/utils/resourceKindMapper';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

interface ResourceQuotaResource extends KubernetesResource {
  spec?: { hard?: Record<string, string>; scopeSelector?: unknown };
  status?: { hard?: Record<string, string>; used?: Record<string, string> };
}

function parseQuantityToNum(q: string): number | null {
  if (q === undefined || q === null || q === '') return null;
  const s = String(q).trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const m = s.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10) / 1000;
  const m2 = s.match(/^(\d+)([KMGTPE]i?)$/i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function getUsagePercent(used: string, hard: string): number | null {
  const uNum = parseQuantityToNum(used);
  const hNum = parseQuantityToNum(hard);
  if (hNum == null || hNum === 0 || uNum == null) return null;
  return Math.round((uNum / hNum) * 100);
}

export default function ResourceQuotaDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isConnected } = useConnectionStatus();

  const { resource, isLoading, error: resourceError, age, yaml, refetch } = useResourceDetail<ResourceQuotaResource>(
    'resourcequotas',
    name ?? undefined,
    namespace ?? undefined,
    undefined as unknown as ResourceQuotaResource
  );
  const { events, refetch: refetchEvents } = useResourceEvents('ResourceQuota', namespace ?? undefined, name ?? undefined);
  const deleteResource = useDeleteK8sResource('resourcequotas');

  const quotaName = resource?.metadata?.name ?? name ?? '';
  const quotaNamespace = resource?.metadata?.namespace ?? namespace ?? '';
  const hard = resource?.status?.hard || resource?.spec?.hard || {};
  const used = resource?.status?.used || {};
  const labels = resource?.metadata?.labels ?? {};
  const annotations = resource?.metadata?.annotations ?? {};
  const hasScopeSelector = !!(resource?.spec?.scopeSelector && Object.keys((resource.spec.scopeSelector as Record<string, unknown>) || {}).length > 0);

  const resourcesTracked = useMemo(() => Object.keys(hard).length, [hard]);
  const overallPct = useMemo(() => {
    let maxPct: number | null = null;
    for (const key of Object.keys(hard)) {
      const pct = getUsagePercent(used[key] || '0', hard[key] || '');
      if (pct != null && (maxPct == null || pct > maxPct)) maxPct = pct;
    }
    return maxPct;
  }, [hard, used]);

  const handleRefresh = () => {
    refetch();
    refetchEvents();
  };

  const handleDownloadYaml = useCallback(() => {
    if (!yaml) return;
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quotaName || 'resourcequota'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, quotaName]);

  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];

  const statusCards = [
    { label: 'Overall Usage', value: overallPct != null ? `${overallPct}%` : '–', icon: Gauge, iconColor: 'primary' as const },
    { label: 'Resources Tracked', value: resourcesTracked, icon: Box, iconColor: 'muted' as const },
    { label: 'Namespace', value: quotaNamespace, icon: Clock, iconColor: 'info' as const },
    { label: 'Scopes', value: hasScopeSelector ? 'Yes' : 'No', icon: Gauge, iconColor: 'muted' as const },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isConnected && (resourceError || !resource?.metadata?.name)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <Gauge className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">Resource Quota not found</p>
        <p className="text-sm text-muted-foreground">
          {namespace && name ? `No resource quota "${name}" in namespace "${namespace}".` : 'Missing namespace or name.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/resourcequotas')}>Back to Resource Quotas</Button>
      </div>
    );
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Resource Usage</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(hard).map(([key, hardVal]) => {
                  const usedVal = used[key] ?? '0';
                  const percent = getUsagePercent(usedVal, hardVal);
                  return (
                    <div key={key} className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm font-mono">{key}</span>
                        {percent != null ? (
                          <Badge variant={percent >= 100 ? 'destructive' : percent >= 80 ? 'secondary' : 'default'}>
                            {percent}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">used / hard</span>
                        )}
                      </div>
                      {percent != null && <Progress value={Math.min(percent, 100)} className="h-2" />}
                      <p className="text-xs text-muted-foreground">{usedVal} / {hardVal}</p>
                    </div>
                  );
                })}
              </div>
              {Object.keys(hard).length === 0 && (
                <p className="text-muted-foreground text-sm">No hard limits defined.</p>
              )}
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={labels} variant="badges" />
          {Object.keys(annotations).length > 0 && <MetadataCard title="Annotations" items={annotations} variant="badges" />}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={quotaName} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={quotaName} /> },
    {
      id: 'topology',
      label: 'Topology',
      icon: Network,
      content: (
        <ResourceTopologyView
          kind={normalizeKindForTopology('ResourceQuota')}
          namespace={namespace ?? ''}
          name={name ?? ''}
          sourceResourceType="ResourceQuota"
          sourceResourceName={resource?.metadata?.name ?? name ?? ''}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection
          actions={[
            { icon: Download, label: 'Download YAML', description: 'Export ResourceQuota definition', onClick: handleDownloadYaml },
            { icon: Trash2, label: 'Delete Quota', description: 'Remove this resource quota', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
          ]}
        />
      ),
    },
  ];

  const status: ResourceStatus = overallPct != null && overallPct >= 100 ? 'Failed' : 'Healthy';

  return (
    <>
      <ResourceDetailLayout
        resourceType="ResourceQuota"
        resourceIcon={Gauge}
        name={quotaName}
        namespace={quotaNamespace}
        status={status}
        backLink="/resourcequotas"
        backLabel="Resource Quotas"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {age}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: handleRefresh },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="ResourceQuota"
        resourceName={quotaName}
        namespace={quotaNamespace}
        onConfirm={async () => {
          await deleteResource.mutateAsync({ name: quotaName, namespace: quotaNamespace });
          navigate('/resourcequotas');
        }}
        requireNameConfirmation
      />
    </>
  );
}
