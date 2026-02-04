import { useState } from 'react';
import { HardDrive } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface PersistentVolume {
  name: string;
  capacity: string;
  accessModes: string[];
  reclaimPolicy: string;
  status: string;
  claim: string;
  storageClass: string;
  age: string;
}

interface K8sPersistentVolume extends KubernetesResource {
  spec?: {
    capacity?: { storage?: string };
    accessModes?: string[];
    persistentVolumeReclaimPolicy?: string;
    storageClassName?: string;
    claimRef?: { namespace?: string; name?: string };
  };
  status?: {
    phase?: string;
  };
}

const mockPVs: PersistentVolume[] = [
  { name: 'pv-data-001', capacity: '10Gi', accessModes: ['RWO'], reclaimPolicy: 'Retain', status: 'Bound', claim: 'production/data-pvc', storageClass: 'standard', age: '90d' },
  { name: 'pv-logs-002', capacity: '50Gi', accessModes: ['RWX'], reclaimPolicy: 'Delete', status: 'Bound', claim: 'logging/logs-pvc', storageClass: 'fast', age: '60d' },
  { name: 'pv-backup-003', capacity: '100Gi', accessModes: ['RWO'], reclaimPolicy: 'Retain', status: 'Available', claim: '-', storageClass: 'slow', age: '30d' },
  { name: 'pv-db-004', capacity: '20Gi', accessModes: ['RWO'], reclaimPolicy: 'Retain', status: 'Bound', claim: 'production/postgres-pvc', storageClass: 'ssd', age: '120d' },
];

const statusColors: Record<string, string> = {
  Bound: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]',
  Available: 'bg-[hsl(var(--info)/0.1)] text-[hsl(var(--info))]',
  Released: 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]',
  Failed: 'bg-[hsl(var(--error)/0.1)] text-[hsl(var(--error))]',
};

const columns: Column<PersistentVolume>[] = [
  { key: 'name', header: 'Name', render: (pv) => <span className="font-medium">{pv.name}</span> },
  { key: 'capacity', header: 'Capacity', render: (pv) => <Badge variant="secondary" className="font-mono">{pv.capacity}</Badge> },
  { key: 'accessModes', header: 'Access Modes', render: (pv) => <span className="font-mono text-sm">{pv.accessModes.join(', ')}</span> },
  { key: 'status', header: 'Status', render: (pv) => <Badge className={statusColors[pv.status] || ''}>{pv.status}</Badge> },
  { key: 'claim', header: 'Claim', render: (pv) => <span className="text-muted-foreground font-mono text-sm">{pv.claim}</span> },
  { key: 'storageClass', header: 'Storage Class', render: (pv) => <Badge variant="outline">{pv.storageClass}</Badge> },
  { key: 'age', header: 'Age', render: (pv) => <span className="text-muted-foreground">{pv.age}</span> },
];

function formatAccessMode(mode: string): string {
  const modeMap: Record<string, string> = {
    'ReadWriteOnce': 'RWO',
    'ReadOnlyMany': 'ROX',
    'ReadWriteMany': 'RWX',
    'ReadWriteOncePod': 'RWOP',
  };
  return modeMap[mode] || mode;
}

export default function PersistentVolumes() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sPersistentVolume>('persistentvolumes');
  const [showCreator, setShowCreator] = useState(false);

  const pvs: PersistentVolume[] = config.isConnected && data?.items
    ? data.items.map((pv) => {
        const claimRef = pv.spec?.claimRef;
        return {
          name: pv.metadata.name,
          capacity: pv.spec?.capacity?.storage || '-',
          accessModes: (pv.spec?.accessModes || []).map(formatAccessMode),
          reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy || '-',
          status: pv.status?.phase || 'Unknown',
          claim: claimRef ? `${claimRef.namespace}/${claimRef.name}` : '-',
          storageClass: pv.spec?.storageClassName || '-',
          age: calculateAge(pv.metadata.creationTimestamp),
        };
      })
    : mockPVs;

  const handleCreate = (yaml: string) => {
    toast.success('PersistentVolume created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="PersistentVolume"
        defaultYaml={DEFAULT_YAMLS.PersistentVolume}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Persistent Volumes"
      icon={HardDrive}
      items={pvs}
      columns={columns}
      getRowLink={(pv) => `/persistentvolumes/${pv.name}`}
      getItemKey={(pv) => pv.name}
      filterKey="status"
      searchPlaceholder="Search persistent volumes..."
      isLoading={isLoading}
      onRefresh={refetch}
      onCreate={() => setShowCreator(true)}
    />
  );
}
