import { useState } from 'react';
import { Database } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface PVC {
  name: string;
  namespace: string;
  status: string;
  volume: string;
  capacity: string;
  accessModes: string[];
  storageClass: string;
  age: string;
}

interface K8sPVC extends KubernetesResource {
  spec?: {
    volumeName?: string;
    storageClassName?: string;
    accessModes?: string[];
    resources?: { requests?: { storage?: string } };
  };
  status?: {
    phase?: string;
    capacity?: { storage?: string };
  };
}

const mockPVCs: PVC[] = [
  { name: 'data-pvc', namespace: 'production', status: 'Bound', volume: 'pv-data-001', capacity: '10Gi', accessModes: ['RWO'], storageClass: 'standard', age: '90d' },
  { name: 'logs-pvc', namespace: 'logging', status: 'Bound', volume: 'pv-logs-002', capacity: '50Gi', accessModes: ['RWX'], storageClass: 'fast', age: '60d' },
  { name: 'postgres-pvc', namespace: 'production', status: 'Bound', volume: 'pv-db-004', capacity: '20Gi', accessModes: ['RWO'], storageClass: 'ssd', age: '120d' },
  { name: 'redis-pvc', namespace: 'staging', status: 'Pending', volume: '-', capacity: '5Gi', accessModes: ['RWO'], storageClass: 'standard', age: '1d' },
];

const statusColors: Record<string, string> = {
  Bound: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]',
  Pending: 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]',
  Lost: 'bg-[hsl(var(--error)/0.1)] text-[hsl(var(--error))]',
};

const columns: Column<PVC>[] = [
  { key: 'name', header: 'Name', render: (pvc) => <span className="font-medium">{pvc.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (pvc) => <Badge variant="outline">{pvc.namespace}</Badge> },
  { key: 'status', header: 'Status', render: (pvc) => <Badge className={statusColors[pvc.status] || ''}>{pvc.status}</Badge> },
  { key: 'volume', header: 'Volume', render: (pvc) => <span className="font-mono text-sm">{pvc.volume}</span> },
  { key: 'capacity', header: 'Capacity', render: (pvc) => <Badge variant="secondary" className="font-mono">{pvc.capacity}</Badge> },
  { key: 'storageClass', header: 'Storage Class', render: (pvc) => <Badge variant="outline">{pvc.storageClass}</Badge> },
  { key: 'age', header: 'Age', render: (pvc) => <span className="text-muted-foreground">{pvc.age}</span> },
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

export default function PersistentVolumeClaims() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sPVC>('persistentvolumeclaims');
  const deleteResource = useDeleteK8sResource('persistentvolumeclaims');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: PVC | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const pvcs: PVC[] = config.isConnected && data?.items
    ? data.items.map((pvc) => ({
        name: pvc.metadata.name,
        namespace: pvc.metadata.namespace || 'default',
        status: pvc.status?.phase || 'Unknown',
        volume: pvc.spec?.volumeName || '-',
        capacity: pvc.status?.capacity?.storage || pvc.spec?.resources?.requests?.storage || '-',
        accessModes: (pvc.spec?.accessModes || []).map(formatAccessMode),
        storageClass: pvc.spec?.storageClassName || '-',
        age: calculateAge(pvc.metadata.creationTimestamp),
      }))
    : mockPVCs;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
        namespace: deleteDialog.item.namespace,
      });
    } else {
      toast.success(`PVC ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleAction = (action: string, item: PVC) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    }
  };

  return (
    <>
      <ResourceList
        title="Persistent Volume Claims"
        icon={Database}
        items={pvcs}
        columns={columns}
        getRowLink={(pvc) => `/persistentvolumeclaims/${pvc.namespace}/${pvc.name}`}
        getItemKey={(pvc) => `${pvc.namespace}/${pvc.name}`}
        filterKey="namespace"
        searchPlaceholder="Search PVCs..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
        actions={[
          { label: 'Download YAML' },
          { label: 'Delete', destructive: true, onClick: (item) => handleAction('Delete', item) },
        ]}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="PersistentVolumeClaim"
          defaultYaml={DEFAULT_YAMLS.PersistentVolumeClaim}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('PersistentVolumeClaim created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="PersistentVolumeClaim"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}