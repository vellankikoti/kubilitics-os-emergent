import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Clock, User, Download, Trash2, Timer, RefreshCw, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer,
  YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo, type YamlVersion,
} from '@/components/resources';

const mockLease = {
  name: 'kube-scheduler',
  namespace: 'kube-system',
  status: 'Active' as ResourceStatus,
  holderIdentity: 'master-1_abc123',
  leaseDurationSeconds: 15,
  acquireTime: '2024-01-01T00:00:00Z',
  renewTime: '2024-06-15T12:30:45Z',
  leaseTransitions: 0,
  age: '180d',
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'lease', type: 'configmap', name: 'kube-scheduler', status: 'healthy', isCurrent: true },
  { id: 'node', type: 'node', name: 'master-1', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'lease', to: 'node', label: 'Held By' },
];

const yaml = `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: kube-scheduler
  namespace: kube-system
spec:
  holderIdentity: master-1_abc123
  leaseDurationSeconds: 15
  acquireTime: "2024-01-01T00:00:00Z"
  renewTime: "2024-06-15T12:30:45Z"
  leaseTransitions: 0`;

export default function LeaseDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const lease = mockLease;

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('leaseDurationSeconds: 15', 'leaseDurationSeconds: 10'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('leaseTransitions: 0', 'leaseTransitions: 1'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('Lease updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'node') navigate(`/nodes/${node.name}`);
  };

  // Calculate time since last renewal
  const renewTime = new Date(lease.renewTime);
  const now = new Date();
  const secondsSinceRenewal = Math.floor((now.getTime() - renewTime.getTime()) / 1000);
  const isExpired = secondsSinceRenewal > lease.leaseDurationSeconds;

  const statusCards = [
    { label: 'Status', value: isExpired ? 'Expired' : 'Active', icon: Activity, iconColor: isExpired ? 'error' as const : 'success' as const },
    { label: 'Holder', value: lease.holderIdentity.split('_')[0], icon: User, iconColor: 'info' as const },
    { label: 'Duration', value: `${lease.leaseDurationSeconds}s`, icon: Timer, iconColor: 'primary' as const },
    { label: 'Age', value: lease.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Lease Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Holder Identity</p>
                  <p className="font-mono text-xs break-all">{lease.holderIdentity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Lease Duration</p>
                  <Badge variant="secondary">{lease.leaseDurationSeconds}s</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Transitions</p>
                  <p>{lease.leaseTransitions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Age</p>
                  <p>{lease.age}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timing</CardTitle>
              <CardDescription>Lease acquisition and renewal timestamps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Acquire Time</span>
                  <span className="font-mono text-xs">{new Date(lease.acquireTime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-muted-foreground">Renew Time</span>
                  <span className="font-mono text-xs">{new Date(lease.renewTime).toLocaleString()}</span>
                </div>
                <div className={`flex justify-between p-3 rounded-lg ${isExpired ? 'bg-destructive/10' : 'bg-success/10'}`}>
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant={isExpired ? 'destructive' : 'default'}>
                    {isExpired ? 'Expired' : 'Active'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Lease Purpose</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Leases are used for leader election in the Kubernetes control plane. The <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{lease.name}</code> lease 
                ensures only one instance of the {lease.name.replace('-', ' ')} runs at a time. The holder ({lease.holderIdentity.split('_')[0]}) 
                must renew this lease every {lease.leaseDurationSeconds} seconds to maintain leadership.
              </p>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={lease.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={lease.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: RefreshCw, label: 'Force Renew', description: 'Force renewal of the lease' },
          { icon: Download, label: 'Download YAML', description: 'Export Lease definition' },
          { icon: Trash2, label: 'Delete Lease', description: 'Remove this lease', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="Lease"
        resourceIcon={Activity}
        name={lease.name}
        namespace={lease.namespace}
        status={isExpired ? 'Failed' : 'Healthy'}
        backLink="/leases"
        backLabel="Leases"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {lease.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
