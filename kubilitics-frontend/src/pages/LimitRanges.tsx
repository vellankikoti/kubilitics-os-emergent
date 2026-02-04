import { useState } from 'react';
import { Scale } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface LimitRange {
  id: string;
  name: string;
  namespace: string;
  defaultCpu: string;
  defaultMemory: string;
  age: string;
}

const columns: Column<LimitRange>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'namespace', header: 'Namespace', render: (item) => item.namespace },
  { key: 'defaultCpu', header: 'Default CPU', render: (item) => item.defaultCpu },
  { key: 'defaultMemory', header: 'Default Memory', render: (item) => item.defaultMemory },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: LimitRange[] = [
  { id: '1', name: 'prod-limits', namespace: 'production', defaultCpu: '100m', defaultMemory: '128Mi', age: '90d' },
  { id: '2', name: 'dev-limits', namespace: 'development', defaultCpu: '50m', defaultMemory: '64Mi', age: '60d' },
];

export default function LimitRanges() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('limitranges');
  const [showCreator, setShowCreator] = useState(false);

  const items: LimitRange[] = config.isConnected && data?.items
    ? data.items.map((item: any) => {
        const containerLimit = item.spec?.limits?.find((l: any) => l.type === 'Container');
        return {
          id: item.metadata.uid,
          name: item.metadata.name,
          namespace: item.metadata.namespace || 'default',
          defaultCpu: containerLimit?.default?.cpu || containerLimit?.defaultRequest?.cpu || '-',
          defaultMemory: containerLimit?.default?.memory || containerLimit?.defaultRequest?.memory || '-',
          age: calculateAge(item.metadata.creationTimestamp),
        };
      })
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('LimitRange created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="LimitRange"
        defaultYaml={DEFAULT_YAMLS.LimitRange}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Limit Ranges"
      icon={Scale}
      items={items}
      columns={columns}
      searchPlaceholder="Search limit ranges..."
      filterKey="namespace"
      filterLabel="Namespace"
      getRowLink={(row) => `/limitranges/${row.namespace}/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
