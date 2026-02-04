import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Database, Clock, Download, Trash2, HardDrive, Server, Expand } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo, type YamlVersion,
} from '@/components/resources';
import { toast } from 'sonner';

const mockPVC = {
  name: 'data-pvc',
  namespace: 'production',
  status: 'Healthy' as ResourceStatus,
  volume: 'pv-data-001',
  capacity: '10Gi',
  requestedCapacity: '10Gi',
  accessModes: ['ReadWriteOnce'],
  storageClass: 'standard',
  volumeMode: 'Filesystem',
  age: '90d',
  labels: { app: 'data-store', environment: 'production' },
};

const mockEvents: EventInfo[] = [
  { type: 'Normal', reason: 'ProvisioningSucceeded', message: 'Successfully provisioned volume pv-data-001', time: '90d ago' },
];

const topologyNodes: TopologyNode[] = [
  { id: 'pvc', type: 'pvc', name: 'data-pvc', status: 'healthy', isCurrent: true },
  { id: 'pv', type: 'pv', name: 'pv-data-001', status: 'healthy' },
  { id: 'pod', type: 'pod', name: 'app-pod-abc12', status: 'healthy' },
  { id: 'sc', type: 'storageclass', name: 'standard', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'pvc', to: 'pv', label: 'Binds' },
  { from: 'pod', to: 'pvc', label: 'Uses' },
  { from: 'sc', to: 'pvc', label: 'Provisions' },
];

const yaml = `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
  namespace: production
  labels:
    app: data-store
    environment: production
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  volumeMode: Filesystem
  resources:
    requests:
      storage: 10Gi
status:
  phase: Bound
  accessModes:
    - ReadWriteOnce
  capacity:
    storage: 10Gi`;

export default function PersistentVolumeClaimDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const pvc = mockPVC;

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('storage: 10Gi', 'storage: 5Gi'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('ReadWriteOnce', 'ReadOnlyMany'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('PersistentVolumeClaim updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const statusCards = [
    { label: 'Capacity', value: pvc.capacity, icon: Database, iconColor: 'primary' as const },
    { label: 'Access Mode', value: pvc.accessModes[0], icon: HardDrive, iconColor: 'info' as const },
    { label: 'Storage Class', value: pvc.storageClass, icon: Server, iconColor: 'muted' as const },
    { label: 'Age', value: pvc.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pv') navigate(`/persistentvolumes/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${namespace}/${node.name}`);
    else if (node.type === 'storageclass') navigate(`/storageclasses/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Claim Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Capacity</p><Badge variant="secondary" className="font-mono">{pvc.capacity}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Requested</p><p className="font-mono">{pvc.requestedCapacity}</p></div>
                <div><p className="text-muted-foreground mb-1">Volume Mode</p><p>{pvc.volumeMode}</p></div>
                <div><p className="text-muted-foreground mb-1">Storage Class</p><Badge variant="outline">{pvc.storageClass}</Badge></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Bound Volume</CardTitle></CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors" onClick={() => navigate(`/persistentvolumes/${pvc.volume}`)}>
                <p className="font-mono text-sm">{pvc.volume}</p>
                <p className="text-xs text-muted-foreground mt-1">Click to view volume details</p>
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={pvc.labels} variant="badges" />
          <Card>
            <CardHeader><CardTitle className="text-base">Access Modes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {pvc.accessModes.map((mode) => (
                  <Badge key={mode} variant="secondary" className="font-mono">{mode}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={pvc.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={pvc.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Expand, label: 'Expand Volume', description: 'Increase the storage capacity' },
          { icon: Download, label: 'Download YAML', description: 'Export PVC definition' },
          { icon: Trash2, label: 'Delete PVC', description: 'Remove this Persistent Volume Claim', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="PersistentVolumeClaim"
        resourceIcon={Database}
        name={pvc.name}
        namespace={pvc.namespace}
        status={pvc.status}
        backLink="/persistentvolumeclaims"
        backLabel="Persistent Volume Claims"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {pvc.age}</span>}
        actions={[
          { label: 'Expand', icon: Expand, variant: 'outline' },
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
