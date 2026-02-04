import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Clock, Download, Trash2, Server, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockPDB = {
  name: 'nginx-pdb',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  minAvailable: 2,
  maxUnavailable: null,
  selector: { matchLabels: { app: 'nginx' } },
  currentHealthy: 3,
  desiredHealthy: 2,
  disruptionsAllowed: 1,
  expectedPods: 3,
  observedGeneration: 1,
  conditions: [
    { type: 'DisruptionAllowed', status: 'True', reason: 'SufficientPods' },
  ],
  age: '30d',
  labels: { app: 'nginx' },
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'pdb', type: 'pdb', name: 'nginx-pdb', status: 'healthy', isCurrent: true },
  { id: 'pod1', type: 'pod', name: 'nginx-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-def34', status: 'healthy' },
  { id: 'pod3', type: 'pod', name: 'nginx-ghi56', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'pdb', to: 'pod1', label: 'Protects' },
  { from: 'pdb', to: 'pod2', label: 'Protects' },
  { from: 'pdb', to: 'pod3', label: 'Protects' },
];

const yaml = `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: nginx-pdb
  namespace: production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: nginx`;

export default function PodDisruptionBudgetDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const pdb = mockPDB;

  const statusCards = [
    { label: 'Min Available', value: pdb.minAvailable ?? '-', icon: Server, iconColor: 'primary' as const },
    { label: 'Healthy Pods', value: `${pdb.currentHealthy}/${pdb.expectedPods}`, icon: Server, iconColor: 'success' as const },
    { label: 'Disruptions Allowed', value: pdb.disruptionsAllowed, icon: AlertTriangle, iconColor: pdb.disruptionsAllowed > 0 ? 'info' as const : 'warning' as const },
    { label: 'Age', value: pdb.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Budget Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-sm mb-1">Min Available</p>
                  <p className="text-xl font-bold">{pdb.minAvailable ?? 'N/A'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground text-sm mb-1">Max Unavailable</p>
                  <p className="text-xl font-bold">{pdb.maxUnavailable ?? 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Current Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-bold">{pdb.expectedPods}</p>
                  <p className="text-xs text-muted-foreground">Expected</p>
                </div>
                <div className="p-3 rounded-lg bg-[hsl(var(--success))]/10">
                  <p className="text-xl font-bold text-[hsl(var(--success))]">{pdb.currentHealthy}</p>
                  <p className="text-xs text-muted-foreground">Healthy</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <p className="text-xl font-bold text-primary">{pdb.disruptionsAllowed}</p>
                  <p className="text-xs text-muted-foreground">Allowed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Pod Selector</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(pdb.selector.matchLabels).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="font-mono text-xs">{key}={value}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Conditions</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pdb.conditions.map((condition) => (
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
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={pdb.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export PDB definition' },
          { icon: Trash2, label: 'Delete PDB', description: 'Remove this disruption budget', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="PodDisruptionBudget"
        resourceIcon={Shield}
        name={pdb.name}
        namespace={pdb.namespace}
        status={pdb.status}
        backLink="/poddisruptionbudgets"
        backLabel="PDBs"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {pdb.age}</span>}
        actions={[{ label: 'Delete', icon: Trash2, variant: 'destructive' }]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
