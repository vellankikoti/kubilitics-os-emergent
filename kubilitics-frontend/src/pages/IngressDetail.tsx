import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Globe, Clock, Download, Trash2, Lock, ExternalLink } from 'lucide-react';
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

interface IngressResource extends KubernetesResource {
  spec?: {
    ingressClassName?: string;
    rules?: Array<{
      host?: string;
      http?: {
        paths: Array<{
          path: string;
          pathType: string;
          backend: {
            service?: { name: string; port: { number?: number; name?: string } };
          };
        }>;
      };
    }>;
    tls?: Array<{ hosts?: string[]; secretName?: string }>;
  };
  status?: {
    loadBalancer?: {
      ingress?: Array<{ ip?: string; hostname?: string }>;
    };
  };
}

const mockIngressResource: IngressResource = {
  apiVersion: 'networking.k8s.io/v1',
  kind: 'Ingress',
  metadata: {
    name: 'main-ingress',
    namespace: 'production',
    uid: 'mock-uid',
    creationTimestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    labels: { app: 'main', tier: 'ingress' },
    annotations: { 'nginx.ingress.kubernetes.io/ssl-redirect': 'true' },
  },
  spec: {
    ingressClassName: 'nginx',
    rules: [
      {
        host: 'app.example.com',
        http: {
          paths: [
            { path: '/', pathType: 'Prefix', backend: { service: { name: 'frontend', port: { number: 80 } } } },
            { path: '/api', pathType: 'Prefix', backend: { service: { name: 'api-gateway', port: { number: 443 } } } },
          ],
        },
      },
    ],
    tls: [{ hosts: ['app.example.com'], secretName: 'app-tls-secret' }],
  },
  status: {
    loadBalancer: { ingress: [{ ip: '34.120.10.100' }] },
  },
};

const topologyNodes: TopologyNode[] = [
  { id: 'ingress', type: 'ingress', name: 'main-ingress', status: 'healthy', isCurrent: true },
  { id: 'svc1', type: 'service', name: 'frontend', status: 'healthy' },
  { id: 'svc2', type: 'service', name: 'api-gateway', status: 'healthy' },
  { id: 'secret', type: 'secret', name: 'app-tls-secret', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'ingress', to: 'svc1', label: '/ → :80' },
  { from: 'ingress', to: 'svc2', label: '/api → :443' },
  { from: 'ingress', to: 'secret', label: 'TLS' },
];

export default function IngressDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { resource: ing, isLoading, age, yaml, isConnected } = useResourceDetail<IngressResource>(
    'ingresses',
    name,
    namespace,
    mockIngressResource
  );
  const { events } = useK8sEvents(namespace);

  const ingName = ing.metadata?.name || '';
  const ingNamespace = ing.metadata?.namespace || '';
  const annotations = ing.metadata?.annotations || {};
  const ingressClassName = ing.spec?.ingressClassName || '-';
  const rules = ing.spec?.rules || [];
  const tls = ing.spec?.tls || [];
  const lbIngress = ing.status?.loadBalancer?.ingress || [];
  const address = lbIngress[0]?.ip || lbIngress[0]?.hostname || '-';
  const status: ResourceStatus = 'Healthy';

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('app.example.com', 'old.example.com'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('/api', '/v1/api'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Ingress updated successfully');
    console.log('Saving YAML:', newYaml);
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
    { label: 'Class', value: ingressClassName, icon: Globe, iconColor: 'primary' as const },
    { label: 'Address', value: address, icon: ExternalLink, iconColor: 'success' as const },
    { label: 'TLS', value: tls.length > 0 ? 'Enabled' : 'Disabled', icon: Lock, iconColor: tls.length > 0 ? 'success' as const : 'muted' as const },
    { label: 'Age', value: age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'service') navigate(`/services/${namespace}/${node.name}`);
    else if (node.type === 'secret') navigate(`/secrets/${namespace}/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Rules</CardTitle></CardHeader>
            <CardContent>
              {rules.map((rule, idx) => (
                <div key={rule.host || idx} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-mono font-medium">{rule.host || '*'}</span>
                  </div>
                  <div className="ml-6 space-y-2">
                    {(rule.http?.paths || []).map((path, pIdx) => (
                      <div key={path.path || pIdx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{path.pathType}</Badge>
                          <span className="font-mono text-sm">{path.path}</span>
                        </div>
                        <div className="font-mono text-sm text-muted-foreground">
                          → {path.backend.service?.name}:{path.backend.service?.port.number || path.backend.service?.port.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {tls.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">TLS Configuration</CardTitle></CardHeader>
              <CardContent>
                {tls.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-[hsl(var(--success))]" />
                      <span className="font-mono text-sm">{(t.hosts || []).join(', ')}</span>
                    </div>
                    <Badge variant="secondary">{t.secretName}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle className="text-base">Annotations</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(annotations).map(([key, value]) => (
                  <div key={key} className="text-sm">
                    <p className="text-muted-foreground">{key}</p>
                    <p className="font-mono">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={events} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={ingName} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={ingName} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export Ingress definition' },
          { icon: Trash2, label: 'Delete Ingress', description: 'Remove this ingress', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Ingress"
        resourceIcon={Globe}
        name={ingName}
        namespace={ingNamespace}
        status={status}
        backLink="/ingresses"
        backLabel="Ingresses"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {age}{isConnected && <Badge variant="outline" className="ml-2 text-xs">Live</Badge>}</span>}
        actions={[{ label: 'Delete', icon: Trash2, variant: 'destructive' }]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
