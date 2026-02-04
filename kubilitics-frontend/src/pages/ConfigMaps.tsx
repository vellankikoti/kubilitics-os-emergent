import { useState } from 'react';
import { FileJson, Plus } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ConfigMap {
  name: string;
  namespace: string;
  dataKeys: number;
  age: string;
}

interface K8sConfigMap extends KubernetesResource {
  data?: Record<string, string>;
}

const mockConfigMaps: ConfigMap[] = [
  { name: 'nginx-config', namespace: 'production', dataKeys: 3, age: '30d' },
  { name: 'app-settings', namespace: 'production', dataKeys: 5, age: '15d' },
  { name: 'redis-config', namespace: 'staging', dataKeys: 2, age: '7d' },
  { name: 'db-config', namespace: 'production', dataKeys: 4, age: '45d' },
  { name: 'feature-flags', namespace: 'default', dataKeys: 8, age: '3d' },
];

const columns: Column<ConfigMap>[] = [
  { key: 'name', header: 'Name', render: (cm) => <span className="font-medium">{cm.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (cm) => <Badge variant="outline">{cm.namespace}</Badge> },
  { key: 'dataKeys', header: 'Data Keys', render: (cm) => <span className="font-mono">{cm.dataKeys}</span> },
  { key: 'age', header: 'Age', render: (cm) => <span className="text-muted-foreground">{cm.age}</span> },
];

export default function ConfigMaps() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sConfigMap>('configmaps');
  const deleteResource = useDeleteK8sResource('configmaps');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: ConfigMap | null }>({ open: false, item: null });
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const configMaps: ConfigMap[] = config.isConnected && data?.items
    ? data.items.map((cm) => ({
        name: cm.metadata.name,
        namespace: cm.metadata.namespace || 'default',
        dataKeys: cm.data ? Object.keys(cm.data).length : 0,
        age: calculateAge(cm.metadata.creationTimestamp),
      }))
    : mockConfigMaps;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
        namespace: deleteDialog.item.namespace,
      });
    } else {
      toast.success(`ConfigMap ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleAction = (action: string, item: ConfigMap) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    }
  };

  return (
    <>
      <ResourceList
        title="ConfigMaps"
        icon={FileJson}
        items={configMaps}
        columns={columns}
        getRowLink={(cm) => `/configmaps/${cm.namespace}/${cm.name}`}
        getItemKey={(cm) => `${cm.namespace}/${cm.name}`}
        filterKey="namespace"
        searchPlaceholder="Search configmaps..."
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
          resourceKind="ConfigMap"
          defaultYaml={DEFAULT_YAMLS.ConfigMap}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('ConfigMap created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="ConfigMap"
        resourceName={deleteDialog.item?.name || ''}
        namespace={deleteDialog.item?.namespace}
        onConfirm={handleDelete}
      />
    </>
  );
}
