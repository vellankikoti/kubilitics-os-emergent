import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, Clock, Download, Trash2, Edit, Shield, UserCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEvents: EventInfo[] = [];

const mockRoleBinding = {
  name: 'pod-reader-binding',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  age: '90d',
  roleRef: { kind: 'Role', name: 'pod-reader', apiGroup: 'rbac.authorization.k8s.io' },
  subjects: [
    { kind: 'ServiceAccount', name: 'nginx-sa', namespace: 'production' },
    { kind: 'User', name: 'developer@example.com', namespace: '' },
  ],
};

const topologyNodes: TopologyNode[] = [
  { id: 'rb', type: 'rolebinding', name: 'pod-reader-binding', status: 'healthy', isCurrent: true },
  { id: 'role', type: 'role', name: 'pod-reader', status: 'healthy' },
  { id: 'sa', type: 'serviceaccount', name: 'nginx-sa', status: 'healthy' },
  { id: 'user', type: 'user', name: 'developer@example.com', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'rb', to: 'role', label: 'References' },
  { from: 'rb', to: 'sa', label: 'Binds To' },
  { from: 'rb', to: 'user', label: 'Binds To' },
];

const yaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader
subjects:
- kind: ServiceAccount
  name: nginx-sa
  namespace: production
- kind: User
  name: developer@example.com`;

export default function RoleBindingDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const rb = mockRoleBinding;

  const statusCards = [
    { label: 'Role', value: rb.roleRef.name, icon: Shield, iconColor: 'primary' as const },
    { label: 'Subjects', value: rb.subjects.length, icon: UserCircle, iconColor: 'info' as const },
    { label: 'Age', value: rb.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'role') navigate(`/roles/${namespace}/${node.name}`);
    else if (node.type === 'serviceaccount') navigate(`/serviceaccounts/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Role Reference</CardTitle></CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => navigate(`/roles/${namespace}/${rb.roleRef.name}`)}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary">{rb.roleRef.kind}</Badge>
                  <span className="font-medium">{rb.roleRef.name}</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{rb.roleRef.apiGroup}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Subjects</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rb.subjects.map((subject, i) => (
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
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={rb.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit Binding', description: 'Modify subjects or role reference' },
          { icon: Download, label: 'Download YAML', description: 'Export RoleBinding definition' },
          { icon: Trash2, label: 'Delete RoleBinding', description: 'Remove this role binding', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="RoleBinding"
        resourceIcon={Link2}
        name={rb.name}
        namespace={rb.namespace}
        status={rb.status}
        backLink="/rolebindings"
        backLabel="Role Bindings"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {rb.age}</span>}
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
