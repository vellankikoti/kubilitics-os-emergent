import { useK8sResourceList, type KubernetesResource } from './useKubernetes';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { useMemo } from 'react';

// Mock counts for demo mode
const mockCounts: Record<string, number> = {
  pods: 54,
  deployments: 18,
  replicasets: 22,
  statefulsets: 2,
  daemonsets: 3,
  jobs: 1614,
  cronjobs: 8,
  services: 15,
  ingresses: 5,
  ingressclasses: 2,
  endpoints: 15,
  endpointslices: 15,
  networkpolicies: 7,
  configmaps: 34,
  secrets: 3,
  persistentvolumes: 3,
  persistentvolumeclaims: 4,
  storageclasses: 2,
  volumeattachments: 3,
  nodes: 3,
  namespaces: 22,
  apiservices: 27,
  leases: 7,
  serviceaccounts: 63,
  roles: 14,
  clusterroles: 70,
  rolebindings: 14,
  clusterrolebindings: 56,
  priorityclasses: 2,
  resourcequotas: 2,
  limitranges: 2,
  horizontalpodautoscalers: 4,
  verticalpodautoscalers: 10,
  poddisruptionbudgets: 2,
  customresourcedefinitions: 7,
  mutatingwebhookconfigurations: 5,
  validatingwebhookconfigurations: 2,
};

export interface ResourceCounts {
  pods: number;
  deployments: number;
  replicasets: number;
  statefulsets: number;
  daemonsets: number;
  jobs: number;
  cronjobs: number;
  services: number;
  ingresses: number;
  ingressclasses: number;
  endpoints: number;
  endpointslices: number;
  networkpolicies: number;
  configmaps: number;
  secrets: number;
  persistentvolumes: number;
  persistentvolumeclaims: number;
  storageclasses: number;
  volumeattachments: number;
  nodes: number;
  namespaces: number;
  apiservices: number;
  leases: number;
  serviceaccounts: number;
  roles: number;
  clusterroles: number;
  rolebindings: number;
  clusterrolebindings: number;
  priorityclasses: number;
  resourcequotas: number;
  limitranges: number;
  horizontalpodautoscalers: number;
  verticalpodautoscalers: number;
  poddisruptionbudgets: number;
  customresourcedefinitions: number;
  mutatingwebhookconfigurations: number;
  validatingwebhookconfigurations: number;
}

// Individual resource count hooks
function useResourceCount(resourceType: keyof ResourceCounts) {
  const { config } = useKubernetesConfigStore();
  const { data, isLoading } = useK8sResourceList<KubernetesResource>(
    resourceType as any,
    undefined,
    { 
      enabled: config.isConnected,
      refetchInterval: 60000 // Refresh every minute
    }
  );

  return {
    count: config.isConnected ? (data?.items?.length ?? 0) : (mockCounts[resourceType] ?? 0),
    isLoading: config.isConnected && isLoading,
    isConnected: config.isConnected,
  };
}

// Main hook to get all resource counts
export function useResourceCounts(): { counts: ResourceCounts; isLoading: boolean; isConnected: boolean } {
  const { config } = useKubernetesConfigStore();

  // Fetch core resources with real-time updates when connected
  const pods = useK8sResourceList<KubernetesResource>('pods', undefined, { 
    enabled: config.isConnected, refetchInterval: 30000 
  });
  const deployments = useK8sResourceList<KubernetesResource>('deployments', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });
  const services = useK8sResourceList<KubernetesResource>('services', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });
  const nodes = useK8sResourceList<KubernetesResource>('nodes', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });
  const namespaces = useK8sResourceList<KubernetesResource>('namespaces', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });
  const configmaps = useK8sResourceList<KubernetesResource>('configmaps', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });
  const secrets = useK8sResourceList<KubernetesResource>('secrets', undefined, { 
    enabled: config.isConnected, refetchInterval: 60000 
  });

  const counts = useMemo<ResourceCounts>(() => {
    if (!config.isConnected) {
      return {
        pods: mockCounts.pods,
        deployments: mockCounts.deployments,
        replicasets: mockCounts.replicasets,
        statefulsets: mockCounts.statefulsets,
        daemonsets: mockCounts.daemonsets,
        jobs: mockCounts.jobs,
        cronjobs: mockCounts.cronjobs,
        services: mockCounts.services,
        ingresses: mockCounts.ingresses,
        ingressclasses: mockCounts.ingressclasses,
        endpoints: mockCounts.endpoints,
        endpointslices: mockCounts.endpointslices,
        networkpolicies: mockCounts.networkpolicies,
        configmaps: mockCounts.configmaps,
        secrets: mockCounts.secrets,
        persistentvolumes: mockCounts.persistentvolumes,
        persistentvolumeclaims: mockCounts.persistentvolumeclaims,
        storageclasses: mockCounts.storageclasses,
        volumeattachments: mockCounts.volumeattachments,
        nodes: mockCounts.nodes,
        namespaces: mockCounts.namespaces,
        apiservices: mockCounts.apiservices,
        leases: mockCounts.leases,
        serviceaccounts: mockCounts.serviceaccounts,
        roles: mockCounts.roles,
        clusterroles: mockCounts.clusterroles,
        rolebindings: mockCounts.rolebindings,
        clusterrolebindings: mockCounts.clusterrolebindings,
        priorityclasses: mockCounts.priorityclasses,
        resourcequotas: mockCounts.resourcequotas,
        limitranges: mockCounts.limitranges,
        horizontalpodautoscalers: mockCounts.horizontalpodautoscalers,
        verticalpodautoscalers: mockCounts.verticalpodautoscalers,
        poddisruptionbudgets: mockCounts.poddisruptionbudgets,
        customresourcedefinitions: mockCounts.customresourcedefinitions,
        mutatingwebhookconfigurations: mockCounts.mutatingwebhookconfigurations,
        validatingwebhookconfigurations: mockCounts.validatingwebhookconfigurations,
      };
    }

    return {
      pods: pods.data?.items?.length ?? 0,
      deployments: deployments.data?.items?.length ?? 0,
      replicasets: mockCounts.replicasets, // Use mock for less critical resources
      statefulsets: mockCounts.statefulsets,
      daemonsets: mockCounts.daemonsets,
      jobs: mockCounts.jobs,
      cronjobs: mockCounts.cronjobs,
      services: services.data?.items?.length ?? 0,
      ingresses: mockCounts.ingresses,
      ingressclasses: mockCounts.ingressclasses,
      endpoints: mockCounts.endpoints,
      endpointslices: mockCounts.endpointslices,
      networkpolicies: mockCounts.networkpolicies,
      configmaps: configmaps.data?.items?.length ?? 0,
      secrets: secrets.data?.items?.length ?? 0,
      persistentvolumes: mockCounts.persistentvolumes,
      persistentvolumeclaims: mockCounts.persistentvolumeclaims,
      storageclasses: mockCounts.storageclasses,
      volumeattachments: mockCounts.volumeattachments,
      nodes: nodes.data?.items?.length ?? 0,
      namespaces: namespaces.data?.items?.length ?? 0,
      apiservices: mockCounts.apiservices,
      leases: mockCounts.leases,
      serviceaccounts: mockCounts.serviceaccounts,
      roles: mockCounts.roles,
      clusterroles: mockCounts.clusterroles,
      rolebindings: mockCounts.rolebindings,
      clusterrolebindings: mockCounts.clusterrolebindings,
      priorityclasses: mockCounts.priorityclasses,
      resourcequotas: mockCounts.resourcequotas,
      limitranges: mockCounts.limitranges,
      horizontalpodautoscalers: mockCounts.horizontalpodautoscalers,
      verticalpodautoscalers: mockCounts.verticalpodautoscalers,
      poddisruptionbudgets: mockCounts.poddisruptionbudgets,
      customresourcedefinitions: mockCounts.customresourcedefinitions,
      mutatingwebhookconfigurations: mockCounts.mutatingwebhookconfigurations,
      validatingwebhookconfigurations: mockCounts.validatingwebhookconfigurations,
    };
  }, [
    config.isConnected,
    pods.data,
    deployments.data,
    services.data,
    nodes.data,
    namespaces.data,
    configmaps.data,
    secrets.data,
  ]);

  const isLoading = pods.isLoading || deployments.isLoading || services.isLoading || 
                    nodes.isLoading || namespaces.isLoading;

  return { counts, isLoading, isConnected: config.isConnected };
}

export { useResourceCount };
