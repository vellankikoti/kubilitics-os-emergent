import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Database, Clock, Server, Download, Trash2, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer,
  YamlViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo,
} from '@/components/resources';

const mockVolumeAttachment = {
  name: 'csi-att-001',
  status: 'Attached' as ResourceStatus,
  attacher: 'csi.example.com',
  nodeName: 'node-1',
  pvName: 'pvc-abc123',
  attached: true,
  age: '5d',
  attachmentMetadata: {
    'devicePath': '/dev/xvdf',
  },
};

const mockEvents: EventInfo[] = [];

const topologyNodes: TopologyNode[] = [
  { id: 'va', type: 'pv', name: 'csi-att-001', status: 'healthy', isCurrent: true },
  { id: 'pv', type: 'pv', name: 'pvc-abc123', status: 'healthy' },
  { id: 'node', type: 'node', name: 'node-1', status: 'healthy' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'va', to: 'pv', label: 'Attaches' },
  { from: 'va', to: 'node', label: 'To Node' },
];

const yaml = `apiVersion: storage.k8s.io/v1
kind: VolumeAttachment
metadata:
  name: csi-att-001
spec:
  attacher: csi.example.com
  nodeName: node-1
  source:
    persistentVolumeName: pvc-abc123
status:
  attached: true
  attachmentMetadata:
    devicePath: /dev/xvdf`;

export default function VolumeAttachmentDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const va = mockVolumeAttachment;

  const statusCards = [
    { label: 'Status', value: va.attached ? 'Attached' : 'Detached', icon: Database, iconColor: 'success' as const },
    { label: 'Node', value: va.nodeName, icon: Server, iconColor: 'info' as const },
    { label: 'PV', value: va.pvName, icon: HardDrive, iconColor: 'primary' as const },
    { label: 'Age', value: va.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pv' && node.name !== va.name) {
      navigate(`/persistentvolumes/${node.name}`);
    } else if (node.type === 'node') {
      navigate(`/nodes/${node.name}`);
    }
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Attachment Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Attacher</p>
                  <p className="font-mono text-xs">{va.attacher}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Status</p>
                  <Badge variant={va.attached ? 'default' : 'secondary'}>
                    {va.attached ? 'Attached' : 'Detached'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Node</p>
                  <p className="font-medium">{va.nodeName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">PersistentVolume</p>
                  <p className="font-mono text-xs">{va.pvName}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Attachment Metadata</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(va.attachmentMetadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">{key}</span>
                    <span className="font-mono text-sm">{value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={va.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Download, label: 'Download YAML', description: 'Export VolumeAttachment definition' },
          { icon: Trash2, label: 'Delete Attachment', description: 'Remove this volume attachment', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="VolumeAttachment"
        resourceIcon={Database}
        name={va.name}
        status={va.status}
        backLink="/volumeattachments"
        backLabel="Volume Attachments"
        metadata={<span className="flex items-center gap-1.5 ml-2"><Clock className="h-3.5 w-3.5" />Created {va.age}</span>}
        actions={[
          { label: 'Delete', icon: Trash2, variant: 'destructive' },
        ]}
      />
      <ResourceStatusCards cards={statusCards} />
      <ResourceTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </motion.div>
  );
}
