import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link, Clock, Download, Trash2, Edit, ShieldCheck, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEvents: EventInfo[] = [];

const mockClusterRoleBinding = {
  name: 'view-binding',
  status: 'Healthy' as ResourceStatus,
  age: '180d',
  roleRef: { kind: 'ClusterRole', name: 'view', apiGroup: 'rbac.authorization.k8s.io' },
  subjects: [
    { kind: 'Group', name: 'developers', namespace: '' },
    { kind: 'ServiceAccount', name: 'prometheus', namespace: 'monitoring' },
  ],
};

const topologyNodes: TopologyNode[] = [
  { id: 'crb', type: 'clusterrolebinding', name: 'view-binding', status: 'healthy', isCurrent: true },
  { id: 'cr', type: 'clusterrole', name: 'view', status: 'healthy' },
  { id: 'group', type: 'group', name: 'developers', status: 'healthy' },
  { id: 'sa', type: 'serviceaccount', name: 'prometheus', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'crb', to: 'cr', label: 'References' },
  { from: 'crb', to: 'group', label: 'Binds To' },
  { from: 'crb', to: 'sa', label: 'Binds To' },
];

const yaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: view-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
- kind: Group
  name: developers
- kind: ServiceAccount
  name: prometheus
  namespace: monitoring`;

export default function ClusterRoleBindingDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const crb = mockClusterRoleBinding;

  const statusCards = [
    { label: 'Cluster Role', value: crb.roleRef.name, icon: ShieldCheck, iconColor: 'primary' as const },
    { label: 'Subjects', value: crb.subjects.length, icon: UserCircle, iconColor: 'info' as const },
    { label: 'Age', value: crb.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'clusterrole') navigate(`/clusterroles/${node.name}`);
    else if (node.type === 'serviceaccount') navigate(`/serviceaccounts/monitoring/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Cluster Role Reference</CardTitle></CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => navigate(`/clusterroles/${crb.roleRef.name}`)}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{crb.roleRef.kind}</Badge>
                  <span className="font-medium">{crb.roleRef.name}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{crb.roleRef.apiGroup}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Subjects</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {crb.subjects.map((subject, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{subject.kind}</Badge>
                      <span className="font-medium">{subject.name}</span>
                    </div>
                    {subject.namespace && <p className="text-xs text-muted-foreground">Namespace: {subject.namespace}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={crb.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit Binding', description: 'Modify subjects or role reference' },
          { icon: Download, label: 'Download YAML', description: 'Export ClusterRoleBinding definition' },
          { icon: Trash2, label: 'Delete ClusterRoleBinding', description: 'Remove this cluster role binding', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ClusterRoleBinding"
        resourceIcon={Link}
        name={crb.name}
        status={crb.status}
        backLink="/clusterrolebindings"
        backLabel="Cluster Role Bindings"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {crb.age}</span>}
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
