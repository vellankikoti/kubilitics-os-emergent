import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HardDrive, Clock, Download, Trash2, Database, Server } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockPV = {
  name: 'pv-data-001',
  status: 'Healthy' as ResourceStatus,
  capacity: '10Gi',
  accessModes: ['ReadWriteOnce'],
  reclaimPolicy: 'Retain',
  storageClass: 'standard',
  volumeMode: 'Filesystem',
  claim: { namespace: 'production', name: 'data-pvc' },
  age: '90d',
  labels: { type: 'data', tier: 'primary' },
  source: { type: 'hostPath', path: '/mnt/data/pv-001' },
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'pv', type: 'pv', name: 'pv-data-001', status: 'healthy', isCurrent: true },
  { id: 'pvc', type: 'pvc', name: 'data-pvc', status: 'healthy' },
  { id: 'pod', type: 'pod', name: 'app-pod-abc12', status: 'healthy' },
  { id: 'sc', type: 'storageclass', name: 'standard', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'pvc', to: 'pv', label: 'Binds' },
  { from: 'pod', to: 'pvc', label: 'Uses' },
  { from: 'sc', to: 'pv', label: 'Provisions' },
];

const yaml = `apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-data-001
  labels:
    type: data
    tier: primary
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: standard
  volumeMode: Filesystem
  hostPath:
    path: /mnt/data/pv-001`;

export default function PersistentVolumeDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const pv = mockPV;

  const statusCards = [
    { label: 'Capacity', value: pv.capacity, icon: HardDrive, iconColor: 'primary' as const },
    { label: 'Access Mode', value: pv.accessModes[0], icon: Database, iconColor: 'info' as const },
    { label: 'Reclaim Policy', value: pv.reclaimPolicy, icon: Server, iconColor: 'muted' as const },
    { label: 'Age', value: pv.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pvc') navigate(`/persistentvolumeclaims/${pv.claim.namespace}/${node.name}`);
    else if (node.type === 'pod') navigate(`/pods/${pv.claim.namespace}/${node.name}`);
    else if (node.type === 'storageclass') navigate(`/storageclasses/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Volume Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Capacity</p><Badge variant="secondary" className="font-mono">{pv.capacity}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Volume Mode</p><p>{pv.volumeMode}</p></div>
                <div><p className="text-muted-foreground mb-1">Storage Class</p><Badge variant="outline">{pv.storageClass}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Reclaim Policy</p><p>{pv.reclaimPolicy}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Source</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><p className="text-muted-foreground mb-1">Type</p><Badge variant="secondary">{pv.source.type}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Path</p><p className="font-mono">{pv.source.path}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Claim</CardTitle></CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="font-mono text-sm">{pv.claim.namespace}/{pv.claim.name}</p>
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={pv.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={pv.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export PV definition' },
          { icon: Trash2, label: 'Delete PV', description: 'Remove this Persistent Volume', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="PersistentVolume"
        resourceIcon={HardDrive}
        name={pv.name}
        status={pv.status}
        backLink="/persistentvolumes"
        backLabel="Persistent Volumes"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {pv.age}</span>}
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
