import { useState } from 'react';
import { Shield } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator } from '@/components/editor';
import { toast } from 'sonner';

interface PodSecurityPolicy {
  id: string;
  name: string;
  privileged: string;
  volumes: string;
  age: string;
}

const columns: Column<PodSecurityPolicy>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'privileged', header: 'Privileged', render: (item) => item.privileged },
  { key: 'volumes', header: 'Volumes', render: (item) => item.volumes },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: PodSecurityPolicy[] = [
  { id: '1', name: 'privileged', privileged: 'true', volumes: '*', age: '180d' },
  { id: '2', name: 'restricted', privileged: 'false', volumes: 'configMap, secret, emptyDir', age: '180d' },
];

const PSPYaml = `apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: ''
spec:
  privileged: false
  seLinux:
    rule: RunAsAny
  runAsUser:
    rule: MustRunAsNonRoot
  fsGroup:
    rule: RunAsAny
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'secret'`;

export default function PodSecurityPolicies() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('podsecuritypolicies');
  const [showCreator, setShowCreator] = useState(false);

  const items: PodSecurityPolicy[] = config.isConnected && data?.items
    ? data.items.map((item: any) => ({
        id: item.metadata.uid,
        name: item.metadata.name,
        privileged: String(item.spec?.privileged || false),
        volumes: item.spec?.volumes?.join(', ') || '-',
        age: calculateAge(item.metadata.creationTimestamp),
      }))
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('PodSecurityPolicy created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="PodSecurityPolicy"
        defaultYaml={PSPYaml}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Pod Security Policies"
      icon={Shield}
      items={items}
      columns={columns}
      searchPlaceholder="Search pod security policies..."
      getRowLink={(row) => `/podsecuritypolicies/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
