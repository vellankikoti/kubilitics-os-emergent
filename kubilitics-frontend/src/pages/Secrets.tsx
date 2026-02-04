import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface Secret {
  name: string;
  namespace: string;
  type: string;
  dataKeys: number;
  age: string;
}

interface K8sSecret extends KubernetesResource {
  type?: string;
  data?: Record<string, string>;
}

const mockSecrets: Secret[] = [
  { name: 'db-credentials', namespace: 'production', type: 'Opaque', dataKeys: 2, age: '30d' },
  { name: 'tls-secret', namespace: 'production', type: 'kubernetes.io/tls', dataKeys: 2, age: '90d' },
  { name: 'docker-registry', namespace: 'default', type: 'kubernetes.io/dockerconfigjson', dataKeys: 1, age: '60d' },
  { name: 'api-keys', namespace: 'staging', type: 'Opaque', dataKeys: 3, age: '15d' },
  { name: 'service-account-token', namespace: 'kube-system', type: 'kubernetes.io/service-account-token', dataKeys: 3, age: '120d' },
];

const columns: Column<Secret>[] = [
  { key: 'name', header: 'Name', render: (s) => <span className="font-medium">{s.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (s) => <Badge variant="outline">{s.namespace}</Badge> },
  { key: 'type', header: 'Type', render: (s) => <Badge variant="secondary" className="font-mono text-xs">{s.type}</Badge> },
  { key: 'dataKeys', header: 'Data Keys', render: (s) => <span className="font-mono">{s.dataKeys}</span> },
  { key: 'age', header: 'Age', render: (s) => <span className="text-muted-foreground">{s.age}</span> },
];

export default function Secrets() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sSecret>('secrets');
  const deleteResource = useDeleteK8sResource('secrets');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Secret | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const secrets: Secret[] = config.isConnected && data?.items
    ? data.items.map((s) => ({
        name: s.metadata.name,
        namespace: s.metadata.namespace || 'default',
        type: s.type || 'Opaque',
        dataKeys: s.data ? Object.keys(s.data).length : 0,
        age: calculateAge(s.metadata.creationTimestamp),
      }))
    : mockSecrets;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
        namespace: deleteDialog.item.namespace,
      });
    } else {
      toast.success(`Secret ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleAction = (action: string, item: Secret) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    }
  };

  return (
    <>
      <ResourceList
        title="Secrets"
        icon={KeyRound}
        items={secrets}
        columns={columns}
        getRowLink={(s) => `/secrets/${s.namespace}/${s.name}`}
        getItemKey={(s) => `${s.namespace}/${s.name}`}
        filterKey="namespace"
        searchPlaceholder="Search secrets..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
        actions={[
          { label: 'Download YAML' },
          { label: 'Delete', destructive: true, onClick: (item) => handleAction('Delete', item) },
        ]}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="Secret"
          defaultYaml={DEFAULT_YAMLS.Secret}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('Secret created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Secret"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
