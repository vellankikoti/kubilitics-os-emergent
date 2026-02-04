import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  DeleteConfirmDialog,
  type TopologyNode,
  type TopologyEdge,
  type ResourceStatus,
  type ContainerInfo,
  type YamlVersion,
  type ResourceDetail,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { useDeleteK8sResource, useUpdateK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';

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

const mockCronJobResource: CronJobResource = {
  apiVersion: 'batch/v1',
  kind: 'CronJob',
  metadata: {
    name: 'daily-backup',
    namespace: 'production',
    uid: 'cj-123-456',
    creationTimestamp: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'backup', type: 'scheduled' },
  },
  spec: {
    schedule: '0 2 * * *',
    suspend: false,
    concurrencyPolicy: 'Forbid',
    successfulJobsHistoryLimit: 3,
    failedJobsHistoryLimit: 1,
    startingDeadlineSeconds: 300,
    jobTemplate: {
      spec: {
        template: {
          spec: {
            containers: [{
              name: 'backup',
              image: 'backup-tool:v2.0',
              command: ['/bin/sh', '-c'],
              args: ['backup.sh'],
              resources: { requests: { cpu: '200m', memory: '256Mi' }, limits: { cpu: '500m', memory: '512Mi' } },
            }],
            restartPolicy: 'OnFailure',
          },
        },
        backoffLimit: 3,
        activeDeadlineSeconds: 3600,
      },
    },
  },
  status: {
    active: [],
    lastScheduleTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    lastSuccessfulTime: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'cronjob', type: 'cronjob', name: 'daily-backup', namespace: 'production', status: 'healthy', isCurrent: true },
  { id: 'job-1', type: 'job', name: 'daily-backup-28391234', namespace: 'production', status: 'healthy' },
  { id: 'job-2', type: 'job', name: 'daily-backup-28391233', namespace: 'production', status: 'healthy' },
  { id: 'job-3', type: 'job', name: 'daily-backup-28391232', namespace: 'production', status: 'healthy' },
  { id: 'pod-1', type: 'pod', name: 'daily-backup-28391234-abc12', namespace: 'production', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'cronjob', to: 'job-1', label: 'Latest' },
  { from: 'cronjob', to: 'job-2', label: 'History' },
  { from: 'cronjob', to: 'job-3', label: 'History' },
  { from: 'job-1', to: 'pod-1', label: 'Created' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created job daily-backup-28391234', time: '6h ago' },
  { type: 'Normal' as const, reason: 'SawCompletedJob', message: 'Saw completed job: daily-backup-28391234', time: '6h ago' },
  { type: 'Normal' as const, reason: 'SuccessfulDelete', message: 'Deleted job daily-backup-28391231', time: '6h ago' },
];

export default function CronJobDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  
  const { config } = useKubernetesConfigStore();
  const { resource: cronJob, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<CronJobResource>(
    'cronjobs',
    name,
    namespace,
    mockCronJobResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteCronJob = useDeleteK8sResource('cronjobs');
  const updateCronJob = useUpdateK8sResource('cronjobs');

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
    toast.success(`Triggered job from ${name} ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, refetch]);

  const handleToggleSuspend = useCallback(async () => {
    const action = isSuspended ? 'Resumed' : 'Suspended';
    toast.success(`${action} ${name} ${isConnected ? '' : '(demo mode)'}`);
    refetch();
  }, [isConnected, name, isSuspended, refetch]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updateCronJob.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('CronJob updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('CronJob updated (demo mode)');
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

  const statusCards = [
    { label: 'Schedule', value: cronJob.spec?.schedule || '-', icon: Calendar, iconColor: 'primary' as const },
    { label: 'Active Jobs', value: activeJobs, icon: Play, iconColor: activeJobs > 0 ? 'warning' as const : 'success' as const },
    { label: 'Last Schedule', value: lastSchedule, icon: Clock, iconColor: 'info' as const },
    { label: 'Last Success', value: lastSuccess, icon: CheckCircle2, iconColor: 'success' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('0 2 * * *', '0 3 * * *'), timestamp: '1 week ago' },
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
      content: <YamlViewer yaml={yaml} resourceName={cronJob.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={cronJob.metadata?.name || ''} />,
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="CronJob"
        resourceIcon={ClockIcon}
        name={cronJob.metadata?.name || ''}
        namespace={cronJob.metadata?.namespace}
        status={status}
        backLink="/cronjobs"
        backLabel="CronJobs"
        metadata={
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
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Trigger', icon: Play, variant: 'outline', onClick: handleTriggerNow },
          { label: isSuspended ? 'Resume' : 'Suspend', icon: isSuspended ? Play : Pause, variant: 'outline', onClick: handleToggleSuspend },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="CronJob"
        resourceName={cronJob.metadata?.name || ''}
        namespace={cronJob.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteCronJob.mutateAsync({ name, namespace });
            navigate('/cronjobs');
          } else {
            toast.success(`CronJob ${name} deleted (demo mode)`);
            navigate('/cronjobs');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
