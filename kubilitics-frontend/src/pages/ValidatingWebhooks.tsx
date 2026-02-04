import { useState } from 'react';
import { Webhook } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator, DEFAULT_YAMLS } from '@/components/editor';
import { toast } from 'sonner';

interface ValidatingWebhook {
  id: string;
  name: string;
  webhooks: string;
  failurePolicy: string;
  age: string;
}

const columns: Column<ValidatingWebhook>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'webhooks', header: 'Webhooks', render: (item) => item.webhooks },
  { key: 'failurePolicy', header: 'Failure Policy', render: (item) => item.failurePolicy },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: ValidatingWebhook[] = [
  { id: '1', name: 'cert-manager-webhook', webhooks: '2', failurePolicy: 'Fail', age: '90d' },
  { id: '2', name: 'gatekeeper-validating-webhook', webhooks: '1', failurePolicy: 'Ignore', age: '60d' },
  { id: '3', name: 'pod-policy', webhooks: '1', failurePolicy: 'Fail', age: '30d' },
];

const ValidatingWebhookYaml = `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
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
        operations: ["CREATE", "UPDATE"]
        resources: ["pods"]
    admissionReviewVersions: ["v1"]
    sideEffects: None
    failurePolicy: Fail`;

export default function ValidatingWebhooks() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('validatingwebhookconfigurations');
  const [showCreator, setShowCreator] = useState(false);

  const items: ValidatingWebhook[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        webhooks: String(item.webhooks?.length || 0),
        failurePolicy: item.webhooks?.[0]?.failurePolicy || '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('ValidatingWebhookConfiguration created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="ValidatingWebhookConfiguration"
        defaultYaml={ValidatingWebhookYaml}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Validating Admission Webhooks"
      icon={Webhook}
      items={items}
      columns={columns}
      searchPlaceholder="Search validating webhooks..."
      getRowLink={(row) => `/validatingwebhooks/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
