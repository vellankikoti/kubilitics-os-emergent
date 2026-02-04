import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserCircle, Clock, Download, Trash2, KeyRound, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEvents: EventInfo[] = [];

const mockServiceAccount = {
  name: 'nginx-sa',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  age: '90d',
  labels: { app: 'nginx' },
  secrets: ['nginx-sa-token-abc12', 'nginx-sa-dockercfg-def34'],
  imagePullSecrets: ['docker-registry'],
  automountServiceAccountToken: true,
};

const topologyNodes: TopologyNode[] = [
  { id: 'sa', type: 'serviceaccount', name: 'nginx-sa', status: 'healthy', isCurrent: true },
  { id: 'secret1', type: 'secret', name: 'nginx-sa-token-abc12', status: 'healthy' },
  { id: 'secret2', type: 'secret', name: 'nginx-sa-dockercfg-def34', status: 'healthy' },
  { id: 'rb', type: 'rolebinding', name: 'nginx-binding', status: 'healthy' },
  { id: 'pod', type: 'pod', name: 'nginx-pod-abc12', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'sa', to: 'secret1', label: 'Uses' },
  { from: 'sa', to: 'secret2', label: 'Uses' },
  { from: 'rb', to: 'sa', label: 'Binds To' },
  { from: 'pod', to: 'sa', label: 'Uses' },
];

const yaml = `apiVersion: v1
kind: ServiceAccount
metadata:
  name: nginx-sa
  namespace: production
  labels:
    app: nginx
secrets:
  - name: nginx-sa-token-abc12
  - name: nginx-sa-dockercfg-def34
imagePullSecrets:
  - name: docker-registry
automountServiceAccountToken: true`;

export default function ServiceAccountDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const sa = mockServiceAccount;

  const statusCards = [
    { label: 'Secrets', value: sa.secrets.length, icon: KeyRound, iconColor: 'primary' as const },
    { label: 'Image Pull Secrets', value: sa.imagePullSecrets.length, icon: Shield, iconColor: 'info' as const },
    { label: 'Age', value: sa.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'secret') navigate(`/secrets/${namespace}/${node.name}`);
    else if (node.type === 'rolebinding') navigate(`/rolebindings/${namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Service Account Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between p-2 rounded-lg bg-muted/50">
                <span>Automount Token</span>
                <Badge variant={sa.automountServiceAccountToken ? 'default' : 'secondary'}>
                  {sa.automountServiceAccountToken ? 'Yes' : 'No'}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Secrets</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sa.secrets.map((secret) => (
                  <div key={secret} className="p-2 rounded-lg bg-muted/50 font-mono text-sm cursor-pointer hover:bg-muted" onClick={() => navigate(`/secrets/${namespace}/${secret}`)}>
                    {secret}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Image Pull Secrets</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sa.imagePullSecrets.map((secret) => (
                  <Badge key={secret} variant="outline" className="font-mono">{secret}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={sa.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={sa.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: KeyRound, label: 'Create Token', description: 'Generate a new service account token' },
          { icon: Download, label: 'Download YAML', description: 'Export ServiceAccount definition' },
          { icon: Trash2, label: 'Delete ServiceAccount', description: 'Remove this service account', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ServiceAccount"
        resourceIcon={UserCircle}
        name={sa.name}
        namespace={sa.namespace}
        status={sa.status}
        backLink="/serviceaccounts"
        backLabel="Service Accounts"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {sa.age}</span>}
        actions={[
          { label: 'Create Token', icon: KeyRound, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
