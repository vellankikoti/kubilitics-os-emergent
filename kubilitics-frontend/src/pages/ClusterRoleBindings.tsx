import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ClusterRoleBinding {
  name: string;
  roleRef: string;
  subjects: number;
  age: string;
}

interface K8sClusterRoleBinding extends KubernetesResource {
  roleRef?: { name?: string };
  subjects?: Array<unknown>;
}

const mockClusterRoleBindings: ClusterRoleBinding[] = [
  { name: 'cluster-admin-binding', roleRef: 'cluster-admin', subjects: 1, age: '365d' },
  { name: 'system:node', roleRef: 'system:node', subjects: 4, age: '365d' },
  { name: 'prometheus-operator', roleRef: 'prometheus-operator', subjects: 1, age: '60d' },
  { name: 'view-binding', roleRef: 'view', subjects: 10, age: '180d' },
];

const columns: Column<ClusterRoleBinding>[] = [
  { key: 'name', header: 'Name', render: (crb) => <span className="font-medium">{crb.name}</span> },
  { key: 'roleRef', header: 'Cluster Role', render: (crb) => <Badge variant="secondary" className="font-mono">{crb.roleRef}</Badge> },
  { key: 'subjects', header: 'Subjects', render: (crb) => <span className="font-mono">{crb.subjects}</span> },
  { key: 'age', header: 'Age', render: (crb) => <span className="text-muted-foreground">{crb.age}</span> },
];

export default function ClusterRoleBindings() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sClusterRoleBinding>('clusterrolebindings');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const clusterrolebindings: ClusterRoleBinding[] = config.isConnected && data?.items
    ? data.items.map((crb) => ({
        name: crb.metadata.name,
        roleRef: crb.roleRef?.name || '-',
        subjects: crb.subjects?.length || 0,
        age: calculateAge(crb.metadata.creationTimestamp),
      }))
    : mockClusterRoleBindings;

  return (
    <>
      <ResourceList
        title="Cluster Role Bindings"
        icon={Link2}
        items={clusterrolebindings}
        columns={columns}
        getRowLink={(crb) => `/clusterrolebindings/${crb.name}`}
        getItemKey={(crb) => crb.name}
        searchPlaceholder="Search cluster role bindings..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="ClusterRoleBinding"
          defaultYaml={DEFAULT_YAMLS.ClusterRoleBinding}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('ClusterRoleBinding created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}