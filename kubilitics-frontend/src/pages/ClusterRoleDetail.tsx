import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Clock, Download, Trash2, Edit, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEvents: EventInfo[] = [];

const mockClusterRole = {
  name: 'view',
  status: 'Healthy' as ResourceStatus,
  age: '365d',
  labels: { 'rbac.authorization.k8s.io/aggregate-to-admin': 'true', 'rbac.authorization.k8s.io/aggregate-to-edit': 'true' },
  rules: [
    { apiGroups: [''], resources: ['configmaps', 'endpoints', 'persistentvolumeclaims', 'pods', 'services'], verbs: ['get', 'list', 'watch'] },
    { apiGroups: ['apps'], resources: ['deployments', 'replicasets', 'statefulsets'], verbs: ['get', 'list', 'watch'] },
  ],
};

const topologyNodes: TopologyNode[] = [
  { id: 'cr', type: 'clusterrole', name: 'view', status: 'healthy', isCurrent: true },
  { id: 'crb1', type: 'clusterrolebinding', name: 'view-binding', status: 'healthy' },
  { id: 'crb2', type: 'clusterrolebinding', name: 'developer-view', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'crb1', to: 'cr', label: 'References' },
  { from: 'crb2', to: 'cr', label: 'References' },
];

const yaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: view
  labels:
    rbac.authorization.k8s.io/aggregate-to-admin: "true"
    rbac.authorization.k8s.io/aggregate-to-edit: "true"
rules:
- apiGroups: [""]
  resources: ["configmaps", "endpoints", "persistentvolumeclaims", "pods", "services"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets", "statefulsets"]
  verbs: ["get", "list", "watch"]`;

export default function ClusterRoleDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const cr = mockClusterRole;

  const statusCards = [
    { label: 'Rules', value: cr.rules.length, icon: ShieldCheck, iconColor: 'primary' as const },
    { label: 'Age', value: cr.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'clusterrolebinding') navigate(`/clusterrolebindings/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cr.rules.map((rule, i) => (
                  <div key={i} className="p-4 rounded-lg bg-muted/50">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-2">API Groups</p>
                        <div className="flex flex-wrap gap-1">
                          {rule.apiGroups.map((g, j) => <Badge key={j} variant="secondary" className="font-mono">{g || 'core'}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2">Resources</p>
                        <div className="flex flex-wrap gap-1">
                          {rule.resources.map((r, j) => <Badge key={j} variant="outline" className="font-mono text-xs">{r}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-2">Verbs</p>
                        <div className="flex flex-wrap gap-1">
                          {rule.verbs.map((v, j) => <Badge key={j} variant="default" className="font-mono text-xs">{v}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={cr.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={cr.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit ClusterRole', description: 'Modify cluster role permissions' },
          { icon: Users, label: 'View Bindings', description: 'See all bindings using this cluster role' },
          { icon: Download, label: 'Download YAML', description: 'Export ClusterRole definition' },
          { icon: Trash2, label: 'Delete ClusterRole', description: 'Remove this cluster role', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ClusterRole"
        resourceIcon={ShieldCheck}
        name={cr.name}
        status={cr.status}
        backLink="/clusterroles"
        backLabel="Cluster Roles"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {cr.age}</span>}
        actions={[
          { label: 'Edit', icon: Edit, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
