import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface PriorityClass {
  id: string;
  name: string;
  value: string;
  globalDefault: string;
  preemptionPolicy: string;
  age: string;
}

const columns: Column<PriorityClass>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'value', header: 'Value', render: (item) => item.value },
  { key: 'globalDefault', header: 'Global Default', render: (item) => item.globalDefault },
  { key: 'preemptionPolicy', header: 'Preemption', render: (item) => item.preemptionPolicy },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: PriorityClass[] = [
  { id: '1', name: 'system-cluster-critical', value: '2000000000', globalDefault: 'No', preemptionPolicy: 'PreemptLowerPriority', age: '180d' },
  { id: '2', name: 'system-node-critical', value: '2000001000', globalDefault: 'No', preemptionPolicy: 'PreemptLowerPriority', age: '180d' },
  { id: '3', name: 'high-priority', value: '1000000', globalDefault: 'No', preemptionPolicy: 'PreemptLowerPriority', age: '90d' },
];

export default function PriorityClasses() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('priorityclasses');
  const [showCreator, setShowCreator] = useState(false);

  const items: PriorityClass[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        value: String(item.value || 0),
        globalDefault: item.globalDefault ? 'Yes' : 'No',
        preemptionPolicy: item.preemptionPolicy || 'PreemptLowerPriority',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('PriorityClass created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="PriorityClass"
        defaultYaml={DEFAULT_YAMLS.PriorityClass}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Priority Classes"
      icon={AlertTriangle}
      items={items}
      columns={columns}
      searchPlaceholder="Search priority classes..."
      getRowLink={(row) => `/priorityclasses/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
