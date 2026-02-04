import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface PDB {
  name: string;
  namespace: string;
  minAvailable: string;
  maxUnavailable: string;
  currentHealthy: number;
  desiredHealthy: number;
  disruptionsAllowed: number;
  age: string;
}

interface K8sPDB extends KubernetesResource {
  spec?: {
    minAvailable?: number | string;
    maxUnavailable?: number | string;
  };
  status?: {
    currentHealthy?: number;
    desiredHealthy?: number;
    disruptionsAllowed?: number;
  };
}

const mockPDBs: PDB[] = [
  { name: 'nginx-pdb', namespace: 'production', minAvailable: '2', maxUnavailable: '-', currentHealthy: 3, desiredHealthy: 2, disruptionsAllowed: 1, age: '30d' },
  { name: 'api-pdb', namespace: 'production', minAvailable: '-', maxUnavailable: '1', currentHealthy: 5, desiredHealthy: 4, disruptionsAllowed: 1, age: '15d' },
  { name: 'redis-pdb', namespace: 'staging', minAvailable: '1', maxUnavailable: '-', currentHealthy: 3, desiredHealthy: 1, disruptionsAllowed: 2, age: '7d' },
];

const columns: Column<PDB>[] = [
  { key: 'name', header: 'Name', render: (p) => <span className="font-medium">{p.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (p) => <Badge variant="outline">{p.namespace}</Badge> },
  { key: 'minAvailable', header: 'Min Available', render: (p) => <span className="font-mono">{p.minAvailable}</span> },
  { key: 'maxUnavailable', header: 'Max Unavailable', render: (p) => <span className="font-mono">{p.maxUnavailable}</span> },
  { key: 'healthy', header: 'Healthy', render: (p) => <span className="font-mono">{p.currentHealthy}/{p.desiredHealthy}</span> },
  { key: 'allowed', header: 'Disruptions', render: (p) => <Badge variant={p.disruptionsAllowed > 0 ? 'default' : 'destructive'}>{p.disruptionsAllowed}</Badge> },
  { key: 'age', header: 'Age', render: (p) => <span className="text-muted-foreground">{p.age}</span> },
];

export default function PodDisruptionBudgets() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sPDB>('poddisruptionbudgets');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const pdbs: PDB[] = config.isConnected && data?.items
    ? data.items.map((p) => ({
        name: p.metadata.name,
        namespace: p.metadata.namespace || 'default',
        minAvailable: p.spec?.minAvailable?.toString() || '-',
        maxUnavailable: p.spec?.maxUnavailable?.toString() || '-',
        currentHealthy: p.status?.currentHealthy || 0,
        desiredHealthy: p.status?.desiredHealthy || 0,
        disruptionsAllowed: p.status?.disruptionsAllowed || 0,
        age: calculateAge(p.metadata.creationTimestamp),
      }))
    : mockPDBs;

  return (
    <>
      <ResourceList
        title="Pod Disruption Budgets"
        icon={Shield}
        items={pdbs}
        columns={columns}
        getRowLink={(p) => `/poddisruptionbudgets/${p.namespace}/${p.name}`}
        getItemKey={(p) => `${p.namespace}/${p.name}`}
        filterKey="namespace"
        searchPlaceholder="Search PDBs..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="PodDisruptionBudget"
          defaultYaml={DEFAULT_YAMLS.PodDisruptionBudget}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('PodDisruptionBudget created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}