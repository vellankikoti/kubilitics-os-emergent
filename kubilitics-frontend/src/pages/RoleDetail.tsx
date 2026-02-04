import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Clock, Download, Trash2, Edit, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo, type YamlVersion,
} from '@/components/resources';
import { toast } from 'sonner';

const mockEvents: EventInfo[] = [];

const mockRole = {
  name: 'pod-reader',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  age: '90d',
  labels: { 'rbac.authorization.k8s.io/aggregate-to-view': 'true' },
  rules: [
    { apiGroups: [''], resources: ['pods'], verbs: ['get', 'list', 'watch'] },
    { apiGroups: [''], resources: ['pods/log'], verbs: ['get'] },
  ],
};

const topologyNodes: TopologyNode[] = [
  { id: 'role', type: 'role', name: 'pod-reader', status: 'healthy', isCurrent: true },
  { id: 'rb1', type: 'rolebinding', name: 'pod-reader-binding', status: 'healthy' },
  { id: 'sa', type: 'serviceaccount', name: 'nginx-sa', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'rb1', to: 'role', label: 'References' },
  { from: 'rb1', to: 'sa', label: 'Binds To' },
];

const yaml = `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: production
  labels:
    rbac.authorization.k8s.io/aggregate-to-view: "true"
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log"]
  verbs: ["get"]`;

export default function RoleDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const role = mockRole;

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('watch', 'create'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('pods/log', 'pods/status'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Role updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const statusCards = [
    { label: 'Rules', value: role.rules.length, icon: Shield, iconColor: 'primary' as const },
    { label: 'Age', value: role.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'rolebinding') navigate(`/rolebindings/${namespace}/${node.name}`);
    else if (node.type === 'serviceaccount') navigate(`/serviceaccounts/${namespace}/${node.name}`);
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
                {role.rules.map((rule, i) => (
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
                          {rule.resources.map((r, j) => <Badge key={j} variant="outline" className="font-mono">{r}</Badge>)}
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
          <MetadataCard title="Labels" items={role.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={role.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={role.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit Role', description: 'Modify role permissions' },
          { icon: Users, label: 'View Bindings', description: 'See all role bindings using this role' },
          { icon: Download, label: 'Download YAML', description: 'Export Role definition' },
          { icon: Trash2, label: 'Delete Role', description: 'Remove this role', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Role"
        resourceIcon={Shield}
        name={role.name}
        namespace={role.namespace}
        status={role.status}
        backLink="/roles"
        backLabel="Roles"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {role.age}</span>}
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
