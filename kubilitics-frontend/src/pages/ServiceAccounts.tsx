import { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ServiceAccount {
  name: string;
  namespace: string;
  secrets: number;
  age: string;
}

interface K8sServiceAccount extends KubernetesResource {
  secrets?: Array<unknown>;
}

const mockServiceAccounts: ServiceAccount[] = [
  { name: 'default', namespace: 'default', secrets: 1, age: '365d' },
  { name: 'default', namespace: 'production', secrets: 1, age: '180d' },
  { name: 'nginx-sa', namespace: 'production', secrets: 2, age: '90d' },
  { name: 'admin-sa', namespace: 'kube-system', secrets: 3, age: '365d' },
  { name: 'prometheus', namespace: 'monitoring', secrets: 2, age: '60d' },
  { name: 'fluentd', namespace: 'logging', secrets: 1, age: '60d' },
];

const columns: Column<ServiceAccount>[] = [
  { key: 'name', header: 'Name', render: (sa) => <span className="font-medium">{sa.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (sa) => <Badge variant="outline">{sa.namespace}</Badge> },
  { key: 'secrets', header: 'Secrets', render: (sa) => <span className="font-mono">{sa.secrets}</span> },
  { key: 'age', header: 'Age', render: (sa) => <span className="text-muted-foreground">{sa.age}</span> },
];

export default function ServiceAccounts() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sServiceAccount>('serviceaccounts');
  const deleteResource = useDeleteK8sResource('serviceaccounts');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ServiceAccount | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const serviceaccounts: ServiceAccount[] = config.isConnected && data?.items
    ? data.items.map((sa) => ({
        name: sa.metadata.name,
        namespace: sa.metadata.namespace || 'default',
        secrets: sa.secrets?.length || 0,
        age: calculateAge(sa.metadata.creationTimestamp),
      }))
    : mockServiceAccounts;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
        namespace: deleteDialog.item.namespace,
      });
    } else {
      toast.success(`ServiceAccount ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleAction = (action: string, item: ServiceAccount) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    }
  };

  return (
    <>
      <ResourceList
        title="Service Accounts"
        icon={UserCircle}
        items={serviceaccounts}
        columns={columns}
        getRowLink={(sa) => `/serviceaccounts/${sa.namespace}/${sa.name}`}
        getItemKey={(sa) => `${sa.namespace}/${sa.name}`}
        filterKey="namespace"
        searchPlaceholder="Search service accounts..."
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
          resourceKind="ServiceAccount"
          defaultYaml={DEFAULT_YAMLS.ServiceAccount}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('ServiceAccount created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="ServiceAccount"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
      />
    </>
  );
}
