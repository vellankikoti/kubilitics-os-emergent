import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKubernetesConfigStore } from '@/stores/kubernetesConfigStore';
import { toast } from 'sonner';

// Types for Kubernetes resources
export interface KubernetesMetadata {
  name: string;
  namespace?: string;
  uid: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  resourceVersion?: string;
  ownerReferences?: Array<{
    apiVersion: string;
    kind: string;
    name: string;
    uid: string;
  }>;
}

export interface KubernetesResource {
  apiVersion?: string;
  kind?: string;
  metadata: KubernetesMetadata;
  spec?: Record<string, any>;
  status?: Record<string, any>;
}

export interface ResourceList<T> {
  items: T[];
  metadata?: {
    continue?: string;
    resourceVersion?: string;
  };
}

// API Group paths mapping
export const API_GROUPS = {
  // Core API (v1)
  pods: '/api/v1',
  services: '/api/v1',
  configmaps: '/api/v1',
  secrets: '/api/v1',
  namespaces: '/api/v1',
  nodes: '/api/v1',
  persistentvolumes: '/api/v1',
  persistentvolumeclaims: '/api/v1',
  serviceaccounts: '/api/v1',
  endpoints: '/api/v1',
  events: '/api/v1',
  resourcequotas: '/api/v1',
  limitranges: '/api/v1',
  replicationcontrollers: '/api/v1',

  // Apps API
  deployments: '/apis/apps/v1',
  replicasets: '/apis/apps/v1',
  statefulsets: '/apis/apps/v1',
  daemonsets: '/apis/apps/v1',

  // Batch API
  jobs: '/apis/batch/v1',
  cronjobs: '/apis/batch/v1',

  // Networking API
  ingresses: '/apis/networking.k8s.io/v1',
  ingressclasses: '/apis/networking.k8s.io/v1',
  networkpolicies: '/apis/networking.k8s.io/v1',

  // Storage API
  storageclasses: '/apis/storage.k8s.io/v1',
  volumeattachments: '/apis/storage.k8s.io/v1',

  // RBAC API
  roles: '/apis/rbac.authorization.k8s.io/v1',
  rolebindings: '/apis/rbac.authorization.k8s.io/v1',
  clusterroles: '/apis/rbac.authorization.k8s.io/v1',
  clusterrolebindings: '/apis/rbac.authorization.k8s.io/v1',

  // Autoscaling API
  horizontalpodautoscalers: '/apis/autoscaling/v2',
  verticalpodautoscalers: '/apis/autoscaling.k8s.io/v1',

  // Policy API
  poddisruptionbudgets: '/apis/policy/v1',
  podsecuritypolicies: '/apis/policy/v1beta1',

  // Discovery API
  endpointslices: '/apis/discovery.k8s.io/v1',

  // Scheduling API
  priorityclasses: '/apis/scheduling.k8s.io/v1',

  // Node API
  runtimeclasses: '/apis/node.k8s.io/v1',

  // Coordination API
  leases: '/apis/coordination.k8s.io/v1',

  // API Registration
  apiservices: '/apis/apiregistration.k8s.io/v1',

  // Custom Resources
  customresourcedefinitions: '/apis/apiextensions.k8s.io/v1',

  // Admission Control
  mutatingwebhookconfigurations: '/apis/admissionregistration.k8s.io/v1',
  validatingwebhookconfigurations: '/apis/admissionregistration.k8s.io/v1',
} as const;

export type ResourceType = keyof typeof API_GROUPS;

// API client wrapper
async function k8sRequest<T>(
  path: string,
  options: RequestInit = {},
  config: { apiUrl: string; token?: string }
): Promise<T> {
  const { apiUrl, token } = config;

  if (!apiUrl) {
    throw new Error('Kubernetes API URL not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kubernetes API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// Generic hook for fetching any K8s resource list
export function useK8sResourceList<T extends KubernetesResource>(
  resourceType: ResourceType,
  namespace?: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const { config } = useKubernetesConfigStore();
  const apiBase = API_GROUPS[resourceType];
  
  // Cluster-scoped resources
  const clusterScoped = ['nodes', 'namespaces', 'persistentvolumes', 'storageclasses', 
    'clusterroles', 'clusterrolebindings', 'ingressclasses', 'priorityclasses', 
    'runtimeclasses', 'apiservices', 'customresourcedefinitions', 'volumeattachments',
    'mutatingwebhookconfigurations', 'validatingwebhookconfigurations', 'podsecuritypolicies'];
  
  const isClusterScoped = clusterScoped.includes(resourceType);
  
  const path = isClusterScoped || !namespace
    ? `${apiBase}/${resourceType}`
    : `${apiBase}/namespaces/${namespace}/${resourceType}`;

  return useQuery({
    queryKey: ['k8s', resourceType, namespace],
    queryFn: () => k8sRequest<ResourceList<T>>(path, {}, config),
    enabled: config.isConnected && (options?.enabled !== false),
    refetchInterval: options?.refetchInterval ?? 30000,
    staleTime: 10000,
  });
}

// Hook for fetching a single resource
export function useK8sResource<T extends KubernetesResource>(
  resourceType: ResourceType,
  name: string,
  namespace?: string,
  options?: { enabled?: boolean }
) {
  const { config } = useKubernetesConfigStore();
  const apiBase = API_GROUPS[resourceType];
  
  const clusterScoped = ['nodes', 'namespaces', 'persistentvolumes', 'storageclasses', 
    'clusterroles', 'clusterrolebindings', 'ingressclasses', 'priorityclasses', 
    'runtimeclasses', 'apiservices', 'customresourcedefinitions', 'volumeattachments',
    'mutatingwebhookconfigurations', 'validatingwebhookconfigurations', 'podsecuritypolicies'];
  
  const isClusterScoped = clusterScoped.includes(resourceType);
  
  const path = isClusterScoped || !namespace
    ? `${apiBase}/${resourceType}/${name}`
    : `${apiBase}/namespaces/${namespace}/${resourceType}/${name}`;

  return useQuery({
    queryKey: ['k8s', resourceType, namespace, name],
    queryFn: () => k8sRequest<T>(path, {}, config),
    enabled: config.isConnected && !!name && (options?.enabled !== false),
    staleTime: 10000,
  });
}

// Hook for creating resources
export function useCreateK8sResource(resourceType: ResourceType) {
  const { config } = useKubernetesConfigStore();
  const queryClient = useQueryClient();
  const apiBase = API_GROUPS[resourceType];

  return useMutation({
    mutationFn: async ({ yaml, namespace }: { yaml: string; namespace?: string }) => {
      const resource = parseYaml(yaml);
      const ns = namespace || resource.metadata?.namespace || 'default';
      const path = `${apiBase}/namespaces/${ns}/${resourceType}`;
      return k8sRequest(path, { method: 'POST', body: yaml }, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', resourceType] });
      toast.success(`${resourceType} created successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create ${resourceType}: ${error.message}`);
    },
  });
}

// Hook for updating resources
export function useUpdateK8sResource(resourceType: ResourceType) {
  const { config } = useKubernetesConfigStore();
  const queryClient = useQueryClient();
  const apiBase = API_GROUPS[resourceType];

  return useMutation({
    mutationFn: async ({ name, yaml, namespace }: { name: string; yaml: string; namespace?: string }) => {
      const path = namespace
        ? `${apiBase}/namespaces/${namespace}/${resourceType}/${name}`
        : `${apiBase}/${resourceType}/${name}`;
      return k8sRequest(path, { method: 'PUT', body: yaml }, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', resourceType] });
      toast.success(`${resourceType} updated successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update ${resourceType}: ${error.message}`);
    },
  });
}

// Hook for deleting resources
export function useDeleteK8sResource(resourceType: ResourceType) {
  const { config } = useKubernetesConfigStore();
  const queryClient = useQueryClient();
  const apiBase = API_GROUPS[resourceType];

  return useMutation({
    mutationFn: async ({ name, namespace }: { name: string; namespace?: string }) => {
      const clusterScoped = ['nodes', 'namespaces', 'persistentvolumes', 'storageclasses', 
        'clusterroles', 'clusterrolebindings', 'ingressclasses', 'priorityclasses', 
        'runtimeclasses', 'apiservices', 'customresourcedefinitions', 'volumeattachments',
        'mutatingwebhookconfigurations', 'validatingwebhookconfigurations', 'podsecuritypolicies'];
      
      const isClusterScoped = clusterScoped.includes(resourceType);
      
      const path = isClusterScoped || !namespace
        ? `${apiBase}/${resourceType}/${name}`
        : `${apiBase}/namespaces/${namespace}/${resourceType}/${name}`;
      
      return k8sRequest(path, { method: 'DELETE' }, config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['k8s', resourceType] });
      toast.success(`${resourceType} deleted successfully`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete ${resourceType}: ${error.message}`);
    },
  });
}

// Hook for testing connection
export function useTestK8sConnection() {
  const { config, setConnected } = useKubernetesConfigStore();

  return useMutation({
    mutationFn: async () => {
      const response = await k8sRequest<{ status: string }>('/api/v1', {}, config);
      return response;
    },
    onSuccess: () => {
      setConnected(true);
      toast.success('Connected to Kubernetes cluster');
    },
    onError: (error: Error) => {
      setConnected(false);
      toast.error(`Connection failed: ${error.message}`);
    },
  });
}

// Hook to get pod logs
export function useK8sPodLogs(
  namespace: string,
  podName: string,
  containerName?: string,
  options?: { enabled?: boolean; tailLines?: number }
) {
  const { config } = useKubernetesConfigStore();
  
  const queryParams = new URLSearchParams();
  if (containerName) queryParams.set('container', containerName);
  if (options?.tailLines) queryParams.set('tailLines', String(options.tailLines));
  
  const path = `/api/v1/namespaces/${namespace}/pods/${podName}/log?${queryParams.toString()}`;

  return useQuery({
    queryKey: ['k8s', 'pods', namespace, podName, 'logs', containerName],
    queryFn: async () => {
      const response = await fetch(`${config.apiUrl}${path}`, {
        headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
      });
      if (!response.ok) throw new Error('Failed to fetch logs');
      return response.text();
    },
    enabled: config.isConnected && !!podName && (options?.enabled !== false),
    refetchInterval: 5000,
  });
}

// Utility: Calculate age from timestamp
export function calculateAge(timestamp: string): string {
  const created = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

// Simple YAML parser (for basic use - in production use a proper library)
function parseYaml(yaml: string): KubernetesResource {
  const lines = yaml.split('\n');
  const result: any = { metadata: {} };
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const content = line.trim();
    
    if (content.includes(':')) {
      const [key, ...valueParts] = content.split(':');
      const value = valueParts.join(':').trim();
      const indent = line.search(/\S/);

      if (indent === 0 && value) {
        result[key] = value.replace(/^["']|["']$/g, '');
      } else if (indent === 2 && line.startsWith('  ') && value) {
        const parentKey = Object.keys(result).find(k => typeof result[k] === 'object');
        if (parentKey) {
          result[parentKey][key] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  }

  return result;
}

// Legacy hooks for backwards compatibility
export function useK8sResources<T extends KubernetesResource>(
  resourceType: string,
  namespace?: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useK8sResourceList<T>(resourceType as ResourceType, namespace, options);
}

export function useK8sAppsResources<T extends KubernetesResource>(
  resourceType: string,
  namespace?: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useK8sResourceList<T>(resourceType as ResourceType, namespace, options);
}
