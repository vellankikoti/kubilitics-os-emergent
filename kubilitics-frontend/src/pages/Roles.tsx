import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface Role {
  name: string;
  namespace: string;
  rules: number;
  age: string;
}

interface K8sRole extends KubernetesResource {
  rules?: Array<unknown>;
}

const mockRoles: Role[] = [
  { name: 'pod-reader', namespace: 'production', rules: 2, age: '90d' },
  { name: 'secret-manager', namespace: 'production', rules: 4, age: '60d' },
  { name: 'deployment-admin', namespace: 'production', rules: 6, age: '30d' },
  { name: 'configmap-editor', namespace: 'staging', rules: 3, age: '45d' },
  { name: 'service-manager', namespace: 'default', rules: 5, age: '120d' },
];

const columns: Column<Role>[] = [
  { key: 'name', header: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (r) => <Badge variant="outline">{r.namespace}</Badge> },
  { key: 'rules', header: 'Rules', render: (r) => <span className="font-mono">{r.rules}</span> },
  { key: 'age', header: 'Age', render: (r) => <span className="text-muted-foreground">{r.age}</span> },
];

export default function Roles() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sRole>('roles');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const roles: Role[] = config.isConnected && data?.items
    ? data.items.map((r) => ({
        name: r.metadata.name,
        namespace: r.metadata.namespace || 'default',
        rules: r.rules?.length || 0,
        age: calculateAge(r.metadata.creationTimestamp),
      }))
    : mockRoles;

  return (
    <>
      <ResourceList
        title="Roles"
        icon={Shield}
        items={roles}
        columns={columns}
        getRowLink={(r) => `/roles/${r.namespace}/${r.name}`}
        getItemKey={(r) => `${r.namespace}/${r.name}`}
        filterKey="namespace"
        searchPlaceholder="Search roles..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Role"
          defaultYaml={DEFAULT_YAMLS.Role}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('Role created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}
