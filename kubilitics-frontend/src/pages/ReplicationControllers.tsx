import { useState } from 'react';
import { Layers, AlertTriangle } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { usePaginatedResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';

interface ReplicationController {
  id: string;
  name: string;
  namespace: string;
  desired: number;
  current: number;
  ready: number;
  age: string;
}

const columns: Column<ReplicationController>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'namespace', header: 'Namespace', render: (item) => item.namespace },
  { 
    key: 'desired', 
    header: 'Desired', 
    render: (item) => (
      <Badge variant="outline" className="font-mono">
        {item.desired}
      </Badge>
    )
  },
  { 
    key: 'current', 
    header: 'Current', 
    render: (item) => (
      <Badge variant="outline" className="font-mono">
        {item.current}
      </Badge>
    )
  },
  { 
    key: 'ready', 
    header: 'Ready', 
    render: (item) => {
      const isHealthy = item.ready === item.desired && item.desired > 0;
      const isPartial = item.ready > 0 && item.ready < item.desired;
      return (
        <Badge 
          variant={isHealthy ? 'default' : isPartial ? 'secondary' : 'destructive'}
          className="font-mono"
        >
          {item.ready}/{item.desired}
        </Badge>
      );
    }
  },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: ReplicationController[] = [
  { id: '1', name: 'legacy-app', namespace: 'legacy', desired: 3, current: 3, ready: 3, age: '365d' },
  { id: '2', name: 'old-service', namespace: 'production', desired: 2, current: 2, ready: 1, age: '180d' },
];

export default function ReplicationControllers() {
  const { isConnected } = useConnectionStatus();
  const { data, isLoading, refetch, pagination } = usePaginatedResourceList('replicationcontrollers');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const items: ReplicationController[] = isConnected && data
    ? (data?.items ?? []).map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        namespace: item.metadata.namespace || 'default',
        desired: item.spec?.replicas || 0,
        current: item.status?.replicas || 0,
        ready: item.status?.readyReplicas || 0,
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : [];

  return (
    <>
      {/* Deprecation Warning Banner */}
      <Alert variant="destructive" className="mb-4 border-warning/50 bg-warning/10">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertTitle className="text-warning">Deprecated Resource</AlertTitle>
        <AlertDescription className="text-warning/80">
          ReplicationControllers are deprecated. Consider migrating to Deployments or ReplicaSets for improved rolling update capabilities and declarative management.
        </AlertDescription>
      </Alert>

      <ResourceList
        title="Replication Controllers"
        icon={Layers}
        items={items}
        columns={columns}
        searchPlaceholder="Search replication controllers..."
        filterKey="namespace"
        filterLabel="Namespace"
        getRowLink={(row) => `/replicationcontrollers/${row.namespace}/${row.name}`}
        getItemKey={(row) => row.id}
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onCreate={() => setShowCreateWizard(true)}
        pagination={pagination}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="ReplicationController"
          defaultYaml={DEFAULT_YAMLS.ReplicationController}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('ReplicationController created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}
