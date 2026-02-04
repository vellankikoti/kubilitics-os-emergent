import { useState } from 'react';
import { Activity } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface Lease {
  id: string;
  name: string;
  namespace: string;
  holder: string;
  duration: string;
  age: string;
}

const columns: Column<Lease>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'namespace', header: 'Namespace', render: (item) => item.namespace },
  { key: 'holder', header: 'Holder Identity', render: (item) => item.holder },
  { key: 'duration', header: 'Lease Duration', render: (item) => item.duration },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: Lease[] = [
  { id: '1', name: 'kube-scheduler', namespace: 'kube-system', holder: 'master-1_abc123', duration: '15s', age: '180d' },
  { id: '2', name: 'kube-controller-manager', namespace: 'kube-system', holder: 'master-1_def456', duration: '15s', age: '180d' },
  { id: '3', name: 'node-1', namespace: 'kube-node-lease', holder: 'node-1', duration: '40s', age: '180d' },
];

export default function Leases() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('leases');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const items: Lease[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        namespace: item.metadata.namespace || 'default',
        holder: item.spec?.holderIdentity || '-',
        duration: item.spec?.leaseDurationSeconds ? `${item.spec.leaseDurationSeconds}s` : '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  return (
    <>
      <ResourceList
        title="Leases"
        icon={Activity}
        items={items}
        columns={columns}
        searchPlaceholder="Search leases..."
        filterKey="namespace"
        filterLabel="Namespace"
        getRowLink={(row) => `/leases/${row.namespace}/${row.name}`}
        getItemKey={(row) => row.id}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Lease"
          defaultYaml={DEFAULT_YAMLS.Lease}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('Lease created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}