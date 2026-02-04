import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ResourceQuota {
  id: string;
  name: string;
  namespace: string;
  cpu: string;
  memory: string;
  pods: string;
  age: string;
}

const columns: Column<ResourceQuota>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'namespace', header: 'Namespace', render: (item) => item.namespace },
  { key: 'cpu', header: 'CPU', render: (item) => item.cpu },
  { key: 'memory', header: 'Memory', render: (item) => item.memory },
  { key: 'pods', header: 'Pods', render: (item) => item.pods },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: ResourceQuota[] = [
  { id: '1', name: 'prod-quota', namespace: 'production', cpu: '10/20', memory: '32Gi/64Gi', pods: '50/100', age: '90d' },
  { id: '2', name: 'dev-quota', namespace: 'development', cpu: '5/10', memory: '16Gi/32Gi', pods: '25/50', age: '60d' },
];

export default function ResourceQuotas() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('resourcequotas');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const items: ResourceQuota[] = config.isConnected && data?.items
    ? data.items.map((item: any) => {
        const used = item.status?.used || {};
        const hard = item.status?.hard || item.spec?.hard || {};
        return {
          id: item.metadata.uid,
          name: item.metadata.name,
          namespace: item.metadata.namespace || 'default',
          cpu: `${used['requests.cpu'] || used.cpu || '-'}/${hard['requests.cpu'] || hard.cpu || '-'}`,
          memory: `${used['requests.memory'] || used.memory || '-'}/${hard['requests.memory'] || hard.memory || '-'}`,
          pods: `${used.pods || '-'}/${hard.pods || '-'}`,
          age: calculateAge(item.metadata.creationTimestamp),
        };
      })
    : mockData;

  return (
    <>
      <ResourceList
        title="Resource Quotas"
        icon={Gauge}
        items={items}
        columns={columns}
        searchPlaceholder="Search resource quotas..."
        filterKey="namespace"
        filterLabel="Namespace"
        getRowLink={(row) => `/resourcequotas/${row.namespace}/${row.name}`}
        getItemKey={(row) => row.id}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="ResourceQuota"
          defaultYaml={DEFAULT_YAMLS.ResourceQuota}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('ResourceQuota created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}
