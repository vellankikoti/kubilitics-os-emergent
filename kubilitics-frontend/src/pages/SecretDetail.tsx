import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { KeyRound, Clock, Download, Trash2, Eye, EyeOff, Edit, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection, TopologyViewer,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { type KubernetesResource } from '@/hooks/useKubernetes';
import { toast } from 'sonner';

interface SecretResource extends KubernetesResource {
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
}

const mockSecretResource: SecretResource = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: {
    name: 'db-credentials',
    namespace: 'production',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'database', environment: 'production' },
  },
  type: 'Opaque',
  data: {
    'username': 'YWRtaW4=',
    'password': 'c2VjcmV0MTIz',
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'secret', type: 'secret', name: 'db-credentials', status: 'healthy', isCurrent: true },
  { id: 'deployment', type: 'deployment', name: 'api-deployment', status: 'healthy' },
  { id: 'pod1', type: 'pod', name: 'api-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'api-def34', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'deployment', to: 'secret', label: 'Uses' },
  { from: 'pod1', to: 'secret', label: 'Mounts' },
  { from: 'pod2', to: 'secret', label: 'Mounts' },
];

export default function SecretDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  
  const { resource: s, isLoading, age, yaml, isConnected } = useResourceDetail<SecretResource>(
    'secrets',
    name,
    namespace,
    mockSecretResource
  );
  const { events } = useK8sEvents(namespace);

  const toggleShow = (key: string) => setShowValues(prev => ({ ...prev, [key]: !prev[key] }));

  const status: ResourceStatus = 'Healthy';
  const secretType = s.type || 'Opaque';
  const data = s.data || {};
  const labels = s.metadata?.labels || {};
  const sName = s.metadata?.name || '';
  const sNamespace = s.metadata?.namespace || '';

  // Mock YAML versions for comparison demo
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { 
      id: 'previous', 
      label: 'Previous Version', 
      yaml: yaml.replace('password: c2VjcmV0MTIz', 'password: b2xkcGFzc3dvcmQ='), 
      timestamp: '2 hours ago' 
    },
    { 
      id: 'initial', 
      label: 'Initial Version', 
      yaml: yaml.replace('username: YWRtaW4=', 'username: cm9vdA==').replace('password: c2VjcmV0MTIz', 'password: dGVzdA=='), 
      timestamp: '1 day ago' 
    },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    // In a real app, this would call the K8s API
    toast.success('Secret updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statusCards = [
    { label: 'Type', value: secretType, icon: KeyRound, iconColor: 'primary' as const },
    { label: 'Data Keys', value: Object.keys(data).length, icon: KeyRound, iconColor: 'info' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'deployment') navigate(`/deployments/${namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Secret Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Type</p><Badge variant="secondary">{secretType}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={labels} variant="badges" />
        </div>
      ),
    },
    {
      id: 'data',
      label: 'Data',
      content: (
        <div className="space-y-4">
          {Object.entries(data).map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between py-3">
                <CardTitle className="text-sm font-mono">{key}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => toggleShow(key)}>
                    {showValues[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Copy className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono">
                  {showValues[key] ? (() => { try { return atob(value); } catch { return value; } })() : '••••••••••••'}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={sName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={sName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit Secret', description: 'Modify secret data' },
          { icon: Copy, label: 'Duplicate', description: 'Create a copy of this Secret' },
          { icon: Download, label: 'Download YAML', description: 'Export Secret definition' },
          { icon: Trash2, label: 'Delete Secret', description: 'Remove this Secret', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Secret"
        resourceIcon={KeyRound}
        name={sName}
        namespace={sNamespace}
        status={status}
        backLink="/secrets"
        backLabel="Secrets"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
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
