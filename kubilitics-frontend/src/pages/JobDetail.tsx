import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Workflow,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
  Trash2,
  Copy,
  Play,
  Activity,
  Timer,
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
  LogViewer,
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

interface JobResource extends KubernetesResource {
  spec?: {
    completions?: number;
    parallelism?: number;
    backoffLimit?: number;
    activeDeadlineSeconds?: number;
    ttlSecondsAfterFinished?: number;
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
  };
  status?: {
    active?: number;
    succeeded?: number;
    failed?: number;
    startTime?: string;
    completionTime?: string;
    conditions?: Array<{ type: string; status: string; lastTransitionTime: string; reason?: string; message?: string }>;
  };
}

const mockJobResource: JobResource = {
  apiVersion: 'batch/v1',
  kind: 'Job',
  metadata: {
    name: 'data-migration-abc123',
    namespace: 'production',
    uid: 'job-123-456',
    creationTimestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    labels: { 'job-name': 'data-migration-abc123', batch: 'migration' },
  },
  spec: {
    completions: 1,
    parallelism: 1,
    backoffLimit: 6,
    activeDeadlineSeconds: 3600,
    ttlSecondsAfterFinished: 86400,
    template: {
      spec: {
        containers: [{
          name: 'migration',
          image: 'myapp/migration:v1.0',
          command: ['/bin/sh', '-c'],
          args: ['./migrate.sh'],
          resources: { requests: { cpu: '500m', memory: '512Mi' }, limits: { cpu: '1', memory: '1Gi' } },
        }],
        restartPolicy: 'Never',
      },
    },
  },
  status: {
    succeeded: 1,
    failed: 0,
    active: 0,
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    completionTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    conditions: [
      { type: 'Complete', status: 'True', lastTransitionTime: new Date().toISOString(), reason: 'JobComplete' },
    ],
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'job', type: 'job', name: 'data-migration-abc123', namespace: 'production', status: 'healthy', isCurrent: true },
  { id: 'pod-1', type: 'pod', name: 'data-migration-abc123-xyz12', namespace: 'production', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'job', to: 'pod-1', label: 'Created' },
];

const mockEvents = [
  { type: 'Normal' as const, reason: 'SuccessfulCreate', message: 'Created pod: data-migration-abc123-xyz12', time: '2h ago' },
  { type: 'Normal' as const, reason: 'Completed', message: 'Job completed', time: '2h ago' },
];

export default function JobDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<ResourceDetail | null>(null);
  const [selectedLogContainer, setSelectedLogContainer] = useState<string | undefined>(undefined);
  
  const { config } = useKubernetesConfigStore();
  const { resource: job, isLoading, age, yaml, isConnected, refetch } = useResourceDetail<JobResource>(
    'jobs',
    name,
    namespace,
    mockJobResource
  );
  const { events } = useK8sEvents(namespace);
  const deleteJob = useDeleteK8sResource('jobs');
  const updateJob = useUpdateK8sResource('jobs');

  const succeeded = job.status?.succeeded || 0;
  const failed = job.status?.failed || 0;
  const active = job.status?.active || 0;
  const completions = job.spec?.completions || 1;
  
  const status: ResourceStatus = succeeded >= completions ? 'Succeeded' : 
    failed > 0 ? 'Failed' : active > 0 ? 'Running' : 'Pending';
  
  const duration = job.status?.startTime && job.status?.completionTime
    ? calculateAge(job.status.startTime).replace(/ ago$/, '')
    : job.status?.startTime
    ? 'Running...'
    : '-';
  
  const containers: ContainerInfo[] = (job.spec?.template?.spec?.containers || []).map(c => ({
    name: c.name,
    image: c.image,
    ready: status === 'Succeeded',
    restartCount: 0,
    state: status === 'Succeeded' ? 'terminated' : status === 'Running' ? 'running' : 'waiting',
    stateReason: status === 'Succeeded' ? 'Completed' : undefined,
    ports: [],
    resources: c.resources || {},
    currentUsage: { cpu: status === 'Succeeded' ? 0 : Math.floor(Math.random() * 40) + 10, memory: status === 'Succeeded' ? 0 : Math.floor(Math.random() * 50) + 20 },
  }));

  const conditions = job.status?.conditions || [];

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
    a.download = `${job.metadata?.name || 'job'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('YAML downloaded');
  }, [yaml, job.metadata?.name]);

  const handleCopyYaml = useCallback(() => {
    navigator.clipboard.writeText(yaml);
    toast.success('YAML copied to clipboard');
  }, [yaml]);

  const handleSaveYaml = useCallback(async (newYaml: string) => {
    if (isConnected && name && namespace) {
      try {
        await updateJob.mutateAsync({ name, yaml: newYaml, namespace });
        toast.success('Job updated successfully');
        refetch();
      } catch (error: any) {
        toast.error(`Failed to update: ${error.message}`);
        throw error;
      }
    } else {
      toast.success('Job updated (demo mode)');
    }
  }, [isConnected, name, namespace, updateJob, refetch]);

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
    { label: 'Completions', value: `${succeeded}/${completions}`, icon: CheckCircle2, iconColor: succeeded >= completions ? 'success' as const : 'warning' as const },
    { label: 'Failed', value: failed, icon: XCircle, iconColor: failed > 0 ? 'error' as const : 'muted' as const },
    { label: 'Duration', value: duration, icon: Timer, iconColor: 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'primary' as const },
  ];

  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('backoffLimit: 6', 'backoffLimit: 4'), timestamp: '2 hours ago' },
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
                <CardTitle className="text-base">Job Configuration</CardTitle>
                <CardDescription>Execution settings and limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Completions</p>
                    <p className="font-mono text-lg">{completions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Parallelism</p>
                    <p className="font-mono text-lg">{job.spec?.parallelism || 1}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Backoff Limit</p>
                    <p className="font-mono">{job.spec?.backoffLimit || 6}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Active Deadline</p>
                    <p className="font-mono">{job.spec?.activeDeadlineSeconds || '-'}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">TTL After Finished</p>
                    <p className="font-mono">{job.spec?.ttlSecondsAfterFinished || '-'}s</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Restart Policy</p>
                    <Badge variant="outline">{job.spec?.template?.spec?.restartPolicy || 'Never'}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Execution Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Succeeded</span>
                    <div className="flex items-center gap-2">
                      <Progress value={(succeeded / completions) * 100} className="w-32 h-2" />
                      <span className="font-mono text-sm w-12">{succeeded}/{completions}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Active</span>
                    <Badge variant={active > 0 ? 'default' : 'secondary'}>{active}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Failed</span>
                    <Badge variant={failed > 0 ? 'destructive' : 'secondary'}>{failed}</Badge>
                  </div>
                </div>
                {job.status?.startTime && (
                  <div className="pt-3 border-t space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Start Time</span>
                      <span className="font-mono text-xs">{new Date(job.status.startTime).toLocaleString()}</span>
                    </div>
                    {job.status.completionTime && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Completion Time</span>
                        <span className="font-mono text-xs">{new Date(job.status.completionTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {conditions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conditions</CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          )}

          <MetadataCard title="Labels" items={job.metadata?.labels || {}} variant="badges" />
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
      id: 'logs',
      label: 'Logs',
      content: (
        <LogViewer 
          podName={`${name}-xyz12`}
          namespace={namespace}
          containerName={selectedLogContainer || containers[0]?.name}
          containers={containers.map(c => c.name)}
          onContainerChange={setSelectedLogContainer}
        />
      ),
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
      content: <YamlViewer yaml={yaml} resourceName={job.metadata?.name || ''} editable onSave={handleSaveYaml} />,
    },
    {
      id: 'compare',
      label: 'Compare',
      content: <YamlCompareViewer versions={yamlVersions} resourceName={job.metadata?.name || ''} />,
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
          { icon: Play, label: 'View Pod Logs', description: 'See logs from job pod', onClick: () => setActiveTab('logs') },
          { icon: Download, label: 'Download YAML', description: 'Export Job definition', onClick: handleDownloadYaml },
          { icon: Trash2, label: 'Delete Job', description: 'Permanently remove this Job', variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Job"
        resourceIcon={Workflow}
        name={job.metadata?.name || ''}
        namespace={job.metadata?.namespace}
        status={status}
        backLink="/jobs"
        backLabel="Jobs"
        metadata={
          <span className="flex items-center gap-1.5 ml-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Created {age}
            <span className="mx-2">•</span>
            <Activity className="h-3.5 w-3.5" />
            {duration}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Refresh', icon: RefreshCw, variant: 'outline', onClick: () => refetch() },
          { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: () => setShowDeleteDialog(true) },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        resourceType="Job"
        resourceName={job.metadata?.name || ''}
        namespace={job.metadata?.namespace}
        onConfirm={async () => {
          if (isConnected && name && namespace) {
            await deleteJob.mutateAsync({ name, namespace });
            navigate('/jobs');
          } else {
            toast.success(`Job ${name} deleted (demo mode)`);
            navigate('/jobs');
          }
        }}
        requireNameConfirmation
      />
    </motion.div>
  );
}
