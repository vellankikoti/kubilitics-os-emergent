import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ClusterRole {
  name: string;
  rules: number;
  isAggregated: boolean;
  age: string;
}

interface K8sClusterRole extends KubernetesResource {
  rules?: Array<unknown>;
  aggregationRule?: unknown;
}

const mockClusterRoles: ClusterRole[] = [
  { name: 'cluster-admin', rules: 1, isAggregated: false, age: '365d' },
  { name: 'admin', rules: 15, isAggregated: true, age: '365d' },
  { name: 'edit', rules: 12, isAggregated: true, age: '365d' },
  { name: 'view', rules: 8, isAggregated: true, age: '365d' },
  { name: 'system:node', rules: 25, isAggregated: false, age: '365d' },
  { name: 'prometheus-operator', rules: 18, isAggregated: false, age: '60d' },
];

const columns: Column<ClusterRole>[] = [
  { key: 'name', header: 'Name', render: (cr) => <span className="font-medium">{cr.name}</span> },
  { key: 'rules', header: 'Rules', render: (cr) => <span className="font-mono">{cr.rules}</span> },
  { key: 'isAggregated', header: 'Aggregated', render: (cr) => <Badge variant={cr.isAggregated ? 'default' : 'secondary'}>{cr.isAggregated ? 'Yes' : 'No'}</Badge> },
  { key: 'age', header: 'Age', render: (cr) => <span className="text-muted-foreground">{cr.age}</span> },
];

export default function ClusterRoles() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sClusterRole>('clusterroles');
  const [showCreator, setShowCreator] = useState(false);

  const clusterroles: ClusterRole[] = config.isConnected && data?.items
    ? data.items.map((cr) => ({
        name: cr.metadata.name,
        rules: cr.rules?.length || 0,
        isAggregated: !!cr.aggregationRule,
        age: calculateAge(cr.metadata.creationTimestamp),
      }))
    : mockClusterRoles;

  const handleCreate = (yaml: string) => {
    toast.success('ClusterRole created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ClusterRole"
        defaultYaml={DEFAULT_YAMLS.ClusterRole}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Cluster Roles"
      icon={ShieldCheck}
      items={clusterroles}
      columns={columns}
      getRowLink={(cr) => `/clusterroles/${cr.name}`}
      getItemKey={(cr) => cr.name}
      searchPlaceholder="Search cluster roles..."
      isLoading={isLoading}
      onRefresh={refetch}
      onCreate={() => setShowCreator(true)}
    />
  );
}
