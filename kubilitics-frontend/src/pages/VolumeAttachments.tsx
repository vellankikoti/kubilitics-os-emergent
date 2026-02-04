import { useState } from 'react';
import { Database } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface VolumeAttachment {
  id: string;
  name: string;
  node: string;
  volume: string;
  status: string;
  age: string;
}

const columns: Column<VolumeAttachment>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'node', header: 'Node', render: (item) => item.node },
  { key: 'volume', header: 'Volume', render: (item) => item.volume },
  { key: 'status', header: 'Status', render: (item) => (
    <Badge variant={item.status === 'Attached' ? 'default' : 'secondary'}>
      {item.status}
    </Badge>
  )},
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: VolumeAttachment[] = [
  { id: '1', name: 'csi-att-001', node: 'node-1', volume: 'pvc-abc123', status: 'Attached', age: '5d' },
  { id: '2', name: 'csi-att-002', node: 'node-2', volume: 'pvc-def456', status: 'Attached', age: '3d' },
  { id: '3', name: 'csi-att-003', node: 'node-1', volume: 'pvc-ghi789', status: 'Attached', age: '1d' },
];

export default function VolumeAttachments() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('volumeattachments');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const items: VolumeAttachment[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        node: item.spec?.nodeName || '-',
        volume: item.spec?.source?.persistentVolumeName || item.spec?.source?.inlineVolumeSpec?.csi?.volumeHandle || '-',
        status: item.status?.attached ? 'Attached' : 'Detached',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  return (
    <>
      <ResourceList
        title="Volume Attachments"
        icon={Database}
        items={items}
        columns={columns}
        searchPlaceholder="Search volume attachments..."
        filterKey="node"
        filterLabel="Node"
        getRowLink={(row) => `/volumeattachments/${row.name}`}
        getItemKey={(row) => row.id}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="VolumeAttachment"
          defaultYaml={DEFAULT_YAMLS.VolumeAttachment}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('VolumeAttachment created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}