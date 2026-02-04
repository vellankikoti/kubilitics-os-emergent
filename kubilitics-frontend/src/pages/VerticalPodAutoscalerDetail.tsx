import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Scale, Clock, Download, Trash2, Cpu, MemoryStick, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockVPA = {
  name: 'nginx-vpa',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  reference: { kind: 'Deployment', name: 'nginx-deployment' },
  updateMode: 'Auto',
  recommendation: {
    containerRecommendations: [
      {
        containerName: 'nginx',
        lowerBound: { cpu: '50m', memory: '64Mi' },
        target: { cpu: '100m', memory: '128Mi' },
        upperBound: { cpu: '500m', memory: '512Mi' },
        uncappedTarget: { cpu: '100m', memory: '128Mi' },
      },
    ],
  },
  conditions: [
    { type: 'RecommendationProvided', status: 'True', reason: 'RecommendationUpdated' },
  ],
  age: '30d',
  labels: { app: 'nginx' },
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'vpa', type: 'vpa', name: 'nginx-vpa', status: 'healthy', isCurrent: true },
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'vpa', to: 'deployment', label: 'Recommends' },
];

const yaml = `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nginx-vpa
  namespace: production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nginx-deployment
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: nginx
      minAllowed:
        cpu: 50m
        memory: 64Mi
      maxAllowed:
        cpu: 1
        memory: 1Gi`;

export default function VerticalPodAutoscalerDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const vpa = mockVPA;

  const rec = vpa.recommendation.containerRecommendations[0];

  const statusCards = [
    { label: 'Update Mode', value: vpa.updateMode, icon: TrendingUp, iconColor: 'primary' as const },
    { label: 'Target CPU', value: rec.target.cpu, icon: Cpu, iconColor: 'info' as const },
    { label: 'Target Memory', value: rec.target.memory, icon: MemoryStick, iconColor: 'success' as const },
    { label: 'Age', value: vpa.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Target Reference</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground text-sm mb-1">Reference</p>
                <p className="font-mono">{vpa.reference.kind}/{vpa.reference.name}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-muted-foreground text-sm mb-1">Update Mode</p>
                <Badge variant={vpa.updateMode === 'Auto' ? 'default' : 'secondary'}>{vpa.updateMode}</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Recommendations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {vpa.recommendation.containerRecommendations.map((cr) => (
                <div key={cr.containerName} className="space-y-3">
                  <p className="font-medium">{cr.containerName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">CPU Target</p>
                      <p className="font-mono">{cr.target.cpu}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">Memory Target</p>
                      <p className="font-mono">{cr.target.memory}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">CPU Range</p>
                      <p className="font-mono text-sm">{cr.lowerBound.cpu} - {cr.upperBound.cpu}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">Memory Range</p>
                      <p className="font-mono text-sm">{cr.lowerBound.memory} - {cr.upperBound.memory}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {vpa.conditions.map((condition) => (
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
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={vpa.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: TrendingUp, label: 'Edit VPA', description: 'Modify resource policies' },
          { icon: Download, label: 'Download YAML', description: 'Export VPA definition' },
          { icon: Trash2, label: 'Delete VPA', description: 'Remove this autoscaler', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="VerticalPodAutoscaler"
        resourceIcon={Scale}
        name={vpa.name}
        namespace={vpa.namespace}
        status={vpa.status}
        backLink="/verticalpodautoscalers"
        backLabel="VPAs"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {vpa.age}</span>}
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
