import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Network, Clock, Download, Globe, Server, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEndpointSlice = {
  name: 'nginx-svc-abc12',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  addressType: 'IPv4',
  age: '30d',
  labels: { 'kubernetes.io/service-name': 'nginx-svc', 'endpointslice.kubernetes.io/managed-by': 'endpointslice-controller.k8s.io' },
  endpoints: [
    { addresses: ['10.244.1.45'], conditions: { ready: true, serving: true, terminating: false }, targetRef: { kind: 'Pod', name: 'nginx-abc12', namespace: 'production' } },
    { addresses: ['10.244.2.46'], conditions: { ready: true, serving: true, terminating: false }, targetRef: { kind: 'Pod', name: 'nginx-def34', namespace: 'production' } },
    { addresses: ['10.244.3.47'], conditions: { ready: true, serving: true, terminating: false }, targetRef: { kind: 'Pod', name: 'nginx-ghi56', namespace: 'production' } },
  ],
  ports: [{ name: 'http', port: 80, protocol: 'TCP' }],
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'es', type: 'endpointslice', name: 'nginx-svc-abc12', status: 'healthy', isCurrent: true },
  { id: 'svc', type: 'service', name: 'nginx-svc', status: 'healthy' },
  { id: 'pod1', type: 'pod', name: 'nginx-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-def34', status: 'healthy' },
  { id: 'pod3', type: 'pod', name: 'nginx-ghi56', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'svc', to: 'es', label: 'Has' },
  { from: 'es', to: 'pod1', label: 'Targets' },
  { from: 'es', to: 'pod2', label: 'Targets' },
  { from: 'es', to: 'pod3', label: 'Targets' },
];

const yaml = `apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: nginx-svc-abc12
  namespace: production
  labels:
    kubernetes.io/service-name: nginx-svc
    endpointslice.kubernetes.io/managed-by: endpointslice-controller.k8s.io
addressType: IPv4
endpoints:
- addresses:
  - 10.244.1.45
  conditions:
    ready: true
    serving: true
    terminating: false
  targetRef:
    kind: Pod
    name: nginx-abc12
    namespace: production
ports:
- name: http
  port: 80
  protocol: TCP`;

export default function EndpointSliceDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const es = mockEndpointSlice;

  const statusCards = [
    { label: 'Address Type', value: es.addressType, icon: Network, iconColor: 'primary' as const },
    { label: 'Endpoints', value: es.endpoints.length, icon: Server, iconColor: 'success' as const },
    { label: 'Ports', value: es.ports.length, icon: Globe, iconColor: 'info' as const },
    { label: 'Age', value: es.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'service') navigate(`/services/${namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Endpoints</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {es.endpoints.map((ep, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono">{ep.addresses.join(', ')}</span>
                      <Badge variant={ep.conditions.ready ? 'default' : 'secondary'}>{ep.conditions.ready ? 'Ready' : 'Not Ready'}</Badge>
                    </div>
                    {ep.targetRef && (
                      <p className="text-xs text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => navigate(`/pods/${ep.targetRef.namespace}/${ep.targetRef.name}`)}>
                        → {ep.targetRef.kind}/{ep.targetRef.name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Ports</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {es.ports.map((port, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{port.name || 'unnamed'}</p>
                      <p className="text-sm text-muted-foreground">{port.protocol}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono">{port.port}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={es.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={es.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export EndpointSlice definition' },
          { icon: Trash2, label: 'Delete EndpointSlice', description: 'Remove this endpoint slice', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="EndpointSlice"
        resourceIcon={Network}
        name={es.name}
        namespace={es.namespace}
        status={es.status}
        backLink="/endpointslices"
        backLabel="Endpoint Slices"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {es.age}</span>}
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
