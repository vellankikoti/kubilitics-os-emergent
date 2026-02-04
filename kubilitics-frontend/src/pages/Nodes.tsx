import { useState } from 'react';
import { Server } from 'lucide-react';
import { ResourceList, type Column, DeleteConfirmDialog } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useK8sResourceList, useDeleteK8sResource, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { toast } from 'sonner';

interface NodeResource extends KubernetesResource {
  spec?: {
    unschedulable?: boolean;
  };
  status: {
    conditions?: Array<{ type: string; status: string }>;
    nodeInfo?: { kubeletVersion: string };
    allocatable?: { pods: string; cpu: string; memory: string };
    capacity?: { pods: string; cpu: string; memory: string };
  };
}

interface Node {
  name: string;
  status: string;
  roles: string[];
  version: string;
  cpuUsage: number;
  memoryUsage: number;
  pods: string;
  age: string;
  cpuCapacity: string;
  memoryCapacity: string;
  conditions: string[];
}

const mockNodes: Node[] = [
  { name: 'node-1', status: 'Ready', roles: ['control-plane', 'master'], version: 'v1.28.4', cpuUsage: 35, memoryUsage: 62, pods: '28/110', age: '180d', cpuCapacity: '8', memoryCapacity: '32Gi', conditions: ['Ready'] },
  { name: 'node-2', status: 'Ready', roles: ['worker'], version: 'v1.28.4', cpuUsage: 72, memoryUsage: 85, pods: '45/110', age: '180d', cpuCapacity: '8', memoryCapacity: '32Gi', conditions: ['Ready'] },
  { name: 'node-3', status: 'Ready', roles: ['worker'], version: 'v1.28.4', cpuUsage: 45, memoryUsage: 58, pods: '32/110', age: '90d', cpuCapacity: '8', memoryCapacity: '32Gi', conditions: ['Ready'] },
  { name: 'node-4', status: 'NotReady', roles: ['worker'], version: 'v1.28.4', cpuUsage: 0, memoryUsage: 0, pods: '0/110', age: '30d', cpuCapacity: '8', memoryCapacity: '32Gi', conditions: ['NotReady', 'MemoryPressure'] },
  { name: 'node-5', status: 'SchedulingDisabled', roles: ['worker'], version: 'v1.28.4', cpuUsage: 20, memoryUsage: 30, pods: '15/110', age: '60d', cpuCapacity: '4', memoryCapacity: '16Gi', conditions: ['Ready'] },
];

const statusColors: Record<string, string> = {
  Ready: 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]',
  NotReady: 'bg-[hsl(var(--error)/0.1)] text-[hsl(var(--error))]',
  SchedulingDisabled: 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]',
};

function transformNodeResource(resource: NodeResource): Node {
  const labels = resource.metadata.labels || {};
  const roles = Object.keys(labels)
    .filter(k => k.startsWith('node-role.kubernetes.io/'))
    .map(k => k.replace('node-role.kubernetes.io/', ''));
  
  if (roles.length === 0) roles.push('worker');
  
  const readyCondition = resource.status?.conditions?.find(c => c.type === 'Ready');
  const isReady = readyCondition?.status === 'True';
  const isSchedulable = !resource.spec?.unschedulable;
  
  let status = 'NotReady';
  if (isReady && isSchedulable) status = 'Ready';
  else if (isReady && !isSchedulable) status = 'SchedulingDisabled';
  
  const conditions = (resource.status?.conditions || [])
    .filter(c => c.status === 'True' || (c.type === 'Ready' && c.status === 'False'))
    .map(c => c.type);

  const pods = parseInt(resource.status?.allocatable?.pods || '0', 10);

  return {
    name: resource.metadata.name,
    status,
    roles,
    version: resource.status?.nodeInfo?.kubeletVersion || '-',
    cpuUsage: Math.floor(Math.random() * 60) + 20, // Mock - would need metrics API
    memoryUsage: Math.floor(Math.random() * 50) + 30, // Mock - would need metrics API
    pods: `${Math.floor(Math.random() * pods)}/${pods}`,
    age: calculateAge(resource.metadata.creationTimestamp),
    cpuCapacity: resource.status?.capacity?.cpu || '-',
    memoryCapacity: resource.status?.capacity?.memory || '-',
    conditions,
  };
}

const columns: Column<Node>[] = [
  { key: 'name', header: 'Name', render: (n) => <span className="font-medium">{n.name}</span> },
  { key: 'status', header: 'Status', render: (n) => <Badge className={statusColors[n.status] || statusColors.NotReady}>{n.status}</Badge> },
  { key: 'roles', header: 'Roles', render: (n) => (
    <div className="flex flex-wrap gap-1">
      {n.roles.map((role) => <Badge key={role} variant="outline" className="text-xs">{role}</Badge>)}
    </div>
  )},
  { key: 'conditions', header: 'Conditions', render: (n) => (
    <div className="flex flex-wrap gap-1">
      {n.conditions.slice(0, 2).map((cond) => (
        <Badge 
          key={cond} 
          variant={cond === 'Ready' ? 'default' : 'destructive'} 
          className="text-xs"
        >
          {cond}
        </Badge>
      ))}
      {n.conditions.length > 2 && (
        <Badge variant="outline" className="text-xs">+{n.conditions.length - 2}</Badge>
      )}
    </div>
  )},
  { key: 'cpu', header: 'CPU', render: (n) => (
    <div className="flex items-center gap-2 min-w-24">
      <Progress value={n.cpuUsage} className="h-1.5" />
      <span className="text-xs text-muted-foreground w-12">{n.cpuUsage}%</span>
    </div>
  )},
  { key: 'memory', header: 'Memory', render: (n) => (
    <div className="flex items-center gap-2 min-w-24">
      <Progress value={n.memoryUsage} className="h-1.5" />
      <span className="text-xs text-muted-foreground w-12">{n.memoryUsage}%</span>
    </div>
  )},
  { key: 'pods', header: 'Pods', render: (n) => <span className="font-mono text-sm">{n.pods}</span> },
  { key: 'version', header: 'Version', render: (n) => <Badge variant="secondary" className="font-mono text-xs">{n.version}</Badge> },
  { key: 'age', header: 'Age', render: (n) => <span className="text-muted-foreground">{n.age}</span> },
];

export default function Nodes() {
  const { config } = useKubernetesConfigStore();
  const { data, refetch } = useK8sResourceList<NodeResource>('nodes');
  const deleteResource = useDeleteK8sResource('nodes');
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: Node | null }>({ open: false, item: null });
  
  const nodes: Node[] = config.isConnected && data?.items
    ? data.items.map(transformNodeResource)
    : mockNodes;

  const handleDelete = async () => {
    if (!deleteDialog.item) return;
    if (config.isConnected) {
      await deleteResource.mutateAsync({
        name: deleteDialog.item.name,
      });
    } else {
      toast.success(`Node ${deleteDialog.item.name} deleted (demo mode)`);
    }
  };

  const handleCordon = (item: Node) => {
    const action = item.status === 'SchedulingDisabled' ? 'uncordoned' : 'cordoned';
    toast.success(`Node ${item.name} ${action} (demo mode)`);
  };

  const handleDrain = (item: Node) => {
    toast.success(`Node ${item.name} drain initiated (demo mode)`);
  };

  const handleAction = (action: string, item: Node) => {
    if (action === 'Delete') {
      setDeleteDialog({ open: true, item });
    } else if (action === 'Cordon' || action === 'Uncordon') {
      handleCordon(item);
    } else if (action === 'Drain') {
      handleDrain(item);
    }
  };

  return (
    <>
      <ResourceList
        title="Nodes"
        icon={Server}
        items={nodes}
        columns={columns}
        getRowLink={(n) => `/nodes/${n.name}`}
        getItemKey={(n) => n.name}
        filterKey="status"
        searchPlaceholder="Search nodes..."
        onRefresh={() => refetch()}
        actions={[
          { 
            label: 'Cordon', 
            onClick: (item) => handleAction('Cordon', item),
          },
          { 
            label: 'Uncordon', 
            onClick: (item) => handleAction('Uncordon', item),
          },
          { label: 'Drain', onClick: (item) => handleAction('Drain', item) },
          { label: 'Download YAML' },
          { label: 'Delete', destructive: true, onClick: (item) => handleAction('Delete', item) },
        ]}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, item: open ? deleteDialog.item : null })}
        resourceType="Node"
        resourceName={deleteDialog.item?.name || ''}
        onConfirm={handleDelete}
        requireNameConfirmation
      />
    </>
  );
}
