import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Network, Clock, Server, Download, Globe, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockEndpoint = {
  name: 'nginx-svc',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  subsets: [
    {
      addresses: [
        { ip: '10.244.1.45', nodeName: 'worker-node-1', targetRef: { kind: 'Pod', name: 'nginx-abc12' } },
        { ip: '10.244.2.46', nodeName: 'worker-node-2', targetRef: { kind: 'Pod', name: 'nginx-def34' } },
        { ip: '10.244.3.47', nodeName: 'worker-node-3', targetRef: { kind: 'Pod', name: 'nginx-ghi56' } },
      ],
      ports: [{ name: 'http', port: 8080, protocol: 'TCP' }],
    },
  ],
  age: '30d',
  labels: { app: 'nginx' },
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'service', type: 'service', name: 'nginx-svc', status: 'healthy' },
  { id: 'endpoint', type: 'endpoint', name: 'nginx-svc', status: 'healthy', isCurrent: true },
  { id: 'pod1', type: 'pod', name: 'nginx-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-def34', status: 'healthy' },
  { id: 'pod3', type: 'pod', name: 'nginx-ghi56', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'service', to: 'endpoint', label: 'Has' },
  { from: 'endpoint', to: 'pod1', label: 'Targets' },
  { from: 'endpoint', to: 'pod2', label: 'Targets' },
  { from: 'endpoint', to: 'pod3', label: 'Targets' },
];

const yaml = `apiVersion: v1
kind: Endpoints
metadata:
  name: nginx-svc
  namespace: production
subsets:
- addresses:
  - ip: 10.244.1.45
    nodeName: worker-node-1
    targetRef:
      kind: Pod
      name: nginx-abc12
  - ip: 10.244.2.46
    nodeName: worker-node-2
    targetRef:
      kind: Pod
      name: nginx-def34
  - ip: 10.244.3.47
    nodeName: worker-node-3
    targetRef:
      kind: Pod
      name: nginx-ghi56
  ports:
  - name: http
    port: 8080
    protocol: TCP`;

export default function EndpointDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const ep = mockEndpoint;

  const totalAddresses = ep.subsets.reduce((acc, s) => acc + s.addresses.length, 0);

  const statusCards = [
    { label: 'Addresses', value: totalAddresses, icon: Server, iconColor: 'success' as const },
    { label: 'Subsets', value: ep.subsets.length, icon: Network, iconColor: 'info' as const },
    { label: 'Age', value: ep.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
    else if (node.type === 'service') navigate(`/services/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {ep.subsets.map((subset, idx) => (
            <Card key={idx}>
              <CardHeader><CardTitle className="text-base">Subset {idx + 1}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Ports</h4>
                  <div className="flex gap-2">
                    {subset.ports.map((port) => (
                      <Badge key={port.name} variant="secondary" className="font-mono">
                        {port.name}: {port.port}/{port.protocol}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">Addresses</h4>
                  <div className="space-y-2">
                    {subset.addresses.map((addr) => (
                      <div key={addr.ip} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">{addr.ip}</span>
                          <Badge variant="outline">{addr.nodeName}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">Pod: {addr.targetRef.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={ep.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Globe, label: 'View Service', description: 'Navigate to the related service' },
          { icon: Download, label: 'Download YAML', description: 'Export Endpoints definition' },
          { icon: Trash2, label: 'Delete Endpoints', description: 'Remove this endpoints resource', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Endpoints"
        resourceIcon={Network}
        name={ep.name}
        namespace={ep.namespace}
        status={ep.status}
        backLink="/endpoints"
        backLabel="Endpoints"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {ep.age}</span>}
        actions={[
          { label: 'View Service', icon: Globe, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
