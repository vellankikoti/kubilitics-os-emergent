import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Clock, Download, Trash2, TrendingUp, Server, Cpu, MemoryStick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockHPA = {
  name: 'nginx-hpa',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  reference: { kind: 'Deployment', name: 'nginx-deployment' },
  minReplicas: 2,
  maxReplicas: 10,
  currentReplicas: 3,
  desiredReplicas: 3,
  metrics: [
    { type: 'Resource', name: 'cpu', target: '70%', current: '45%' },
    { type: 'Resource', name: 'memory', target: '80%', current: '60%' },
  ],
  conditions: [
    { type: 'AbleToScale', status: 'True', reason: 'ReadyForNewScale' },
    { type: 'ScalingActive', status: 'True', reason: 'ValidMetricFound' },
  ],
  age: '30d',
  labels: { app: 'nginx' },
};

const mockEvents: EventInfo[] = [
  { type: 'Normal', reason: 'SuccessfulRescale', message: 'New size: 3; reason: cpu resource utilization above target', time: '2h ago' },
];

const topologyNodes: TopologyNode[] = [
  { id: 'hpa', type: 'hpa', name: 'nginx-hpa', status: 'healthy', isCurrent: true },
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', status: 'healthy' },
  { id: 'rs', type: 'replicaset', name: 'nginx-deployment-abc12', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'hpa', to: 'deployment', label: 'Scales' },
  { from: 'deployment', to: 'rs', label: 'Creates' },
];

const yaml = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nginx-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80`;

export default function HorizontalPodAutoscalerDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const hpa = mockHPA;

  const statusCards = [
    { label: 'Current Replicas', value: hpa.currentReplicas, icon: Server, iconColor: 'success' as const },
    { label: 'Min/Max', value: `${hpa.minReplicas}/${hpa.maxReplicas}`, icon: Scale, iconColor: 'primary' as const },
    { label: 'CPU Usage', value: '45%', icon: Cpu, iconColor: 'info' as const },
    { label: 'Age', value: hpa.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${namespace}/${node.name}`);
    else if (node.type === 'replicaset') navigate(`/replicasets/${namespace}/${node.name}`);
  };

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
                <p className="font-mono">{hpa.reference.kind}/{hpa.reference.name}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{hpa.minReplicas}</p>
                  <p className="text-xs text-muted-foreground">Min</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-2xl font-bold text-primary">{hpa.currentReplicas}</p>
                  <p className="text-xs text-muted-foreground">Current</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{hpa.maxReplicas}</p>
                  <p className="text-xs text-muted-foreground">Max</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Metrics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {hpa.metrics.map((metric) => (
                <div key={metric.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {metric.name === 'cpu' ? <Cpu className="h-4 w-4" /> : <MemoryStick className="h-4 w-4" />}
                      <span className="font-medium capitalize">{metric.name}</span>
                    </div>
                    <span className="font-mono text-sm">{metric.current} / {metric.target}</span>
                  </div>
                  <Progress value={parseInt(metric.current)} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hpa.conditions.map((condition) => (
                  <div key={condition.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">{condition.type}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={condition.status === 'True' ? 'default' : 'secondary'}>{condition.status}</Badge>
                      <span className="text-sm text-muted-foreground">{condition.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={hpa.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: TrendingUp, label: 'Edit Scaling', description: 'Modify min/max replicas and metrics' },
          { icon: Download, label: 'Download YAML', description: 'Export HPA definition' },
          { icon: Trash2, label: 'Delete HPA', description: 'Remove this autoscaler', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="HorizontalPodAutoscaler"
        resourceIcon={Scale}
        name={hpa.name}
        namespace={hpa.namespace}
        status={hpa.status}
        backLink="/horizontalpodautoscalers"
        backLabel="HPAs"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {hpa.age}</span>}
        actions={[
          { label: 'Edit', icon: TrendingUp, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
