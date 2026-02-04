import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface RoleBinding {
  name: string;
  namespace: string;
  roleRef: string;
  subjects: number;
  age: string;
}

interface K8sRoleBinding extends KubernetesResource {
  roleRef?: { name?: string };
  subjects?: Array<unknown>;
}

const mockRoleBindings: RoleBinding[] = [
  { name: 'pod-reader-binding', namespace: 'production', roleRef: 'pod-reader', subjects: 2, age: '90d' },
  { name: 'secret-manager-binding', namespace: 'production', roleRef: 'secret-manager', subjects: 1, age: '60d' },
  { name: 'admin-binding', namespace: 'kube-system', roleRef: 'admin', subjects: 3, age: '365d' },
  { name: 'view-binding', namespace: 'default', roleRef: 'view', subjects: 5, age: '180d' },
];

const columns: Column<RoleBinding>[] = [
  { key: 'name', header: 'Name', render: (rb) => <span className="font-medium">{rb.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (rb) => <Badge variant="outline">{rb.namespace}</Badge> },
  { key: 'roleRef', header: 'Role', render: (rb) => <Badge variant="secondary" className="font-mono">{rb.roleRef}</Badge> },
  { key: 'subjects', header: 'Subjects', render: (rb) => <span className="font-mono">{rb.subjects}</span> },
  { key: 'age', header: 'Age', render: (rb) => <span className="text-muted-foreground">{rb.age}</span> },
];

export default function RoleBindings() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sRoleBinding>('rolebindings');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const rolebindings: RoleBinding[] = config.isConnected && data?.items
    ? data.items.map((rb) => ({
        name: rb.metadata.name,
        namespace: rb.metadata.namespace || 'default',
        roleRef: rb.roleRef?.name || '-',
        subjects: rb.subjects?.length || 0,
        age: calculateAge(rb.metadata.creationTimestamp),
      }))
    : mockRoleBindings;

  return (
    <>
      <ResourceList
        title="Role Bindings"
        icon={Link2}
        items={rolebindings}
        columns={columns}
        getRowLink={(rb) => `/rolebindings/${rb.namespace}/${rb.name}`}
        getItemKey={(rb) => `${rb.namespace}/${rb.name}`}
        filterKey="namespace"
        searchPlaceholder="Search role bindings..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="RoleBinding"
          defaultYaml={DEFAULT_YAMLS.RoleBinding}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('RoleBinding created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}
