import { useState } from 'react';
import { FileCode } from 'lucide-react';
import { ResourceList, type Column } from '@/components/resources';
import { useK8sResourceList, calculateAge } from '@/hooks/useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { ResourceCreator } from '@/components/editor';
import { toast } from 'sonner';

interface CRD {
  id: string;
  name: string;
  group: string;
  version: string;
  scope: string;
  age: string;
}

const columns: Column<CRD>[] = [
  { key: 'name', header: 'Name', render: (item) => item.name },
  { key: 'group', header: 'Group', render: (item) => item.group },
  { key: 'version', header: 'Version', render: (item) => item.version },
  { key: 'scope', header: 'Scope', render: (item) => item.scope },
  { key: 'age', header: 'Age', render: (item) => item.age },
];

const mockData: CRD[] = [
  { id: '1', name: 'certificates.cert-manager.io', group: 'cert-manager.io', version: 'v1', scope: 'Namespaced', age: '90d' },
  { id: '2', name: 'ingressroutes.traefik.io', group: 'traefik.io', version: 'v1alpha1', scope: 'Namespaced', age: '60d' },
  { id: '3', name: 'prometheusrules.monitoring.coreos.com', group: 'monitoring.coreos.com', version: 'v1', scope: 'Namespaced', age: '30d' },
];

const CRDYaml = `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: ''
spec:
  group: ''
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
  scope: Namespaced
  names:
    plural: ''
    singular: ''
    kind: ''
    shortNames: []`;

export default function CustomResourceDefinitions() {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading, refetch } = useK8sResourceList('customresourcedefinitions');
  const [showCreator, setShowCreator] = useState(false);

  const items: CRD[] = config.isConnected && data?.items
    ? data.items.map((item: any) => {
        const storedVersion = item.spec?.versions?.find((v: any) => v.storage) || item.spec?.versions?.[0];
        return {
          id: item.metadata.uid,
          name: item.metadata.name,
          group: item.spec?.group || '-',
          version: storedVersion?.name || item.spec?.version || '-',
          scope: item.spec?.scope || 'Namespaced',
          age: calculateAge(item.metadata.creationTimestamp),
        };
      })
    : mockData;

  const handleCreate = (yaml: string) => {
    toast.success('CustomResourceDefinition created (demo mode)');
    setShowCreator(false);
    refetch();
  };

  if (showCreator) {
    return (
      <ResourceCreator
        resourceKind="CustomResourceDefinition"
        defaultYaml={CRDYaml}
        onClose={() => setShowCreator(false)}
        onApply={handleCreate}
      />
    );
  }

  return (
    <ResourceList
      title="Custom Resource Definitions"
      icon={FileCode}
      items={items}
      columns={columns}
      searchPlaceholder="Search CRDs..."
      filterKey="scope"
      filterLabel="Scope"
      getRowLink={(row) => `/customresourcedefinitions/${row.name}`}
      getItemKey={(row) => row.id}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      onCreate={() => setShowCreator(true)}
    />
  );
}
