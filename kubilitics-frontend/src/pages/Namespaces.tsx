import { useState } from 'react';
import { Folder } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface NamespaceResource extends KubernetesResource {
  status: {
    phase: string;
  };
}

interface Namespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  age: string;
  pods: number;
  services: number;
  deployments: number;
  configmaps: number;
}

const mockNamespaces: Namespace[] = [
  { name: 'default', status: 'Active', labels: {}, age: '365d', pods: 5, services: 2, deployments: 2, configmaps: 3 },
  { name: 'production', status: 'Active', labels: { environment: 'production' }, age: '180d', pods: 45, services: 12, deployments: 8, configmaps: 24 },
  { name: 'staging', status: 'Active', labels: { environment: 'staging' }, age: '90d', pods: 28, services: 8, deployments: 5, configmaps: 15 },
  { name: 'kube-system', status: 'Active', labels: {}, age: '365d', pods: 15, services: 5, deployments: 4, configmaps: 12 },
  { name: 'logging', status: 'Active', labels: { purpose: 'observability' }, age: '60d', pods: 8, services: 3, deployments: 2, configmaps: 6 },
  { name: 'monitoring', status: 'Active', labels: { purpose: 'observability' }, age: '60d', pods: 12, services: 4, deployments: 3, configmaps: 8 },
  { name: 'old-project', status: 'Terminating', labels: { deprecated: 'true' }, age: '400d', pods: 0, services: 0, deployments: 0, configmaps: 2 },
];

const statusColors: Record<string, string> = {
  Active: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]',
  Terminating: 'bg-[hsl(var(--error)/0.1)] text-[hsl(var(--error))]',
};

function transformNamespaceResource(resource: NamespaceResource): Namespace {
  return {
    name: resource.metadata.name,
    status: resource.status?.phase || 'Active',
    labels: resource.metadata.labels || {},
    age: calculateAge(resource.metadata.creationTimestamp),
    pods: Math.floor(Math.random() * 50),
    services: Math.floor(Math.random() * 15),
    deployments: Math.floor(Math.random() * 10),
    configmaps: Math.floor(Math.random() * 20),
  };
}

const columns: Column<Namespace>[] = [
  { key: 'name', header: 'Name', render: (ns) => <span className="font-medium">{ns.name}</span> },
  { key: 'status', header: 'Status', render: (ns) => <Badge className={statusColors[ns.status] || statusColors.Active}>{ns.status}</Badge> },
  { key: 'pods', header: 'Pods', render: (ns) => <span className="font-mono">{ns.pods}</span> },
  { key: 'deployments', header: 'Deployments', render: (ns) => <span className="font-mono">{ns.deployments}</span> },
  { key: 'services', header: 'Services', render: (ns) => <span className="font-mono">{ns.services}</span> },
  { key: 'configmaps', header: 'ConfigMaps', render: (ns) => <span className="font-mono">{ns.configmaps}</span> },
  { key: 'labels', header: 'Labels', render: (ns) => (
    <div className="flex flex-wrap gap-1">
      {Object.entries(ns.labels).slice(0, 2).map(([k, v]) => (
        <Badge key={k} variant="secondary" className="text-xs font-mono">{k}={v}</Badge>
      ))}
      {Object.keys(ns.labels).length > 2 && (
        <Badge variant="outline" className="text-xs">+{Object.keys(ns.labels).length - 2}</Badge>
      )}
    </div>
  )},
  { key: 'age', header: 'Age', render: (ns) => <span className="text-muted-foreground">{ns.age}</span> },
];

export default function Namespaces() {
  const { config } = useKubernetesConfigStore();
  const { data, refetch } = useK8sResourceList<NamespaceResource>('namespaces');
  const deleteResource = useDeleteK8sResource('namespaces');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Namespace | null }>({ open: false, item: null });
  const [showCreator, setShowCreator] = useState(false);
  
  const namespaces: Namespace[] = config.isConnected && data?.items
    ? data.items.map(transformNamespaceResource)
    : mockNamespaces;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({ name: deleteDialog.item.name });
    } else {
      toast.success(`Namespace ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleAction = (action: string, item: Namespace) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    }
  };

  const handleCreate = (yaml: string) => {
    toast.success('Namespace created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="Namespace"
        defaultYaml={DEFAULT_YAMLS.Namespace}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <>
      <ResourceList
        title="Namespaces"
        icon={Folder}
        items={namespaces}
        columns={columns}
        getRowLink={(ns) => `/namespaces/${ns.name}`}
        getItemKey={(ns) => ns.name}
        filterKey="status"
        searchPlaceholder="Search namespaces..."
        onRefresh={() => refetch()}
        onCreate={() => setShowCreator(true)}
        actions={[
          { label: 'Download YAML' },
          { label: 'Delete', destructive: true, onClick: (item) => handleAction('Delete', item) },
        ]}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Namespace"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
