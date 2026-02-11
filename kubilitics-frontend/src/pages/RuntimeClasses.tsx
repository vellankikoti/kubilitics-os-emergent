import { useState } from 'react';
import { FolderCog } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { usePaginatedResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator } from '@/components/editor';
import { toast } from 'sonner';

interface RuntimeClass {
  id: string;
  name: string;
  handler: string;
  age: string;
}

const columns: Column<RuntimeClass>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'handler', header: 'Handler', render: (item) => item.handler },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: RuntimeClass[] = [
  { id: '1', name: 'gvisor', handler: 'runsc', age: '180d' },
];

const RuntimeClassYaml = `apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: ''
handler: ''`;

export default function RuntimeClasses() {
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch, pagination } = usePaginatedResourceList('runtimeclasses');
  const [showCreator, setShowCreator] = useState(false);

  const items: RuntimeClass[] = isConnected && data
    ? (data?.items ?? []).map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        handler: item.handler || '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : [];

  const handleCreate = (yaml: string) => {
    toast.success('RuntimeClass created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="RuntimeClass"
        defaultYaml={RuntimeClassYaml}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Runtime Classes"
      icon={FolderCog}
      items={items}
      columns={columns}
      searchPlaceholder="Search runtime classes..."
      getRowLink={(row) => `/runtimeclasses/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
      pagination={pagination}
    />
  );
}
