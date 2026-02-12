/**
 * Resource Kind Mapper
 * Maps route paths and resource types to canonical Kubernetes kinds
 * Used for topology API calls and resource identification
 */

/**
 * Maps route path segments (plural lowercase) to canonical Kubernetes kinds
 * Example: "pods" -> "Pod", "deployments" -> "Deployment"
 */
const ROUTE_TO_KIND: Record<string, string> = {
  'pods': 'Pod',
  'deployments': 'Deployment',
  'replicasets': 'ReplicaSet',
  'statefulsets': 'StatefulSet',
  'daemonsets': 'DaemonSet',
  'jobs': 'Job',
  'cronjobs': 'CronJob',
  'services': 'Service',
  'ingresses': 'Ingress',
  'ingressclasses': 'IngressClass',
  'endpoints': 'Endpoints',
  'endpointslices': 'EndpointSlice',
  'networkpolicies': 'NetworkPolicy',
  'configmaps': 'ConfigMap',
  'secrets': 'Secret',
  'persistentvolumeclaims': 'PersistentVolumeClaim',
  'persistentvolumes': 'PersistentVolume',
  'storageclasses': 'StorageClass',
  'volumeattachments': 'VolumeAttachment',
  'nodes': 'Node',
  'namespaces': 'Namespace',
};

/**
 * Maps canonical Kubernetes kinds to route paths (plural lowercase)
 */
const KIND_TO_ROUTE: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_TO_KIND).map(([route, kind]) => [kind, route])
);

/**
 * Cluster-scoped resources that don't have a namespace
 */
const CLUSTER_SCOPED_KINDS = new Set([
  'Node',
  'PersistentVolume',
  'StorageClass',
  'VolumeAttachment',
  'Namespace',
  'ClusterRole',
  'ClusterRoleBinding',
  'PriorityClass',
  'RuntimeClass',
  'PodSecurityPolicy',
  'APIService',
  'ComponentStatus',
]);

/**
 * Converts a route path segment to canonical Kubernetes kind
 * @param routePath - Route path segment (e.g., "pods", "deployments")
 * @returns Canonical Kubernetes kind (e.g., "Pod", "Deployment")
 */
export function routePathToKind(routePath: string): string {
  const normalized = routePath.toLowerCase();
  return ROUTE_TO_KIND[normalized] || routePath;
}

/**
 * Converts a canonical Kubernetes kind to route path segment
 * @param kind - Canonical Kubernetes kind (e.g., "Pod", "Deployment")
 * @returns Route path segment (e.g., "pods", "deployments")
 */
export function kindToRoutePath(kind: string): string {
  return KIND_TO_ROUTE[kind] || kind.toLowerCase() + 's';
}

/**
 * Normalizes a resource kind string to canonical format
 * Handles various input formats: "Pod", "pod", "pods", "POD"
 * @param kind - Resource kind in any format
 * @returns Canonical Kubernetes kind
 */
export function normalizeKindForTopology(kind: string): string {
  // First try direct lookup
  if (ROUTE_TO_KIND[kind.toLowerCase()]) {
    return ROUTE_TO_KIND[kind.toLowerCase()];
  }
  
  // Try PascalCase conversion
  const pascalCase = kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  if (KIND_TO_ROUTE[pascalCase]) {
    return pascalCase;
  }
  
  // Return as-is if already canonical
  return kind;
}

/**
 * Checks if a resource kind is cluster-scoped
 * @param kind - Canonical Kubernetes kind
 * @returns true if cluster-scoped, false if namespaced
 */
export function isClusterScoped(kind: string): boolean {
  return CLUSTER_SCOPED_KINDS.has(kind);
}

/**
 * Builds a topology node ID in the format: {Kind}/{namespace}/{name}
 * For cluster-scoped resources: {Kind}/{name}
 * @param kind - Canonical Kubernetes kind
 * @param namespace - Resource namespace (empty string for cluster-scoped)
 * @param name - Resource name
 * @returns Node ID string
 */
export function buildTopologyNodeId(kind: string, namespace: string, name: string): string {
  if (isClusterScoped(kind) || !namespace) {
    return `${kind}/${name}`;
  }
  return `${kind}/${namespace}/${name}`;
}
