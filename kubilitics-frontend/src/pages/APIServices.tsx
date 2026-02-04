import { FileCode } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';

interface APIService {
  id: string;
  name: string;
  service: string;
  group: string;
  version: string;
  status: string;
  age: string;
}

const columns: Column<APIService>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'service', header: 'Service', render: (item) => item.service },
  { key: 'group', header: 'Group', render: (item) => item.group || '-' },
  { key: 'version', header: 'Version', render: (item) => item.version },
  { key: 'status', header: 'Status', render: (item) => (
    <Badge variant={item.status === 'Available' ? 'default' : 'destructive'}>{item.status}</Badge>
  )},
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: APIService[] = [
  { id: '1', name: 'v1.', service: 'Local', group: '', version: 'v1', status: 'Available', age: '180d' },
  { id: '2', name: 'v1.apps', service: 'Local', group: 'apps', version: 'v1', status: 'Available', age: '180d' },
  { id: '3', name: 'v1.batch', service: 'Local', group: 'batch', version: 'v1', status: 'Available', age: '180d' },
  { id: '4', name: 'v1.networking.k8s.io', service: 'Local', group: 'networking.k8s.io', version: 'v1', status: 'Available', age: '180d' },
];

export default function APIServices() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('apiservices');

  const items: APIService[] = config.isConnected && data?.items
    ? data.items.map((item: any) => {
        const condition = item.status?.conditions?.find((c: any) => c.type === 'Available');
        return {
          id: item.metadata.uid,
          name: item.metadata.name,
          service: item.spec?.service ? `${item.spec.service.namespace}/${item.spec.service.name}` : 'Local',
          group: item.spec?.group || '',
          version: item.spec?.version || '-',
          status: condition?.status === 'True' ? 'Available' : 'Unavailable',
          age: calculateAge(item.metadata.creationTimestamp),
        };
      })
    : mockData;

  return (
    <ResourceList
      title="API Services"
      icon={FileCode}
      items={items}
      columns={columns}
      searchPlaceholder="Search API services..."
      getRowLink={(row) => `/apiservices/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
    />
  );
}
