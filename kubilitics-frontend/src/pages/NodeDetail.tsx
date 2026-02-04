import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Server, Clock, Download, Trash2, Cpu, HardDrive, Box, Shield, RefreshCw, Pause, Play, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection, MetricsDashboard,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { type KubernetesResource } from '@/hooks/useKubernetes';

interface NodeResource extends KubernetesResource {
  spec?: {
    podCIDR?: string;
    taints?: Array<{ key: string; value?: string; effect: string }>;
    unschedulable?: boolean;
  };
  status?: {
    capacity?: { cpu?: string; memory?: string; pods?: string; 'ephemeral-storage'?: string };
    allocatable?: { cpu?: string; memory?: string; pods?: string };
    conditions?: Array<{ type: string; status: string; reason?: string; message?: string; lastTransitionTime?: string }>;
    nodeInfo?: {
      osImage?: string;
      architecture?: string;
      containerRuntimeVersion?: string;
      kubeletVersion?: string;
      kernelVersion?: string;
      operatingSystem?: string;
    };
    addresses?: Array<{ type: string; address: string }>;
  };
}

const mockNodeResource: NodeResource = {
  apiVersion: 'v1',
  kind: 'Node',
  metadata: {
    name: 'node-1',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { 'kubernetes.io/hostname': 'node-1', 'node-role.kubernetes.io/control-plane': '', 'kubernetes.io/os': 'linux', 'kubernetes.io/arch': 'amd64' },
  },
  spec: {
    podCIDR: '10.244.0.0/24',
    taints: [
      { key: 'node-role.kubernetes.io/control-plane', effect: 'NoSchedule' },
    ],
    unschedulable: false,
  },
  status: {
    capacity: { cpu: '8', memory: '32Gi', pods: '110', 'ephemeral-storage': '100Gi' },
    allocatable: { cpu: '7800m', memory: '30Gi', pods: '110' },
    conditions: [
      { type: 'Ready', status: 'True', reason: 'KubeletReady', message: 'kubelet is posting ready status', lastTransitionTime: '2024-01-01T00:00:00Z' },
      { type: 'MemoryPressure', status: 'False', reason: 'KubeletHasSufficientMemory', message: 'kubelet has sufficient memory available', lastTransitionTime: '2024-01-01T00:00:00Z' },
      { type: 'DiskPressure', status: 'False', reason: 'KubeletHasNoDiskPressure', message: 'kubelet has no disk pressure', lastTransitionTime: '2024-01-01T00:00:00Z' },
      { type: 'PIDPressure', status: 'False', reason: 'KubeletHasSufficientPID', message: 'kubelet has sufficient PID available', lastTransitionTime: '2024-01-01T00:00:00Z' },
    ],
    nodeInfo: {
      operatingSystem: 'linux',
      architecture: 'amd64',
      containerRuntimeVersion: 'containerd://1.7.0',
      kubeletVersion: 'v1.28.4',
      kernelVersion: '5.15.0-91-generic',
      osImage: 'Ubuntu 22.04.3 LTS',
    },
    addresses: [
      { type: 'InternalIP', address: '192.168.1.10' },
      { type: 'Hostname', address: 'node-1' },
    ],
  },
};

// Mock running pods on this node
const mockRunningPods = [
  { name: 'nginx-abc12', namespace: 'production', status: 'Running', cpu: '50m', memory: '128Mi' },
  { name: 'api-def34', namespace: 'production', status: 'Running', cpu: '100m', memory: '256Mi' },
  { name: 'redis-ghi56', namespace: 'production', status: 'Running', cpu: '75m', memory: '512Mi' },
  { name: 'kube-proxy-xyz', namespace: 'kube-system', status: 'Running', cpu: '10m', memory: '32Mi' },
  { name: 'coredns-123', namespace: 'kube-system', status: 'Running', cpu: '20m', memory: '64Mi' },
];

const topologyNodes: TopologyNode[] = [
  { id: 'node', type: 'node', name: 'node-1', status: 'healthy', isCurrent: true },
  ...mockRunningPods.map((pod, i) => ({
    id: `pod${i}`,
    type: 'pod' as const,
    name: pod.name,
    status: 'healthy' as const,
  })),
];

const topologyEdges: TopologyEdge[] = mockRunningPods.map((_, i) => ({
  from: `pod${i}`,
  to: 'node',
  label: 'Runs On',
}));

export default function NodeDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [isCordoned, setIsCordoned] = useState(false);
  
  const { resource: n, isLoading, age, yaml, isConnected } = useResourceDetail<NodeResource>(
    'nodes',
    name,
    undefined,
    mockNodeResource
  );
  const { events } = useK8sEvents();

  const nodeName = n.metadata?.name || '';
  const labels = n.metadata?.labels || {};
  const nodeInfo = n.status?.nodeInfo;
  const conditions = n.status?.conditions || [];
  const capacity = n.status?.capacity || {};
  const allocatable = n.status?.allocatable || {};
  const taints = n.spec?.taints || [];
  const addresses = n.status?.addresses || [];
  const podCIDR = n.spec?.podCIDR || '-';
  
  // Get roles from labels
  const roles = Object.keys(labels)
    .filter(k => k.startsWith('node-role.kubernetes.io/'))
    .map(k => k.replace('node-role.kubernetes.io/', ''));
  
  // Check if node is ready
  const isReady = conditions.some(c => c.type === 'Ready' && c.status === 'True');
  const status: ResourceStatus = isCordoned ? 'Warning' : isReady ? 'Running' : 'Failed';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('cpu: 8', 'cpu: 4'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('memory: 32Gi', 'memory: 16Gi'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Node updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const handleCordon = () => {
    setIsCordoned(!isCordoned);
    toast.success(isCordoned ? 'Node uncordoned' : 'Node cordoned - no new pods will be scheduled');
  };

  const handleDrain = () => {
    toast.success('Node drain initiated - evicting pods...');
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

  // Calculate usage percentages (mock values - would need metrics API in real impl)
  const cpuUsagePercent = 45;
  const memoryUsagePercent = 62;
  const podUsagePercent = Math.round((mockRunningPods.length / parseInt(capacity.pods || '110')) * 100);

  const statusCards = [
    { label: 'CPU', value: `${cpuUsagePercent}%`, icon: Cpu, iconColor: 'primary' as const },
    { label: 'Memory', value: `${memoryUsagePercent}%`, icon: HardDrive, iconColor: 'info' as const },
    { label: 'Pods', value: `${mockRunningPods.length}/${capacity.pods || '110'}`, icon: Box, iconColor: 'success' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pod') {
      const pod = mockRunningPods.find(p => p.name === node.name);
      if (pod) navigate(`/pods/${pod.namespace}/${node.name}`);
    }
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Cordoned Warning */}
          {isCordoned && (
            <div className="p-4 rounded-lg border border-warning/50 bg-warning/10 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium text-warning">Node is Cordoned</p>
                <p className="text-sm text-warning/80">This node is marked as unschedulable. No new pods will be scheduled on this node.</p>
              </div>
              <Button variant="outline" size="sm" className="ml-auto" onClick={handleCordon}>
                <Play className="h-4 w-4 mr-1" />
                Uncordon
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Node Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Node Info</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><p className="text-muted-foreground mb-1">OS Image</p><p>{nodeInfo?.osImage || '-'}</p></div>
                  <div><p className="text-muted-foreground mb-1">Architecture</p><p>{nodeInfo?.architecture || '-'}</p></div>
                  <div><p className="text-muted-foreground mb-1">Kernel</p><p className="font-mono text-xs">{nodeInfo?.kernelVersion || '-'}</p></div>
                  <div><p className="text-muted-foreground mb-1">Container Runtime</p><p className="font-mono text-xs">{nodeInfo?.containerRuntimeVersion || '-'}</p></div>
                  <div><p className="text-muted-foreground mb-1">Kubelet</p><Badge variant="secondary">{nodeInfo?.kubeletVersion || '-'}</Badge></div>
                  <div><p className="text-muted-foreground mb-1">Pod CIDR</p><p className="font-mono text-xs">{podCIDR}</p></div>
                </div>
              </CardContent>
            </Card>

            {/* Resource Usage */}
            <Card>
              <CardHeader><CardTitle className="text-base">Resource Usage</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>CPU</span>
                    <span className="font-mono">{cpuUsagePercent}% used of {capacity.cpu || '-'}</span>
                  </div>
                  <Progress value={cpuUsagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{allocatable.cpu || '-'} allocatable</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Memory</span>
                    <span className="font-mono">{memoryUsagePercent}% used of {capacity.memory || '-'}</span>
                  </div>
                  <Progress value={memoryUsagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{allocatable.memory || '-'} allocatable</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Pods</span>
                    <span className="font-mono">{mockRunningPods.length}/{capacity.pods || '110'}</span>
                  </div>
                  <Progress value={podUsagePercent} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Conditions */}
            <Card>
              <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conditions.map((c) => (
                    <div key={c.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={
                            c.type === 'Ready' 
                              ? (c.status === 'True' ? 'default' : 'destructive')
                              : (c.status === 'False' ? 'secondary' : 'destructive')
                          }
                        >
                          {c.type}
                        </Badge>
                        <span className="text-sm">{c.status}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{c.reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Addresses */}
            <Card>
              <CardHeader><CardTitle className="text-base">Addresses</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <div key={addr.type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm text-muted-foreground">{addr.type}</span>
                      <span className="font-mono text-sm">{addr.address}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Taints */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Taints</CardTitle>
                <CardDescription>Taints prevent pods from being scheduled on this node</CardDescription>
              </CardHeader>
              <CardContent>
                {taints.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No taints configured</p>
                ) : (
                  <div className="space-y-2">
                    {taints.map((taint, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                        <Badge variant="outline" className="font-mono text-xs">{taint.key}</Badge>
                        {taint.value && <span className="text-sm">=</span>}
                        {taint.value && <Badge variant="secondary" className="font-mono text-xs">{taint.value}</Badge>}
                        <Badge variant="destructive" className="text-xs ml-auto">{taint.effect}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Roles & Labels */}
            <Card>
              <CardHeader><CardTitle className="text-base">Roles & Labels</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Roles</p>
                  <div className="flex flex-wrap gap-2">
                    {roles.length > 0 ? roles.map((role) => (
                      <Badge key={role} variant="outline">{role || 'control-plane'}</Badge>
                    )) : <span className="text-muted-foreground text-sm">worker</span>}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Labels ({Object.keys(labels).length})</p>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {Object.entries(labels).slice(0, 8).map(([k, v]) => (
                      <Badge key={k} variant="secondary" className="font-mono text-xs">
                        {k.split('/').pop()}={v || 'true'}
                      </Badge>
                    ))}
                    {Object.keys(labels).length > 8 && (
                      <Badge variant="outline" className="text-xs">+{Object.keys(labels).length - 8} more</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ),
    },
    {
      id: 'pods',
      label: 'Running Pods',
      content: (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Running Pods ({mockRunningPods.length})</CardTitle>
            <CardDescription>Pods currently scheduled on this node</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockRunningPods.map((pod) => (
                <div 
                  key={pod.name} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => navigate(`/pods/${pod.namespace}/${pod.name}`)}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={pod.status === 'Running' ? 'default' : 'secondary'}>{pod.status}</Badge>
                    <div>
                      <p className="font-medium">{pod.name}</p>
                      <p className="text-xs text-muted-foreground">{pod.namespace}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono text-muted-foreground">CPU: {pod.cpu}</span>
                    <span className="font-mono text-muted-foreground">Mem: {pod.memory}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={nodeName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={nodeName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'performance',
      label: 'Performance',
      content: <MetricsDashboard resourceType="node" resourceName={nodeName} />,
    },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { 
            icon: isCordoned ? Play : Pause, 
            label: isCordoned ? 'Uncordon Node' : 'Cordon Node', 
            description: isCordoned ? 'Allow pods to be scheduled on this node' : 'Mark node as unschedulable',
            onClick: handleCordon,
          },
          { icon: Shield, label: 'Drain Node', description: 'Safely evict all pods from node', onClick: handleDrain },
          { icon: Download, label: 'Download YAML', description: 'Export Node definition' },
          { icon: Trash2, label: 'Delete Node', description: 'Remove node from cluster', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Node"
        resourceIcon={Server}
        name={nodeName}
        status={status}
        backLink="/nodes"
        backLabel="Nodes"
        metadata={
          <span className="flex items-center gap-1.5 ml-2">
            <Clock className="h-3.5 w-3.5" />Created {age}
            <span className="mx-2">•</span>
            {roles.map((role) => <Badge key={role} variant="outline" className="text-xs ml-1">{role || 'control-plane'}</Badge>)}
            {isCordoned && <Badge variant="destructive" className="ml-2 text-xs">Cordoned</Badge>}
            {isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}
          </span>
        }
        actions={[
          { label: isCordoned ? 'Uncordon' : 'Cordon', icon: isCordoned ? Play : Pause, variant: 'outline', onClick: handleCordon },
          { label: 'Drain', icon: Shield, variant: 'outline', onClick: handleDrain },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
