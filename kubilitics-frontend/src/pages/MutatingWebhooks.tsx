import { useState } from 'react';
import { Webhook } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator } from '@/components/editor';
import { toast } from 'sonner';

interface MutatingWebhook {
  id: string;
  name: string;
  webhooks: string;
  failurePolicy: string;
  age: string;
}

const columns: Column<MutatingWebhook>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'webhooks', header: 'Webhooks', render: (item) => item.webhooks },
  { key: 'failurePolicy', header: 'Failure Policy', render: (item) => item.failurePolicy },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: MutatingWebhook[] = [
  { id: '1', name: 'cert-manager-webhook', webhooks: '1', failurePolicy: 'Fail', age: '90d' },
  { id: '2', name: 'istio-sidecar-injector', webhooks: '1', failurePolicy: 'Fail', age: '60d' },
];

const MutatingWebhookYaml = `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: ''
webhooks:
  - name: ''
    clientConfig:
      service:
        name: ''
        namespace: ''
        port: 443
    rules:
      - apiGroups: [""]
        apiVersions: ["v1"]
        operations: ["CREATE"]
        resources: ["pods"]
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail`;

export default function MutatingWebhooks() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('mutatingwebhookconfigurations');
  const [showCreator, setShowCreator] = useState(false);

  const items: MutatingWebhook[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        webhooks: String(item.webhooks?.length || 0),
        failurePolicy: item.webhooks?.[0]?.failurePolicy || '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('MutatingWebhookConfiguration created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="MutatingWebhookConfiguration"
        defaultYaml={MutatingWebhookYaml}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Mutating Admission Webhooks"
      icon={Webhook}
      items={items}
      columns={columns}
      searchPlaceholder="Search mutating webhooks..."
      getRowLink={(row) => `/mutatingwebhooks/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
