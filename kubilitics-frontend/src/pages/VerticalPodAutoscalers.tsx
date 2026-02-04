import { useState } from 'react';
import { Scale } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { Badge } from '@/components/ui/badge';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface VPA {
  name: string;
  namespace: string;
  reference: string;
  updateMode: string;
  cpuRecommendation: string;
  memoryRecommendation: string;
  age: string;
}

const mockVPAs: VPA[] = [
  { name: 'nginx-vpa', namespace: 'production', reference: 'Deployment/nginx', updateMode: 'Auto', cpuRecommendation: '100m-500m', memoryRecommendation: '128Mi-512Mi', age: '30d' },
  { name: 'api-vpa', namespace: 'production', reference: 'Deployment/api-server', updateMode: 'Off', cpuRecommendation: '200m-1000m', memoryRecommendation: '256Mi-1Gi', age: '15d' },
];

const columns: Column<VPA>[] = [
  { key: 'name', header: 'Name', render: (v) => <span className="font-medium">{v.name}</span> },
  { key: 'namespace', header: 'Namespace', render: (v) => <Badge variant="outline">{v.namespace}</Badge> },
  { key: 'reference', header: 'Reference', render: (v) => <span className="font-mono text-sm">{v.reference}</span> },
  { key: 'updateMode', header: 'Update Mode', render: (v) => <Badge variant={v.updateMode === 'Auto' ? 'default' : 'secondary'}>{v.updateMode}</Badge> },
  { key: 'cpu', header: 'CPU Rec.', render: (v) => <span className="font-mono text-sm">{v.cpuRecommendation}</span> },
  { key: 'memory', header: 'Memory Rec.', render: (v) => <span className="font-mono text-sm">{v.memoryRecommendation}</span> },
  { key: 'age', header: 'Age', render: (v) => <span className="text-muted-foreground">{v.age}</span> },
];

export default function VerticalPodAutoscalers() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('verticalpodautoscalers');
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const vpas: VPA[] = config.isConnected && data?.items
    ? data.items.map((item: any) => {
        const targetRef = item.spec?.targetRef;
        const rec = item.status?.recommendation?.containerRecommendations?.[0];
        return {
          name: item.metadata.name,
          namespace: item.metadata.namespace || 'default',
          reference: targetRef ? `${targetRef.kind}/${targetRef.name}` : '-',
          updateMode: item.spec?.updatePolicy?.updateMode || 'Auto',
          cpuRecommendation: rec ? `${rec.lowerBound?.cpu || '-'}-${rec.upperBound?.cpu || '-'}` : '-',
          memoryRecommendation: rec ? `${rec.lowerBound?.memory || '-'}-${rec.upperBound?.memory || '-'}` : '-',
          age: calculateAge(item.metadata.creationTimestamp),
        };
      })
    : mockVPAs;

  return (
    <>
      <ResourceList
        title="Vertical Pod Autoscalers"
        icon={Scale}
        items={vpas}
        columns={columns}
        getRowLink={(v) => `/verticalpodautoscalers/${v.namespace}/${v.name}`}
        getItemKey={(v) => `${v.namespace}/${v.name}`}
        filterKey="namespace"
        searchPlaceholder="Search VPAs..."
        isLoading={isLoading}
        onRefresh={() => refetch()}
        onCreate={() => setShowCreateWizard(true)}
      />

      {showCreateWizard && (
        <ResourceCreator
          resourceKind="VerticalPodAutoscaler"
          defaultYaml={DEFAULT_YAMLS.VerticalPodAutoscaler}
          onClose={() => setShowCreateWizard(false)}
          onApply={() => { toast.success('VerticalPodAutoscaler created successfully (demo mode)'); setShowCreateWizard(false); refetch(); }}
        />
      )}
    </>
  );
}