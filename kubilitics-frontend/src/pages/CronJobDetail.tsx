import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Clock as ClockIcon,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  CheckCircle2,
  Calendar,
  History,
  Box,
  FileText,
  Terminal,
  Workflow,
  LayoutDashboard,
  Layers,
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
import { toast } from 'sonner';
import {
  ResourceDetailLayout,
  ContainersSection,
  YamlViewer,
  YamlCompareViewer,
  EventsSection,
  MetadataCard,
  ActionsSection,
  MetricsDashboard,
  DeleteConfirmDialog,
  SectionCard,
  LogViewer,
  TerminalViewer,
  ResourceTopologyView,
  type ResourceStatus,
  type ContainerInfo,
  type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useResourceEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, usePatchK8sResource, useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { normalizeKindForTopology } from '@/utils/resourceKindMapper';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useBackendConfigStore, getEffectiveBackendBaseUrl } from '@/stores/backendConfigStore';
import { useClusterStore } from '@/stores/clusterStore';
import { useActiveClusterId } from '@/hooks/useActiveClusterId';
import { Breadcrumbs, useDetailBreadcrumbs } from '@/components/layout/Breadcrumbs';
import { useQuery } from '@tanstack/react-query';
import { postCronJobTrigger } from '@/services/backendApiClient';

interface CronJobResource extends KubernetesResource {
  spec?: {
    schedule?: string;
    suspend?: boolean;
    concurrencyPolicy?: string;
    successfulJobsHistoryLimit?: number;
    failedJobsHistoryLimit?: number;
    startingDeadlineSeconds?: number;
    jobTemplate?: {
      spec?: {
        template?: {
          spec?: {
            containers?: Array<{
              name: string;
              image: string;
              command?: string[];
              args?: string[];
              resources?: { requests?: { cpu?: string; memory?: string }; limits?: { cpu?: string; memory?: string } };
            }>;
            restartPolicy?: string;
          };
        };
        backoffLimit?: number;
        activeDeadlineSeconds?: number;
      };
    };
  };
  status?: {
    active?: Array<{ name: string; namespace: string }>;
    lastScheduleTime?: string;
    lastSuccessfulTime?: string;
  };
}

export default function CronJobDetail() {
  const { namespace, name } = useParams();
  const clusterId = useActiveClusterId();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLogPod, setSelectedLogPod] = useState<string>('');
  const [selectedLogContainer, setSelectedLogContainer] = useState<string>('');
  const [selectedTerminalPod, setSelectedTerminalPod] = useState<string>('');
  const [selectedTerminalContainer, setSelectedTerminalContainer] = useState<string>('');
  
  const { isConnected } = useConnectionStatus();
  const { activeCluster } = useClusterStore();
  const breadcrumbSegments = useDetailBreadcrumbs('CronJob', name ?? undefined, namespace ?? undefined, activeCluster?.name);
  const { resource: cronJob, isLoading, error, age, yaml, refetch } = useResourceDetail<CronJobResource>(
    'cronjobs',
    name,
    namespace,
    {} as CronJobResource
  );
  const resourceEvents = useResourceEvents('CronJob', namespace ?? undefined, name ?? undefined);
  const displayEvents = resourceEvents.events;
  const backendBaseUrl = getEffectiveBackendBaseUrl(useBackendConfigStore((s) => s.backendBaseUrl));
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured);
  const deleteCronJob = useDeleteK8sResource('cronjobs');
  const updateCronJob = useUpdateK8sResource('cronjobs');
  const patchCronJob = usePatchK8sResource('cronjobs');

  const isSuspended = cronJob.spec?.suspend || false;
  const status: ResourceStatus = isSuspended ? 'Pending' : 'Running';
  const activeJobs = cronJob.status?.active?.length || 0;
  const lastSchedule = cronJob.status?.lastScheduleTime 
    ? calculateAge(cronJob.status.lastScheduleTime) + ' ago'
    : 'Never';
  const lastSuccess = cronJob.status?.lastSuccessfulTime
    ? calculateAge(cronJob.status.lastSuccessfulTime) + ' ago'
    : 'Never';
  
  const containers: ContainerInfo[] = (cronJob.spec?.jobTemplate?.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: true,
    restartCount: 0,
    state: 'running',
    ports: [],
    resources: c.resources || {},
  }));

  type JobLike = KubernetesResource & { metadata?: { name?: string; ownerReferences?: Array<{ kind?: string; name?: string }> } };
  type PodLike = KubernetesResource & { metadata?: { name?: string; labels?: Record<string, string> }; status?: { phase?: string }; spec?: { nodeName?: string; containers?: Array<{ name: string }> } };
  const { data: jobsList } = useK8sResourceList<JobLike>('jobs', namespace ?? undefined, { enabled: !!namespace && !!name, limit: 5000 });
  const childJobs = (jobsList?.items ?? []).filter((job) => job.metadata?.ownerReferences?.some((ref) => ref.kind === 'CronJob' && ref.name === name));
  const childJobNames = new Set(childJobs.map((j) => j.metadata?.name).filter(Boolean) as string[]);

  const { data: podsList } = useK8sResourceList<PodLike>('pods', namespace ?? undefined, { enabled: !!namespace && childJobNames.size > 0, limit: 5000 });
  const cjPods = (podsList?.items ?? []).filter((pod) => {
    const jobName = pod.metadata?.labels?.['job-name'];
    return !!jobName && childJobNames.has(jobName);
  });
  const firstCjPodName = cjPods[0]?.metadata?.name ?? '';
  const logPod = selectedLogPod || firstCjPodName;
  const terminalPod = selectedTerminalPod || firstCjPodName;
  const logPodContainers = cjPods.find((p) => p.metadata?.name === logPod)?.spec?.containers?.map((c) => c.name) ?? containers.map((c) => c.name);
  const terminalPodContainers = cjPods.find((p) => p.metadata?.name === terminalPod)?.spec?.containers?.map((c) => c.name) ?? containers.map((c) => c.name);


  const handleDownloadYaml = useCallback(() => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cronJob.metadata?.name || 'cronjob'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, cronJob.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleTriggerNow = useCallback(async () => {
    if (!isConnected || !name || !namespace) { toast.error('Connect cluster to trigger CronJob'); return; }
    if (!isBackendConfigured()) {
      toast.error('Connect to Kubilitics backend and select a cluster to trigger CronJob.');
      return;
    }
    const cid = useClusterStore.getState().activeCluster?.id ?? useBackendConfigStore.getState().currentClusterId;
    if (!cid) {
      toast.error('Select a cluster from the cluster list to perform this action.');
      return;
    }
    const backendBase = getEffectiveBackendBaseUrl(useBackendConfigStore.getState().backendBaseUrl);
    try {
      await postCronJobTrigger(backendBase, cid, namespace, name);
      toast.success(`Triggered Job from CronJob ${name}`);
      refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg ?? 'Trigger failed');
      throw e;
    }
  }, [isConnected, name, namespace, refetch]);

  const handleToggleSuspend = useCallback(async () => {
    if (!isConnected || !name || !namespace) { toast.error('Connect cluster to suspend/resume CronJob'); return; }
    try {
      await patchCronJob.mutateAsync({
        name,
        namespace,
        patch: { spec: { suspend: !isSuspended } },
      });
      toast.success(isSuspended ? `Resumed ${name}` : `Suspended ${name}`);
      refetch();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update');
      throw err;
    }
  }, [isConnected, name, namespace, isSuspended, patchCronJob, refetch]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (!isConnected || !name || !namespace) {
      toast.error('Connect cluster to update CronJob');
      throw new Error('Not connected');
    }
    try {
      await updateCronJob.mutateAsync({ name, yaml: newYaml, namespace });
      toast.success('CronJob updated successfully');
      refetch();
    } catch (error: any) {
      toast.error(`Failed to update: ${error.message}`);
      throw error;
    }
  }, [isConnected, name, namespace, updateCronJob, refetch]);

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

  if (!cronJob?.metadata?.name) {
    return (
      <div className="space-y-4 p-6">
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">CronJob not found.</p>
            {error && <p className="text-sm text-destructive mt-2">{String(error)}</p>}
            <Button variant="outline" className="mt-4" onClick={() => navigate('/cronjobs')}>
              Back to CronJobs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheduleStr = cronJob.spec?.schedule || '-';
  const scheduleHuman = scheduleStr !== '-' && /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/.test(scheduleStr)
    ? (scheduleStr.startsWith('*/') ? `Every ${scheduleStr.slice(2).split(' ')[0]} min` : scheduleStr)
    : scheduleStr;
  const nextRunStr = scheduleStr !== '-' ? (() => {
    const parts = scheduleStr.trim().split(/\s+/);
    if (parts.length < 5 || !parts[0].startsWith('*/')) return '-';
    const n = parseInt(parts[0].slice(2), 10);
    if (!Number.isFinite(n) || n < 1) return '-';
    const now = new Date();
    const currMin = now.getMinutes();
    const nextMin = Math.ceil((currMin + 1) / n) * n;
    const next = new Date(now);
    if (nextMin >= 60) { next.setMinutes(0); next.setHours(next.getHours() + 1); } else { next.setMinutes(nextMin); }
    const secs = Math.round((next.getTime() - now.getTime()) / 1000);
    return secs < 60 ? 'in <1m' : secs < 3600 ? `in ${Math.floor(secs / 60)}m` : next.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  })() : '-';
  const lastResult = cronJob.status?.lastSuccessfulTime ? 'Success' : activeJobs > 0 ? 'Running' : '-';
  const successRate7d = '-';

  const statusCards = [
    { label: 'Status', value: isSuspended ? 'Suspended' : 'Active', icon: isSuspended ? Pause : Play, iconColor: isSuspended ? 'warning' as const : 'success' as const },
    { label: 'Schedule', value: scheduleHuman, icon: Calendar, iconColor: 'primary' as const },
    { label: 'Next run', value: nextRunStr, icon: Clock, iconColor: 'info' as const },
    { label: 'Last run', value: lastSchedule + (lastResult !== '-' ? ` (${lastResult})` : ''), icon: History, iconColor: 'muted' as const },
    { label: 'Active jobs', value: activeJobs, icon: Play, iconColor: activeJobs > 0 ? 'warning' as const : 'muted' as const },
    { label: 'Success rate (7d)', value: successRate7d, icon: CheckCircle2, iconColor: 'muted' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CronJob Configuration</CardTitle>
                <CardDescription>Schedule and execution settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Schedule</p>
                    <Badge variant="outline" className="font-mono">{cronJob.spec?.schedule || '-'}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Status</p>
                    <Badge variant={isSuspended ? 'secondary' : 'default'}>
                      {isSuspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Concurrency Policy</p>
                    <p className="font-medium">{cronJob.spec?.concurrencyPolicy || 'Allow'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Starting Deadline</p>
                    <p className="font-mono">{cronJob.spec?.startingDeadlineSeconds || '-'}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Successful History</p>
                    <p className="font-mono">{cronJob.spec?.successfulJobsHistoryLimit || 3}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Failed History</p>
                    <p className="font-mono">{cronJob.spec?.failedJobsHistoryLimit || 1}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Job Template</CardTitle>
                <CardDescription>Template for spawned jobs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Backoff Limit</p>
                    <p className="font-mono">{cronJob.spec?.jobTemplate?.spec?.backoffLimit || 6}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Active Deadline</p>
                    <p className="font-mono">{cronJob.spec?.jobTemplate?.spec?.activeDeadlineSeconds || '-'}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Restart Policy</p>
                    <p className="font-medium">{cronJob.spec?.jobTemplate?.spec?.template?.spec?.restartPolicy || 'Never'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Containers</p>
                    <p className="font-mono">{containers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {cronJob.status?.active && cronJob.status.active.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Active Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {cronJob.status.active.map((job, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Play className="h-4 w-4 text-[hsl(var(--warning))]" />
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          onClick={() => navigate(`/jobs/${job.namespace}/${job.name}`)}
                        >
                          {job.name}
                        </Button>
                      </div>
                      <Badge>Running</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <MetadataCard title="Labels" items={cronJob.metadata?.labels || {}} variant="badges" />
        </div>
      ),
    },
    {
      id: 'scheduleDetails',
      label: 'Schedule Details',
      icon: Calendar,
      content: (
        <SectionCard icon={Calendar} title="Schedule Details" tooltip={<p className="text-xs text-muted-foreground">Cron expression and next runs</p>}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Cron expression</p>
                <Badge variant="outline" className="font-mono">{scheduleStr}</Badge>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Human-readable</p>
                <p className="font-medium">{scheduleHuman}</p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Next run</p>
                <p className="font-mono">{nextRunStr}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Cron format: minute hour day-of-month month day-of-week. Next N runs can be computed client-side with a cron library.</p>
          </div>
        </SectionCard>
      ),
    },
    {
      id: 'jobsHistory',
      label: 'Jobs History',
      icon: History,
      badge: childJobs.length.toString(),
      content: (
        <SectionCard icon={History} title="Jobs History" tooltip={<p className="text-xs text-muted-foreground">Child jobs with status and duration</p>}>
          {childJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs created by this CronJob yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Start Time</th>
                    <th className="text-left p-3 font-medium">Duration</th>
                    <th className="text-left p-3 font-medium">Completions</th>
                  </tr>
                </thead>
                <tbody>
                  {childJobs.slice(0, 50).map((job) => {
                    const jobName = job.metadata?.name ?? '';
                    const jobNs = job.metadata?.namespace ?? namespace ?? '';
                    const jStatus = job.status as { succeeded?: number; failed?: number; active?: number; startTime?: string; completionTime?: string } | undefined;
                    const succeeded = jStatus?.succeeded ?? 0;
                    const completions = (job.spec as { completions?: number } | undefined)?.completions ?? 1;
                    const statusStr = succeeded >= completions ? 'Succeeded' : jStatus?.failed ? 'Failed' : 'Running';
                    const startTime = jStatus?.startTime;
                    const endTime = jStatus?.completionTime;
                    let durationStr = '-';
                    if (startTime && endTime) {
                      const sec = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
                      durationStr = sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m` : `${Math.floor(sec / 3600)}h`;
                    } else if (startTime) durationStr = 'Running';
                    return (
                      <tr key={jobName} className="border-t">
                        <td className="p-3">
                          <Link to={`/jobs/${jobNs}/${jobName}`} className="text-primary hover:underline font-medium">{jobName}</Link>
                        </td>
                        <td className="p-3"><Badge variant={statusStr === 'Succeeded' ? 'default' : statusStr === 'Failed' ? 'destructive' : 'secondary'}>{statusStr}</Badge></td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{startTime ? new Date(startTime).toLocaleString() : '-'}</td>
                        <td className="p-3 font-mono">{durationStr}</td>
                        <td className="p-3 font-mono">{succeeded}/{completions}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {childJobs.length > 50 && <p className="p-3 text-xs text-muted-foreground">Showing first 50 of {childJobs.length} jobs.</p>}
            </div>
          )}
        </SectionCard>
      ),
    },
    {
      id: 'executionTimeline',
      label: 'Execution Timeline',
      icon: Clock,
      content: (
        <SectionCard icon={Clock} title="Execution Timeline" tooltip={<p className="text-xs text-muted-foreground">Runs over time</p>}>
          {childJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No job runs to display.</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {childJobs.slice(0, 30).map((job) => {
                const jobName = job.metadata?.name ?? '';
                const jobNs = job.metadata?.namespace ?? namespace ?? '';
                const jStatus = job.status as { succeeded?: number; startTime?: string; completionTime?: string } | undefined;
                const startTime = jStatus?.startTime;
                const endTime = jStatus?.completionTime;
                const result = (job.spec as { completions?: number } | undefined)?.completions && jStatus?.succeeded >= ((job.spec as { completions?: number }).completions ?? 1) ? 'Success' : endTime ? 'Failed' : 'Running';
                return (
                  <div key={jobName} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-mono text-muted-foreground w-32 shrink-0">{startTime ? new Date(startTime).toLocaleTimeString() : '-'}</span>
                    <div className="flex-1 min-w-0">
                      <Link to={`/jobs/${jobNs}/${jobName}`} className="text-primary hover:underline font-medium truncate block">{jobName}</Link>
                    </div>
                    <Badge variant={result === 'Success' ? 'default' : result === 'Failed' ? 'destructive' : 'secondary'} className="shrink-0">{result}</Badge>
                  </div>
                );
              })}
              {childJobs.length > 30 && <p className="text-xs text-muted-foreground">Showing last 30 runs.</p>}
            </div>
          )}
        </SectionCard>
      ),
    },
    {
      id: 'concurrencyPolicy',
      label: 'Concurrency Policy',
      icon: Settings,
      content: (
        <SectionCard icon={Settings} title="Concurrency Policy" tooltip={<p className="text-xs text-muted-foreground">How overlapping runs are handled</p>}>
          <div className="space-y-3">
            <Badge variant="outline" className="text-base">{cronJob.spec?.concurrencyPolicy || 'Allow'}</Badge>
            <p className="text-sm text-muted-foreground">
              <strong>Allow</strong>: New job runs even if the previous run has not finished.
              <br /><strong>Forbid</strong>: Skip the new run if the previous run is still active.
              <br /><strong>Replace</strong>: Cancel the current run and start a new one.
            </p>
          </div>
        </SectionCard>
      ),
    },
    {
      id: 'alerts',
      label: 'Alerts & Notifications',
      icon: CalendarClock,
      content: (
        <SectionCard icon={CalendarClock} title="Alerts & Notifications" tooltip={<p className="text-xs text-muted-foreground">Configure later when backend supports it</p>}>
          <p className="text-sm text-muted-foreground">Configure alerts and notifications when backend support is available.</p>
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
      id: 'jobs',
      label: 'Jobs',
      icon: Workflow,
      badge: childJobs.length.toString(),
      content: (
        <SectionCard icon={Workflow} title="Jobs" tooltip={<p className="text-xs text-muted-foreground">Jobs created by this CronJob</p>}>
          {childJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Jobs created by this CronJob yet.</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Name</th>
                    <th className="text-left p-3 font-medium">Age</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {childJobs.map((job) => {
                    const jobName = job.metadata?.name ?? '';
                    const jobNs = job.metadata?.namespace ?? namespace ?? '';
                    const created = job.metadata?.creationTimestamp ? calculateAge(job.metadata.creationTimestamp) : '-';
                    return (
                      <tr key={jobName} className="border-t">
                        <td className="p-3">
                          <Link to={`/jobs/${jobNs}/${jobName}`} className="text-primary hover:underline font-medium">
                            {jobName}
                          </Link>
                        </td>
                        <td className="p-3">{created}</td>
                        <td className="p-3">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/jobs/${jobNs}/${jobName}`}>View</Link>
                          </Button>
                        </td>
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
      id: 'pods',
      label: 'Pods',
      icon: Box,
      badge: cjPods.length.toString(),
      content: (
        <SectionCard icon={Box} title="Pods" tooltip={<p className="text-xs text-muted-foreground">Pods from Jobs created by this CronJob</p>}>
          {cjPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods from CronJob Jobs yet.</p>
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
                  {cjPods.map((pod) => {
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
      id: 'logs',
      label: 'Logs',
      icon: FileText,
      content: (
        <SectionCard icon={FileText} title="Logs" tooltip={<p className="text-xs text-muted-foreground">Stream logs from CronJob Job pods</p>}>
          {cjPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods available to view logs.</p>
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
                      {cjPods.map((p) => (
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
              <LogViewer podName={logPod} namespace={namespace ?? undefined} containerName={selectedLogContainer || logPodContainers[0]} containers={logPodContainers} onContainerChange={setSelectedLogContainer} />
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
        <SectionCard icon={Terminal} title="Terminal" tooltip={<p className="text-xs text-muted-foreground">Exec into CronJob Job pods</p>}>
          {cjPods.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pods available for terminal.</p>
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
                      {cjPods.map((p) => (
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
              <TerminalViewer podName={terminalPod} namespace={namespace ?? undefined} containerName={selectedTerminalContainer || terminalPodContainers[0]} containers={terminalPodContainers} onContainerChange={setSelectedTerminalContainer} />
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
      content: <MetricsDashboard resourceType="cronjob" resourceName={name} namespace={namespace} clusterId={clusterId} />,
    },
    {
      id: 'yaml',
      label: 'YAML',
      icon: FileCode,
      content: <YamlViewer yaml={yaml} resourceName={cronJob.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      icon: GitCompare,
      content: <YamlCompareViewer versions={yamlVersions} resourceName={cronJob.metadata?.name || ''} />,
    },
    {
      id: 'topology',
      label: 'Topology',
      icon: Network,
      content: (
        <ResourceTopologyView
          kind={normalizeKindForTopology('CronJob')}
          namespace={namespace || cronJob?.metadata?.namespace || ''}
          name={name || cronJob?.metadata?.name || ''}
          sourceResourceType="CronJob"
          sourceResourceName={cronJob?.metadata?.name ?? name ?? ''}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      icon: Settings,
      content: (
        <ActionsSection actions={[
          { icon: Play, label: 'Trigger Now', description: 'Manually trigger a job run', onClick: handleTriggerNow },
          { icon: isSuspended ? Play : Pause, label: isSuspended ? 'Resume' : 'Suspend', description: isSuspended ? 'Resume scheduled runs' : 'Pause scheduled runs', onClick: handleToggleSuspend },
          { icon: History, label: 'View Job History', description: 'See all spawned jobs', onClick: () => navigate(`/jobs?cronjob=${name}`) },
          { icon: Download, label: 'Download YAML', description: 'Export CronJob definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete CronJob', description: 'Permanently remove this CronJob', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <>
      <ResourceDetailLayout
        resourceType="CronJob"
        resourceIcon={ClockIcon}
        name={cronJob.metadata?.name || ''}
        namespace={cronJob.metadata?.namespace}
        status={status}
        backLink="/cronjobs"
        backLabel="CronJobs"
        headerMetadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Calendar className="h-3.5 w-3.5" />
            {cronJob.spec?.schedule}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => { refetch(); resourceEvents.refetch(); } },
          { label: 'Download YAML', icon: Download, variant: 'outline', onClick: handleDownloadYaml },
          { label: 'Trigger', icon: Play, variant: 'outline', onClick: handleTriggerNow },
          { label: isSuspended ? 'Resume' : 'Suspend', icon: isSuspended ? Play : Pause, variant: 'outline', onClick: handleToggleSuspend },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
        statusCards={statusCards}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        <Breadcrumbs segments={breadcrumbSegments} className="mb-2" />
      </ResourceDetailLayout>

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="CronJob"
        resourceName={cronJob.metadata?.name || ''}
        namespace={cronJob.metadata?.namespace}
        onConfirm={async () => {
          if (!isConnected || !name || !namespace) {
            toast.error('Connect cluster to delete CronJob');
            return;
          }
          await deleteCronJob.mutateAsync({ name, namespace });
          toast.success(`CronJob ${name} deleted`);
          navigate('/cronjobs');
        }}
        requireNameConfirmation
      />
    </>
  );
}
