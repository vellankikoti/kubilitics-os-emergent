import { useState } from 'react';
import { Layers } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface StorageClass {
  name: string;
  provisioner: string;
  reclaimPolicy: string;
  volumeBindingMode: string;
  allowVolumeExpansion: boolean;
  isDefault: boolean;
  age: string;
}

interface K8sStorageClass extends KubernetesResource {
  provisioner?: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  allowVolumeExpansion?: boolean;
}

const mockStorageClasses: StorageClass[] = [
  { name: 'standard', provisioner: 'kubernetes.io/gce-pd', reclaimPolicy: 'Delete', volumeBindingMode: 'Immediate', allowVolumeExpansion: true, isDefault: true, age: '365d' },
  { name: 'fast', provisioner: 'kubernetes.io/gce-pd', reclaimPolicy: 'Delete', volumeBindingMode: 'WaitForFirstConsumer', allowVolumeExpansion: true, isDefault: false, age: '180d' },
  { name: 'ssd', provisioner: 'kubernetes.io/gce-pd', reclaimPolicy: 'Retain', volumeBindingMode: 'Immediate', allowVolumeExpansion: true, isDefault: false, age: '90d' },
  { name: 'slow', provisioner: 'kubernetes.io/gce-pd', reclaimPolicy: 'Delete', volumeBindingMode: 'Immediate', allowVolumeExpansion: false, isDefault: false, age: '365d' },
];

const columns: Column<StorageClass>[] = [
  { key: 'name', header: 'Name', render: (sc) => (
    <div className="flex items-center gap-2">
      <span className="font-medium">{sc.name}</span>
      {sc.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
    </div>
  )},
  { key: 'provisioner', header: 'Provisioner', render: (sc) => <span className="font-mono text-sm">{sc.provisioner}</span> },
  { key: 'reclaimPolicy', header: 'Reclaim Policy', render: (sc) => <Badge variant="outline">{sc.reclaimPolicy}</Badge> },
  { key: 'volumeBindingMode', header: 'Volume Binding', render: (sc) => <span className="text-sm">{sc.volumeBindingMode}</span> },
  { key: 'allowVolumeExpansion', header: 'Expansion', render: (sc) => <Badge variant={sc.allowVolumeExpansion ? 'default' : 'secondary'}>{sc.allowVolumeExpansion ? 'Yes' : 'No'}</Badge> },
  { key: 'age', header: 'Age', render: (sc) => <span className="text-muted-foreground">{sc.age}</span> },
];

export default function StorageClasses() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sStorageClass>('storageclasses');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const storageclasses: StorageClass[] = config.isConnected && data?.items
    ? data.items.map((sc) => {
        const isDefault = sc.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true';
        return {
          name: sc.metadata.name,
          provisioner: sc.provisioner || '-',
          reclaimPolicy: sc.reclaimPolicy || 'Delete',
          volumeBindingMode: sc.volumeBindingMode || 'Immediate',
          allowVolumeExpansion: sc.allowVolumeExpansion ?? false,
          isDefault,
          age: calculateAge(sc.metadata.creationTimestamp),
        };
      })
    : mockStorageClasses;

  return (
    <>
      <ResourceList
        title="Storage Classes"
        icon={Layers}
        items={storageclasses}
        columns={columns}
        getRowLink={(sc) => `/storageclasses/${sc.name}`}
        getItemKey={(sc) => sc.name}
        searchPlaceholder="Search storage classes..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="StorageClass"
          defaultYaml={DEFAULT_YAMLS.StorageClass}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('StorageClass created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}