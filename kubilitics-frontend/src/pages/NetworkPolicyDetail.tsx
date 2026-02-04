import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Clock, Download, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer,
  YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus,
} from '@/components/resources';

const mockNetworkPolicy = {
  name: 'allow-frontend',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  podSelector: { matchLabels: { app: 'frontend' } },
  policyTypes: ['Ingress'],
  ingress: [
    {
      from: [
        { podSelector: { matchLabels: { app: 'nginx' } } },
        { namespaceSelector: { matchLabels: { name: 'monitoring' } } },
      ],
      ports: [{ protocol: 'TCP', port: 80 }, { protocol: 'TCP', port: 443 }],
    },
  ],
  egress: [],
  age: '60d',
  labels: { policy: 'frontend-access' },
};

const topologyNodes: TopologyNode[] = [
  { id: 'policy', type: 'networkpolicy', name: 'allow-frontend', status: 'healthy', isCurrent: true },
  { id: 'pod1', type: 'pod', name: 'frontend-abc12', status: 'healthy' },
  { id: 'pod2', type: 'pod', name: 'nginx-xyz', status: 'healthy' },
  { id: 'namespace', type: 'namespace', name: 'monitoring', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'policy', to: 'pod1', label: 'Applies To' },
  { from: 'pod2', to: 'policy', label: 'Allowed' },
  { from: 'namespace', to: 'policy', label: 'Allowed' },
];

const yaml = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: frontend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: nginx
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443`;

export default function NetworkPolicyDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const np = mockNetworkPolicy;

  const statusCards = [
    { label: 'Policy Types', value: np.policyTypes.join(', '), icon: Shield, iconColor: 'primary' as const },
    { label: 'Ingress Rules', value: np.ingress.length, icon: ArrowDownToLine, iconColor: 'info' as const },
    { label: 'Egress Rules', value: np.egress.length, icon: ArrowUpFromLine, iconColor: 'muted' as const },
    { label: 'Age', value: np.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
    else if (node.type === 'namespace') navigate(`/namespaces/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Pod Selector</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.entries(np.podSelector.matchLabels).map(([key, value]) => (
                  <Badge key={key} variant="outline" className="font-mono text-xs">{key}={value}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Policy Types</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {np.policyTypes.map((type) => (
                  <Badge key={type} variant="secondary">{type}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
          {np.ingress.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Ingress Rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {np.ingress.map((rule, idx) => (
                  <div key={idx} className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">From</p>
                      <div className="space-y-2">
                        {rule.from.map((source, sIdx) => (
                          <div key={sIdx} className="flex gap-2">
                            {'podSelector' in source && (
                              <Badge variant="outline" className="font-mono text-xs">
                                Pod: {Object.entries(source.podSelector.matchLabels).map(([k, v]) => `${k}=${v}`).join(', ')}
                              </Badge>
                            )}
                            {'namespaceSelector' in source && (
                              <Badge variant="secondary" className="font-mono text-xs">
                                Namespace: {Object.entries(source.namespaceSelector.matchLabels).map(([k, v]) => `${k}=${v}`).join(', ')}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Ports</p>
                      <div className="flex gap-2">
                        {rule.ports.map((port, pIdx) => (
                          <Badge key={pIdx} variant="outline" className="font-mono text-xs">
                            {port.port}/{port.protocol}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={[]} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={np.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export NetworkPolicy definition' },
          { icon: Trash2, label: 'Delete Policy', description: 'Remove this network policy', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="NetworkPolicy"
        resourceIcon={Shield}
        name={np.name}
        namespace={np.namespace}
        status={np.status}
        backLink="/networkpolicies"
        backLabel="Network Policies"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {np.age}</span>}
        actions={[{ label: 'Delete', icon: Trash2, variant: 'destructive' }]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
