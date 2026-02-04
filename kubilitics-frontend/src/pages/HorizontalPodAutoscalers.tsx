import { useState } from 'react';
import { Scale } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge, type KubernetesResource } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface HPA {
  name: string;
  namespace: string;
  reference: string;
  minReplicas: number;
  maxReplicas: number;
  currentReplicas: number;
  cpuTarget: string;
  cpuCurrent: string;
  age: string;
}

interface K8sHPA extends KubernetesResource {
  spec?: {
    scaleTargetRef?: { kind?: string; name?: string };
    minReplicas?: number;
    maxReplicas?: number;
    metrics?: Array<{ resource?: { target?: { averageUtilization?: number } } }>;
  };
  status?: {
    currentReplicas?: number;
    currentMetrics?: Array<{ resource?: { current?: { averageUtilization?: number } } }>;
  };
}

const mockHPAs: HPA[] = [
  { name: 'nginx-hpa', namespace: 'production', reference: 'Deployment/nginx', minReplicas: 2, maxReplicas: 10, currentReplicas: 3, cpuTarget: '70%', cpuCurrent: '45%', age: '30d' },
  { name: 'api-hpa', namespace: 'production', reference: 'Deployment/api-server', minReplicas: 3, maxReplicas: 20, currentReplicas: 5, cpuTarget: '80%', cpuCurrent: '62%', age: '15d' },
  { name: 'worker-hpa', namespace: 'staging', reference: 'Deployment/worker', minReplicas: 1, maxReplicas: 5, currentReplicas: 2, cpuTarget: '60%', cpuCurrent: '55%', age: '7d' },
];

const columns: Column<HPA>[] = [
  { key: 'name', header: 'Name', render: (h) => <span className="font-medium">{h.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (h) => <Badge variant="outline">{h.namespace}</Badge> },
  { key: 'reference', header: 'Reference', render: (h) => <span className="font-mono text-sm">{h.reference}</span> },
  { key: 'replicas', header: 'Replicas', render: (h) => <span className="font-mono">{h.currentReplicas}/{h.minReplicas}-{h.maxReplicas}</span> },
  { key: 'cpu', header: 'CPU', render: (h) => <span className="font-mono">{h.cpuCurrent}/{h.cpuTarget}</span> },
  { key: 'age', header: 'Age', render: (h) => <span className="text-muted-foreground">{h.age}</span> },
];

export default function HorizontalPodAutoscalers() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList<K8sHPA>('horizontalpodautoscalers');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const hpas: HPA[] = config.isConnected && data?.items
    ? data.items.map((h) => {
        const targetRef = h.spec?.scaleTargetRef;
        const cpuMetric = h.spec?.metrics?.find(m => m.resource)?.resource?.target?.averageUtilization;
        const currentCpu = h.status?.currentMetrics?.find(m => m.resource)?.resource?.current?.averageUtilization;
        return {
          name: h.metadata.name,
          namespace: h.metadata.namespace || 'default',
          reference: targetRef ? `${targetRef.kind}/${targetRef.name}` : '-',
          minReplicas: h.spec?.minReplicas || 1,
          maxReplicas: h.spec?.maxReplicas || 1,
          currentReplicas: h.status?.currentReplicas || 0,
          cpuTarget: cpuMetric ? `${cpuMetric}%` : '-',
          cpuCurrent: currentCpu ? `${currentCpu}%` : '-',
          age: calculateAge(h.metadata.creationTimestamp),
        };
      })
    : mockHPAs;

  return (
    <>
      <ResourceList
        title="Horizontal Pod Autoscalers"
        icon={Scale}
        items={hpas}
        columns={columns}
        getRowLink={(h) => `/horizontalpodautoscalers/${h.namespace}/${h.name}`}
        getItemKey={(h) => `${h.namespace}/${h.name}`}
        filterKey="namespace"
        searchPlaceholder="Search HPAs..."
        isLoading={isLoading}
        onRefresh={refetch}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="HorizontalPodAutoscaler"
          defaultYaml={DEFAULT_YAMLS.HorizontalPodAutoscaler}
          onClose={() => { setShowCreateWizard(false); }}
          onApply={(yaml) => { toast.success('HPA created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}
