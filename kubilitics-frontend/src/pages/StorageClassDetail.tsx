import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Clock, Download, Trash2, Server, Settings, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResourceHeader, ResourceStatusCards, ResourceTabs, TopologyViewer, MetadataCard, YamlViewer, YamlCompareViewer, EventsSection, ActionsSection,
  type TopologyNode, type TopologyEdge, type ResourceStatus, type EventInfo, type YamlVersion,
} from '@/components/resources';
import { toast } from 'sonner';

const mockEvents: EventInfo[] = [];

const mockStorageClass = {
  name: 'standard',
  status: 'Healthy' as ResourceStatus,
  provisioner: 'kubernetes.io/gce-pd',
  reclaimPolicy: 'Delete',
  volumeBindingMode: 'Immediate',
  allowVolumeExpansion: true,
  isDefault: true,
  age: '365d',
  labels: { 'storageclass.kubernetes.io/is-default-class': 'true' },
  parameters: { type: 'pd-standard', 'replication-type': 'none' },
};

const topologyNodes: TopologyNode[] = [
  { id: 'sc', type: 'storageclass', name: 'standard', status: 'healthy', isCurrent: true },
  { id: 'pv1', type: 'pv', name: 'pv-data-001', status: 'healthy' },
  { id: 'pv2', type: 'pv', name: 'pv-logs-002', status: 'healthy' },
  { id: 'pvc1', type: 'pvc', name: 'data-pvc', status: 'healthy' },
  { id: 'pvc2', type: 'pvc', name: 'redis-pvc', status: 'warning' },
];

const topologyEdges: TopologyEdge[] = [
  { from: 'sc', to: 'pv1', label: 'Provisions' },
  { from: 'sc', to: 'pv2', label: 'Provisions' },
  { from: 'pvc1', to: 'pv1', label: 'Binds' },
  { from: 'pvc2', to: 'sc', label: 'Requests' },
];

const yaml = `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: kubernetes.io/gce-pd
reclaimPolicy: Delete
volumeBindingMode: Immediate
allowVolumeExpansion: true
parameters:
  type: pd-standard
  replication-type: none`;

export default function StorageClassDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const sc = mockStorageClass;

  // Mock YAML versions for comparison
  const yamlVersions: YamlVersion[] = [
    { id: 'current', label: 'Current Version', yaml, timestamp: 'now' },
    { id: 'previous', label: 'Previous Version', yaml: yaml.replace('Delete', 'Retain'), timestamp: '2 hours ago' },
    { id: 'initial', label: 'Initial Version', yaml: yaml.replace('Immediate', 'WaitForFirstConsumer'), timestamp: '1 day ago' },
  ];

  const handleSaveYaml = async (newYaml: string) => {
    toast.success('StorageClass updated successfully');
    console.log('Saving YAML:', newYaml);
  };

  const statusCards = [
    { label: 'Provisioner', value: 'gce-pd', icon: Server, iconColor: 'primary' as const },
    { label: 'Reclaim Policy', value: sc.reclaimPolicy, icon: Settings, iconColor: 'info' as const },
    { label: 'Default', value: sc.isDefault ? 'Yes' : 'No', icon: Star, iconColor: sc.isDefault ? 'success' as const : 'muted' as const },
    { label: 'Age', value: sc.age, icon: Clock, iconColor: 'muted' as const },
  ];

  const handleNodeClick = (node: TopologyNode) => {
    if (node.type === 'pv') navigate(`/persistentvolumes/${node.name}`);
    else if (node.type === 'pvc') navigate(`/persistentvolumeclaims/production/${node.name}`);
  };

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      content: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Storage Class Info</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground mb-1">Provisioner</p><p className="font-mono text-xs">{sc.provisioner}</p></div>
                <div><p className="text-muted-foreground mb-1">Reclaim Policy</p><Badge variant="outline">{sc.reclaimPolicy}</Badge></div>
                <div><p className="text-muted-foreground mb-1">Volume Binding</p><p>{sc.volumeBindingMode}</p></div>
                <div><p className="text-muted-foreground mb-1">Volume Expansion</p><Badge variant={sc.allowVolumeExpansion ? 'default' : 'secondary'}>{sc.allowVolumeExpansion ? 'Allowed' : 'Disabled'}</Badge></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Parameters</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(sc.parameters).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="font-mono text-sm">{key}</span>
                    <Badge variant="secondary" className="font-mono">{value}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <MetadataCard title="Labels" items={sc.labels} variant="badges" />
        </div>
      ),
    },
    { id: 'events', label: 'Events', content: <EventsSection events={mockEvents} /> },
    { id: 'yaml', label: 'YAML', content: <YamlViewer yaml={yaml} resourceName={sc.name} editable onSave={handleSaveYaml} /> },
    { id: 'compare', label: 'Compare', content: <YamlCompareViewer versions={yamlVersions} resourceName={sc.name} /> },
    { id: 'topology', label: 'Topology', content: <TopologyViewer nodes={topologyNodes} edges={topologyEdges} onNodeClick={handleNodeClick} /> },
    {
      id: 'actions',
      label: 'Actions',
      content: (
        <ActionsSection actions={[
          { icon: Star, label: 'Set as Default', description: 'Make this the default storage class' },
          { icon: Download, label: 'Download YAML', description: 'Export StorageClass definition' },
          { icon: Trash2, label: 'Delete StorageClass', description: 'Remove this Storage Class', variant: 'destructive' },
        ]} />
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <ResourceHeader
        resourceType="StorageClass"
        resourceIcon={Layers}
        name={sc.name}
        status={sc.status}
        backLink="/storageclasses"
        backLabel="Storage Classes"
        metadata={
          <span className="flex items-center gap-1.5 ml-2">
            <Clock className="h-3.5 w-3.5" />Created {sc.age}
            {sc.isDefault && <><span className="mx-2">•</span><Star className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />Default</>}
          </span>
        }
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
