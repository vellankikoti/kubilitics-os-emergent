import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Scale, Clock, Download, Trash2, TrendingUp, Server, Cpu, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ResourceDetailLayout,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  ActionsSection,
  DeleteConfirmDialog,
  MetadataCard,
  type ResourceStatus,
  type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, type KubernetesResource } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';

interface HPAResource extends KubernetesResource {
  spec?: {
    scaleTargetRef?: { kind?: string; name?: string; apiVersion?: string };
    minReplicas?: number;
    maxReplicas?: number;
    metrics?: Array<{
      type?: string;
      resource?: { name?: string; target?: { type?: string; averageUtilization?: number } };
    }>;
  };
  status?: {
    currentReplicas?: number;
    desiredReplicas?: number;
    currentMetrics?: Array<{
      resource?: { name?: string; current?: { averageUtilization?: number } };
    }>;
    lastScaleTime?: string;
    conditions?: Array<{ type?: string; status?: string; reason?: string; message?: string }>;
  };
}

export default function HorizontalPodAutoscalerDetail() {
  const { namespace, name } = useParams<{ namespace: string; name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { isConnected } = useConnectionStatus();

  const { resource, isLoading, error: resourceError, age, yaml, refetch } = useResourceDetail<HPAResource>(
    'horizontalpodautoscalers',
    name ?? undefined,
    namespace ?? undefined,
    undefined as unknown as HPAResource
  );
  const { events, refetch: refetchEvents } = useResourceEvents('HorizontalPodAutoscaler', namespace ?? undefined, name ?? undefined);
  const deleteResource = useDeleteK8sResource('horizontalpodautoscalers');

  const hpaName = resource?.metadata?.name ?? name ?? '';
  const hpaNamespace = resource?.metadata?.namespace ?? namespace ?? '';
  const ref = resource?.spec?.scaleTargetRef;
  const targetKind = ref?.kind ?? '–';
  const targetName = ref?.name ?? '–';
  const minReplicas = resource?.spec?.minReplicas ?? 1;
  const maxReplicas = resource?.spec?.maxReplicas ?? 1;
  const currentReplicas = resource?.status?.currentReplicas ?? 0;
  const desiredReplicas = resource?.status?.desiredReplicas ?? currentReplicas;
  const metrics = resource?.spec?.metrics ?? [];
  const currentMetrics = resource?.status?.currentMetrics ?? [];
  const conditions = resource?.status?.conditions ?? [];
  const labels = resource?.metadata?.labels ?? {};
  const annotations = resource?.metadata?.annotations ?? {};

  const cpuTarget = metrics.find((m) => m.resource?.name === 'cpu')?.resource?.target?.averageUtilization;
  const cpuCurrent = currentMetrics.find((m) => m.resource?.name === 'cpu')?.resource?.current?.averageUtilization;

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
    a.download = `${hpaName || 'hpa'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml, hpaName]);

  const yamlVersions: YamlVersion[] = yaml ? [{ id: 'current', label: 'Current Version', yaml, timestamp: 'now' }] : [];

  const statusCards = [
    { label: 'Current / Desired', value: `${currentReplicas} / ${desiredReplicas}`, icon: Server, iconColor: 'primary' as const },
    { label: 'Min / Max', value: `${minReplicas} / ${maxReplicas}`, icon: Scale, iconColor: 'muted' as const },
    { label: 'CPU', value: cpuCurrent != null && cpuTarget != null ? `${cpuCurrent}% / ${cpuTarget}%` : '–', icon: Cpu, iconColor: 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const targetLink = () => {
    const kind = (targetKind || '').toLowerCase();
    if (kind === 'deployment') return `/deployments/${hpaNamespace}/${targetName}`;
    if (kind === 'statefulset') return `/statefulsets/${hpaNamespace}/${targetName}`;
    if (kind === 'replicaset') return `/replicasets/${hpaNamespace}/${targetName}`;
    return '#';
  };

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
        <Scale className="h-12 w-12 text-muted-foreground" />
        <p className="text-lg font-medium">HPA not found</p>
        <p className="text-sm text-muted-foreground">
          {namespace && name ? `No HPA "${name}" in namespace "${namespace}".` : 'Missing namespace or name.'}
        </p>
        <Button variant="outline" onClick={() => navigate('/horizontalpodautoscalers')}>Back to HPAs</Button>
      </div>
    );
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Scale Target</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground text-sm mb-1">Reference</p>
                {targetName !== '–' ? (
                  <Button variant="link" className="p-0 h-auto font-mono text-primary" onClick={() => navigate(targetLink())}>{targetKind}/{targetName}</Button>
                ) : (
                  <p className="font-mono">–</p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{minReplicas}</p>
                  <p className="text-xs text-muted-foreground">Min</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-2xl font-bold text-primary">{currentReplicas}</p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{maxReplicas}</p>
                  <p className="text-xs text-muted-foreground">Max</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Desired replicas: <span className="font-mono">{desiredReplicas}</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Metrics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {metrics.length === 0 ? (
                <p className="text-muted-foreground text-sm">No metrics configured.</p>
              ) : (
                metrics.map((metric, i) => {
                  const resName = metric.resource?.name ?? 'resource';
                  const target = metric.resource?.target?.averageUtilization;
                  const current = currentMetrics.find((m) => m.resource?.name === resName)?.resource?.current?.averageUtilization;
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{resName}</span>
                        <span className="font-mono text-sm">{current != null ? `${current}%` : '–'} / {target != null ? `${target}%` : '–'}</span>
                      </div>
                      {target != null && current != null && <Progress value={Math.min(Math.round((current / target) * 100), 100)} className="h-2" />}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              {conditions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No conditions.</p>
              ) : (
                <div className="space-y-2">
                  {conditions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="font-medium">{c.type}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.status === 'True' ? 'default' : 'secondary'}>{c.status}</Badge>
                        {c.reason && <span className="text-sm text-muted-foreground">{c.reason}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={labels} variant="badges" />
          {Object.keys(annotations).length > 0 && <MetadataCard title="Annotations" items={annotations} variant="badges" />}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={hpaName} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={hpaName} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection
          actions={[
            { icon: TrendingUp, label: 'Edit Scaling', description: 'Modify min/max replicas and metrics', onClick: () => toast.info('Edit not implemented') },
            { icon: Download, label: 'Download YAML', description: 'Export HPA definition', onClick: handleDownloadYaml },
            { icon: Trash2, label: 'Delete HPA', description: 'Remove this autoscaler', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
          ]}
        />
      ),
    },
  ];

  const status: ResourceStatus = currentReplicas === desiredReplicas ? 'Healthy' : 'Progressing';

  return (
    <>
      <ResourceDetailLayout
        resourceType="HorizontalPodAutoscaler"
        resourceIcon={Scale}
        name={hpaName}
        namespace={hpaNamespace}
        status={status}
        backLink="/horizontalpodautoscalers"
        backLabel="HPAs"
        headerMetadata={<span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />Created {age}</span>}
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: handleRefresh },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Edit', icon: TrendingUp, variant: 'outline', onClick: () => toast.info('Edit not implemented') },
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
        resourceType="HorizontalPodAutoscaler"
        resourceName={hpaName}
        namespace={hpaNamespace}
        onConfirm={async () => {
          await deleteResource.mutateAsync({ name: hpaName, namespace: hpaNamespace });
          navigate('/horizontalpodautoscalers');
        }}
        requireNameConfirmation
      />
    </>
  );
}
