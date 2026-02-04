import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileJson, Clock, Download, Trash2, Copy, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection, TopologyViewer,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { type KubernetesResource } from '@/hooks/useKubernetes';
import { toast } from 'sonner';

interface ConfigMapResource extends KubernetesResource {
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
}

const mockConfigMapResource: ConfigMapResource = {
  apiVersion: 'v1',
  kind: 'ConfigMap',
  metadata: {
    name: 'nginx-config',
    namespace: 'production',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'nginx', environment: 'production' },
  },
  data: {
    'nginx.conf': `server {
    listen 80;
    server_name localhost;
    location / {
        root /usr/share/nginx/html;
        index index.html;
    }
}`,
    'mime.types': 'text/html html htm shtml;',
    'proxy.conf': 'proxy_pass http://backend:8080;',
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'cm', type: 'configmap', name: 'nginx-config', status: 'healthy', isCurrent: true },
  { id: 'deployment', type: 'deployment', name: 'nginx-deployment', status: 'healthy' },
  { id: 'pod1', type: 'pod', name: 'nginx-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-def34', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'deployment', to: 'cm', label: 'Uses' },
  { from: 'pod1', to: 'cm', label: 'Mounts' },
  { from: 'pod2', to: 'cm', label: 'Mounts' },
];

export default function ConfigMapDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { resource: cm, isLoading, age, yaml, isConnected } = useResourceDetail<ConfigMapResource>(
    'configmaps',
    name,
    namespace,
    mockConfigMapResource
  );
  const { events } = useK8sEvents(namespace);

  const status: ResourceStatus = 'Healthy';
  const data = cm.data || {};
  const labels = cm.metadata?.labels || {};
  const cmName = cm.metadata?.name || '';
  const cmNamespace = cm.metadata?.namespace || '';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('listen 80', 'listen 8080'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('server_name localhost', 'server_name example.com'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('ConfigMap updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statusCards = [
    { label: 'Data Keys', value: Object.keys(data).length, icon: FileJson, iconColor: 'primary' as const },
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
          <MetadataCard title="Labels" items={labels} variant="badges" />
          <Card>
            <CardHeader><CardTitle className="text-base">Data Keys</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.keys(data).map((key) => (
                  <Badge key={key} variant="secondary" className="font-mono">{key}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
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
                <Copy className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground" />
              </CardHeader>
              <CardContent>
                <pre className="p-3 rounded-lg bg-muted text-sm font-mono overflow-auto max-h-64">{value}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={cmName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={cmName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Edit, label: 'Edit ConfigMap', description: 'Modify configuration data' },
          { icon: Copy, label: 'Duplicate', description: 'Create a copy of this ConfigMap' },
          { icon: Download, label: 'Download YAML', description: 'Export ConfigMap definition' },
          { icon: Trash2, label: 'Delete ConfigMap', description: 'Remove this ConfigMap', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="ConfigMap"
        resourceIcon={FileJson}
        name={cmName}
        namespace={cmNamespace}
        status={status}
        backLink="/configmaps"
        backLabel="ConfigMaps"
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
