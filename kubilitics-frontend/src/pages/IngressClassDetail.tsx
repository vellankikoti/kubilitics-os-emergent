import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Route, Clock, Download, Trash2, Star, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus,
} from '@/components/resources';

const mockIngressClass = {
  name: 'nginx',
  status: 'Healthy' as ResourceStatus,
  controller: 'k8s.io/ingress-nginx',
  isDefault: true,
  age: '180d',
  labels: { 'app.kubernetes.io/name': 'ingress-nginx' },
  parameters: { apiGroup: 'k8s.nginx.org', kind: 'IngressConfiguration', name: 'nginx-config' },
};

const topologyNodes: TopologyNode[] = [
  { id: 'ic', type: 'ingressclass', name: 'nginx', status: 'healthy', isCurrent: true },
  { id: 'ing1', type: 'ingress', name: 'app-ingress', status: 'healthy' },
  { id: 'ing2', type: 'ingress', name: 'api-ingress', status: 'healthy' },
  { id: 'controller', type: 'deployment', name: 'ingress-nginx-controller', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'ing1', to: 'ic', label: 'Uses' },
  { from: 'ing2', to: 'ic', label: 'Uses' },
  { from: 'controller', to: 'ic', label: 'Implements' },
];

const yaml = `apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: nginx
  annotations:
    ingressclass.kubernetes.io/is-default-class: "true"
  labels:
    app.kubernetes.io/name: ingress-nginx
spec:
  controller: k8s.io/ingress-nginx
  parameters:
    apiGroup: k8s.nginx.org
    kind: IngressConfiguration
    name: nginx-config`;

export default function IngressClassDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const ic = mockIngressClass;

  const statusCards = [
    { label: 'Controller', value: 'ingress-nginx', icon: Server, iconColor: 'primary' as const },
    { label: 'Default', value: ic.isDefault ? 'Yes' : 'No', icon: Star, iconColor: ic.isDefault ? 'success' as const : 'muted' as const },
    { label: 'Age', value: ic.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'ingress') navigate(`/ingresses/production/${node.name}`);
    else if (node.type === 'deployment') navigate(`/deployments/ingress-nginx/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Ingress Class Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-muted-foreground mb-1">Controller</p>
                  <p className="font-mono">{ic.controller}</p>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                  <span>Default Class</span>
                  <Badge variant={ic.isDefault ? 'default' : 'secondary'}>{ic.isDefault ? 'Yes' : 'No'}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          {ic.parameters && (
            <Card>
              <CardHeader><CardTitle className="text-base">Parameters</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">API Group</span>
                    <span className="font-mono text-sm">{ic.parameters.apiGroup}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Kind</span>
                    <Badge variant="secondary">{ic.parameters.kind}</Badge>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-mono text-sm">{ic.parameters.name}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <MetadataCard title="Labels" items={ic.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={[]} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={ic.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Star, label: 'Set as Default', description: 'Make this the default ingress class' },
          { icon: Download, label: 'Download YAML', description: 'Export IngressClass definition' },
          { icon: Trash2, label: 'Delete IngressClass', description: 'Remove this ingress class', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="IngressClass"
        resourceIcon={Route}
        name={ic.name}
        status={ic.status}
        backLink="/ingressclasses"
        backLabel="Ingress Classes"
        metadata={
          <span className="flex items-center gap-1.5 ml-2">
            <Clock className="h-3.5 w-3.5" />Created {ic.age}
            {ic.isDefault && <><span className="mx-2">•</span><Star className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />Default</>}
          </span>
        }
        actions={[
          { label: 'Download YAML', icon: Download, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
