import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Clock, Server, Download, Trash2, ExternalLink, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer,
  YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type YamlVersion,
} from '@/components/resources';
import { useResourceDetail, useK8sEvents } from '@/hooks/useK8sResourceDetail';
import { type KubernetesResource } from '@/hooks/useKubernetes';
import { toast } from 'sonner';

interface ServiceResource extends KubernetesResource {
  spec?: {
    type?: string;
    clusterIP?: string;
    externalIPs?: string[];
    ports?: Array<{ name?: string; port: number; targetPort: number | string; protocol?: string; nodePort?: number }>;
    selector?: Record<string, string>;
    sessionAffinity?: string;
  };
  status?: {
    loadBalancer?: { ingress?: Array<{ ip?: string; hostname?: string }> };
  };
}

const mockServiceResource: ServiceResource = {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: {
    name: 'nginx-svc',
    namespace: 'production',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'nginx', tier: 'frontend' },
  },
  spec: {
    type: 'ClusterIP',
    clusterIP: '10.96.0.100',
    externalIPs: [],
    ports: [{ name: 'http', port: 80, targetPort: 8080, protocol: 'TCP' }],
    selector: { app: 'nginx' },
    sessionAffinity: 'None',
  },
};

const mockEndpoints = ['10.244.1.45:8080', '10.244.2.46:8080', '10.244.3.47:8080'];

const topologyNodes: TopologyNode[] = [
  { id: 'service', type: 'service', name: 'nginx-svc', status: 'healthy', isCurrent: true },
  { id: 'endpoint', type: 'endpoint', name: 'nginx-svc', status: 'healthy' },
  { id: 'pod1', type: 'pod', name: 'nginx-...-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-...-def34', status: 'healthy' },
  { id: 'pod3', type: 'pod', name: 'nginx-...-ghi56', status: 'healthy' },
  { id: 'ingress', type: 'ingress', name: 'nginx-ingress', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'ingress', to: 'service', label: 'Routes To' },
  { from: 'service', to: 'endpoint', label: 'Has' },
  { from: 'endpoint', to: 'pod1', label: 'Targets' },
  { from: 'endpoint', to: 'pod2', label: 'Targets' },
  { from: 'endpoint', to: 'pod3', label: 'Targets' },
];

export default function ServiceDetail() {
  const { namespace: nsParam, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { resource: svc, isLoading, age, yaml, isConnected } = useResourceDetail<ServiceResource>(
    'services',
    name,
    nsParam,
    mockServiceResource
  );
  const { events } = useK8sEvents(nsParam);

  const status: ResourceStatus = 'Healthy';
  const serviceType = svc.spec?.type || 'ClusterIP';
  const clusterIP = svc.spec?.clusterIP || '-';
  const ports = svc.spec?.ports || [];
  const selector = svc.spec?.selector || {};
  const sessionAffinity = svc.spec?.sessionAffinity || 'None';
  const endpoints = mockEndpoints;
  const svcName = svc.metadata?.name || '';
  const svcNamespace = svc.metadata?.namespace || '';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('ClusterIP', 'NodePort'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('port: 80', 'port: 8080'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Service updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pod') navigate(`/pods/${nsParam}/${node.name}`);
    else if (node.type === 'ingress') navigate(`/ingresses/${nsParam}/${node.name}`);
    else if (node.type === 'endpoint') navigate(`/endpoints/${nsParam}/${node.name}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const statusCards = [
    { label: 'Type', value: serviceType, icon: Globe, iconColor: 'primary' as const },
    { label: 'Cluster IP', value: clusterIP, icon: Network, iconColor: 'info' as const },
    { label: 'Endpoints', value: endpoints.length, icon: Server, iconColor: 'success' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Service Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Type</p><Badge variant="secondary">{serviceType}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Cluster IP</p><p className="font-mono">{clusterIP}</p></div>
                <div><p className="text-muted-foreground mb-1">Session Affinity</p><p>{sessionAffinity}</p></div>
                <div><p className="text-muted-foreground mb-1">Age</p><p>{age}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Ports</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ports.map((port, idx) => (
                  <div key={port.name || idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{port.name || `port-${idx}`}</p>
                      <p className="text-sm text-muted-foreground">{port.protocol || 'TCP'}</p>
                    </div>
                    <div className="text-right font-mono text-sm">
                      <p>{port.port} → {port.targetPort}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Selector</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selector).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="font-mono text-xs">{key}={value}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Endpoints</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {endpoints.map((ep) => (
                  <div key={ep} className="font-mono text-sm p-2 rounded bg-muted/50">{ep}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={svcName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={svcName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: ExternalLink, label: 'Port Forward', description: 'Forward local port to this service' },
          { icon: Download, label: 'Download YAML', description: 'Export Service definition' },
          { icon: Trash2, label: 'Delete Service', description: 'Remove this service', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Service"
        resourceIcon={Globe}
        name={svcName}
        namespace={svcNamespace}
        status={status}
        backLink="/services"
        backLabel="Services"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
        actions={[
          { label: 'Port Forward', icon: ExternalLink, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
