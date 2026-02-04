import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Folder, Clock, Download, Trash2, Box, Globe, Settings, Layers, Package, Database, Shield, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { type KubernetesResource } from '@/hooks/useKubernetes';

interface NamespaceResource extends KubernetesResource {
  spec?: {
    finalizers?: string[];
  };
  status?: {
    phase?: string;
  };
}

const mockNamespaceResource: NamespaceResource = {
  apiVersion: 'v1',
  kind: 'Namespace',
  metadata: {
    name: 'production',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { environment: 'production', team: 'platform' },
    annotations: { 'kubernetes.io/description': 'Production workloads' },
  },
  spec: {
    finalizers: ['kubernetes'],
  },
  status: {
    phase: 'Active',
  },
};

// Mock resource counts in namespace
const mockResourceCounts = {
  pods: { running: 42, total: 45 },
  deployments: { available: 12, total: 12 },
  services: { total: 8 },
  configmaps: { total: 24 },
  secrets: { total: 15 },
  persistentVolumeClaims: { total: 6 },
  serviceAccounts: { total: 4 },
  roles: { total: 3 },
};

// Mock ResourceQuota
const mockResourceQuota = {
  name: 'production-quota',
  hard: { 'requests.cpu': '16', 'requests.memory': '32Gi', 'limits.cpu': '32', 'limits.memory': '64Gi', pods: '100' },
  used: { 'requests.cpu': '12', 'requests.memory': '24Gi', 'limits.cpu': '20', 'limits.memory': '40Gi', pods: '45' },
};

// Mock LimitRange
const mockLimitRange = {
  name: 'production-limits',
  limits: [
    { type: 'Container', default: { cpu: '500m', memory: '512Mi' }, defaultRequest: { cpu: '100m', memory: '128Mi' } },
  ],
};

const topologyNodes: TopologyNode[] = [
  { id: 'ns', type: 'namespace', name: 'production', status: 'healthy', isCurrent: true },
  { id: 'deploy1', type: 'deployment', name: 'nginx-deployment', status: 'healthy' },
  { id: 'deploy2', type: 'deployment', name: 'api-deployment', status: 'healthy' },
  { id: 'deploy3', type: 'deployment', name: 'worker-deployment', status: 'healthy' },
  { id: 'svc1', type: 'service', name: 'nginx-svc', status: 'healthy' },
  { id: 'svc2', type: 'service', name: 'api-svc', status: 'healthy' },
  { id: 'cm1', type: 'configmap', name: 'app-config', status: 'healthy' },
  { id: 'secret1', type: 'secret', name: 'app-secrets', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'ns', to: 'deploy1', label: 'Contains' },
  { from: 'ns', to: 'deploy2', label: 'Contains' },
  { from: 'ns', to: 'deploy3', label: 'Contains' },
  { from: 'ns', to: 'svc1', label: 'Contains' },
  { from: 'ns', to: 'svc2', label: 'Contains' },
  { from: 'ns', to: 'cm1', label: 'Contains' },
  { from: 'ns', to: 'secret1', label: 'Contains' },
];

export default function NamespaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { resource: ns, isLoading, age, yaml, isConnected } = useResourceDetail<NamespaceResource>(
    'namespaces',
    name,
    undefined,
    mockNamespaceResource
  );
  const { events } = useK8sEvents(name);

  const nsName = ns.metadata?.name || '';
  const labels = ns.metadata?.labels || {};
  const annotations = ns.metadata?.annotations || {};
  const phase = ns.status?.phase || 'Active';
  const status: ResourceStatus = phase === 'Active' ? 'Healthy' : phase === 'Terminating' ? 'Warning' : 'Unknown';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('environment: production', 'environment: staging'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('team: platform', 'team: backend'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Namespace updated successfully');
    console.log('Saving YAML:', newYaml);
  };

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
    { label: 'Phase', value: phase, icon: Box, iconColor: phase === 'Active' ? 'success' as const : 'warning' as const },
    { label: 'Pods', value: `${mockResourceCounts.pods.running}/${mockResourceCounts.pods.total}`, icon: Package, iconColor: 'primary' as const },
    { label: 'Deployments', value: mockResourceCounts.deployments.total, icon: Layers, iconColor: 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${nsName}/${node.name}`);
    else if (node.type === 'service') navigate(`/services/${nsName}/${node.name}`);
    else if (node.type === 'configmap') navigate(`/configmaps/${nsName}/${node.name}`);
    else if (node.type === 'secret') navigate(`/secrets/${nsName}/${node.name}`);
  };

  // Calculate quota percentages
  const getQuotaPercentage = (resource: string) => {
    const used = parseFloat(mockResourceQuota.used[resource as keyof typeof mockResourceQuota.used] || '0');
    const hard = parseFloat(mockResourceQuota.hard[resource as keyof typeof mockResourceQuota.hard] || '1');
    return Math.round((used / hard) * 100);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Namespace Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Namespace Info</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Phase</p>
                    <Badge variant={phase === 'Active' ? 'default' : 'secondary'}>{phase}</Badge>
                  </div>
                  <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
                  <div><p className="text-muted-foreground mb-1">Labels</p><p>{Object.keys(labels).length} labels</p></div>
                  <div><p className="text-muted-foreground mb-1">Annotations</p><p>{Object.keys(annotations).length} annotations</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Labels */}
            <MetadataCard title="Labels" items={labels} variant="badges" />

            {/* Resource Counts */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Resources in Namespace</CardTitle>
                <CardDescription>Count of resources in this namespace</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/pods?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Pods</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.pods.running}</p>
                    <p className="text-xs text-muted-foreground">{mockResourceCounts.pods.total - mockResourceCounts.pods.running} pending</p>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/deployments?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="h-4 w-4 text-info" />
                      <span className="text-sm font-medium">Deployments</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.deployments.total}</p>
                    <p className="text-xs text-muted-foreground">{mockResourceCounts.deployments.available} available</p>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/services?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Globe className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">Services</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.services.total}</p>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/configmaps?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-warning" />
                      <span className="text-sm font-medium">ConfigMaps</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.configmaps.total}</p>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/secrets?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium">Secrets</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.secrets.total}</p>
                  </div>
                  <div 
                    className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/persistentvolumeclaims?namespace=${nsName}`)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-accent" />
                      <span className="text-sm font-medium">PVCs</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.persistentVolumeClaims.total}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Box className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">ServiceAccounts</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.serviceAccounts.total}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Roles</span>
                    </div>
                    <p className="text-2xl font-bold">{mockResourceCounts.roles.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: 'quotas',
      label: 'Quotas & Limits',
      content: (
        <div className="space-y-6">
          {/* Resource Quota */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resource Quota: {mockResourceQuota.name}</CardTitle>
              <CardDescription>Resource usage limits for this namespace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(mockResourceQuota.hard).map(([resource, limit]) => {
                  const used = mockResourceQuota.used[resource as keyof typeof mockResourceQuota.used] || '0';
                  const percentage = getQuotaPercentage(resource);
                  return (
                    <div key={resource}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{resource}</span>
                        <span className="font-mono text-muted-foreground">{used} / {limit}</span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className={`h-2 ${percentage > 90 ? '[&>div]:bg-destructive' : percentage > 75 ? '[&>div]:bg-warning' : ''}`} 
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Limit Range */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Limit Range: {mockLimitRange.name}</CardTitle>
              <CardDescription>Default resource limits for containers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockLimitRange.limits.map((limit, i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/50">
                    <Badge variant="outline" className="mb-3">{limit.type}</Badge>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Default Requests</p>
                        <div className="space-y-1">
                          <p className="font-mono">CPU: {limit.defaultRequest.cpu}</p>
                          <p className="font-mono">Memory: {limit.defaultRequest.memory}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Default Limits</p>
                        <div className="space-y-1">
                          <p className="font-mono">CPU: {limit.default.cpu}</p>
                          <p className="font-mono">Memory: {limit.default.memory}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={nsName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={nsName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Settings, label: 'Edit Resource Quota', description: 'Modify namespace resource limits' },
          { icon: Download, label: 'Download YAML', description: 'Export Namespace definition' },
          { icon: Trash2, label: 'Delete Namespace', description: 'Remove namespace and all resources', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Namespace"
        resourceIcon={Folder}
        name={nsName}
        status={status}
        backLink="/namespaces"
        backLabel="Namespaces"
        metadata={
          <span className="flex items-center gap-1.5 ml-2">
            <Clock className="h-3.5 w-3.5" />Created {age}
            <span className="mx-2">•</span>
            <Badge variant={phase === 'Active' ? 'default' : 'secondary'}>{phase}</Badge>
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: 'Edit Quota', icon: Settings, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
