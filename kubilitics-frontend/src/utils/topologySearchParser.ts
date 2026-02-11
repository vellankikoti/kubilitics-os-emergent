/**
 * Topology Search Query Parser
 * Parses search queries to identify resource type, name, and namespace
 * Supports navigation to resource detail pages
 */

export interface ParsedSearchQuery {
  type?: string;
  name?: string;
  namespace?: string;
  originalQuery: string;
}

/**
 * Resource type mappings for search
 */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  'pod': 'pod',
  'pods': 'pod',
  'deployment': 'deployment',
  'deployments': 'deployment',
  'deploy': 'deployment',
  'replicaset': 'replicaset',
  'replicasets': 'replicaset',
  'rs': 'replicaset',
  'statefulset': 'statefulset',
  'statefulsets': 'statefulset',
  'sts': 'statefulset',
  'daemonset': 'daemonsets',
  'daemonsets': 'daemonsets',
  'ds': 'daemonsets',
  'service': 'service',
  'services': 'service',
  'svc': 'service',
  'ingress': 'ingress',
  'ingresses': 'ingress',
  'ing': 'ingress',
  'node': 'node',
  'nodes': 'node',
  'namespace': 'namespace',
  'namespaces': 'namespace',
  'ns': 'namespace',
  'configmap': 'configmap',
  'configmaps': 'configmap',
  'cm': 'configmap',
  'secret': 'secret',
  'secrets': 'secret',
  'job': 'job',
  'jobs': 'job',
  'cronjob': 'cronjob',
  'cronjobs': 'cronjob',
  'cj': 'cronjob',
  'pvc': 'persistentvolumeclaim',
  'persistentvolumeclaim': 'persistentvolumeclaim',
  'persistentvolumeclaims': 'persistentvolumeclaim',
  'pv': 'persistentvolume',
  'persistentvolume': 'persistentvolume',
  'persistentvolumes': 'persistentvolume',
  'storageclass': 'storageclass',
  'storageclasses': 'storageclass',
  'sc': 'storageclass',
  'serviceaccount': 'serviceaccount',
  'serviceaccounts': 'serviceaccount',
  'sa': 'serviceaccount',
};

/**
 * Route mappings for resource types
 */
export const RESOURCE_ROUTE_MAP: Record<string, string> = {
  'pod': 'pods',
  'deployment': 'deployments',
  'replicaset': 'replicasets',
  'statefulset': 'statefulsets',
  'daemonsets': 'daemonsets',
  'service': 'services',
  'ingress': 'ingresses',
  'node': 'nodes',
  'namespace': 'namespaces',
  'configmap': 'configmaps',
  'secret': 'secrets',
  'job': 'jobs',
  'cronjob': 'cronjobs',
  'persistentvolumeclaim': 'persistentvolumeclaims',
  'persistentvolume': 'persistentvolumes',
  'storageclass': 'storageclasses',
  'serviceaccount': 'serviceaccounts',
};

/**
 * Parses a search query to extract resource type, name, and namespace
 * 
 * Supported patterns:
 * - "pod nginx" → { type: 'pod', name: 'nginx' }
 * - "deployment api-gateway default" → { type: 'deployment', name: 'api-gateway', namespace: 'default' }
 * - "default/nginx" → { namespace: 'default', name: 'nginx' }
 * - "node worker-1" → { type: 'node', name: 'worker-1' }
 * - "nginx" → { name: 'nginx' } (no type specified)
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  if (!trimmed) {
    return { originalQuery: query };
  }

  const parts = trimmed.split(/\s+/);
  const result: ParsedSearchQuery = { originalQuery: query };

  // Pattern 1: namespace/resource-name (e.g., "default/nginx")
  if (trimmed.includes('/') && !trimmed.includes(' ')) {
    const [ns, name] = trimmed.split('/');
    result.namespace = ns.trim();
    result.name = name.trim();
    return result;
  }

  // Pattern 2: Check if first part is a resource type
  const firstPart = parts[0].toLowerCase();
  if (RESOURCE_TYPE_MAP[firstPart]) {
    result.type = RESOURCE_TYPE_MAP[firstPart];
    
    if (parts.length === 2) {
      // "pod nginx" or "deployment api"
      result.name = parts[1];
    } else if (parts.length === 3) {
      // "deployment api default" or "pod nginx default"
      result.name = parts[1];
      result.namespace = parts[2];
    } else if (parts.length > 3) {
      // "deployment api-gateway default" (multi-word name)
      result.name = parts.slice(1, -1).join(' ');
      result.namespace = parts[parts.length - 1];
    }
  } else {
    // Pattern 3: Just a name (no type specified)
    if (parts.length === 1) {
      result.name = parts[0];
    } else if (parts.length === 2) {
      // Assume "name namespace"
      result.name = parts[0];
      result.namespace = parts[1];
    } else {
      // Multi-word name
      result.name = parts[0];
      result.namespace = parts[parts.length - 1];
    }
  }

  return result;
}

/**
 * Builds a navigation path from parsed query
 * Returns null if navigation is not possible
 */
export function buildNavigationPath(parsed: ParsedSearchQuery): string | null {
  if (!parsed.name) return null;

  const route = parsed.type ? RESOURCE_ROUTE_MAP[parsed.type] : null;
  if (!route) return null;

  // Cluster-scoped resources
  if (route === 'nodes' || route === 'namespaces' || route === 'persistentvolumes' || route === 'storageclasses') {
    return `/${route}/${parsed.name}`;
  }

  // Namespace-scoped resources
  if (parsed.namespace) {
    return `/${route}/${parsed.namespace}/${parsed.name}`;
  }

  // Try to infer namespace from context or use 'default'
  return `/${route}/default/${parsed.name}`;
}

/**
 * Finds a matching node in the graph by name/type/namespace
 */
export function findMatchingNode(
  nodes: Array<{ id: string; kind: string; name: string; namespace?: string }>,
  parsed: ParsedSearchQuery
): { id: string; kind: string; name: string; namespace?: string } | null {
  if (!parsed.name) return null;

  const nameLower = parsed.name.toLowerCase();
  const typeLower = parsed.type?.toLowerCase();

  // Exact match first
  for (const node of nodes) {
    const nodeNameLower = node.name.toLowerCase();
    const nodeKindLower = node.kind.toLowerCase();
    const nodeNs = node.namespace?.toLowerCase();

    // Exact name match
    if (nodeNameLower === nameLower) {
      // Check type if specified
      if (typeLower && nodeKindLower !== typeLower) continue;
      // Check namespace if specified
      if (parsed.namespace && nodeNs !== parsed.namespace.toLowerCase()) continue;
      return node;
    }
  }

  // Partial match
  for (const node of nodes) {
    const nodeNameLower = node.name.toLowerCase();
    const nodeKindLower = node.kind.toLowerCase();
    const nodeNs = node.namespace?.toLowerCase();

    if (nodeNameLower.includes(nameLower)) {
      if (typeLower && nodeKindLower !== typeLower) continue;
      if (parsed.namespace && nodeNs !== parsed.namespace.toLowerCase()) continue;
      return node;
    }
  }

  return null;
}
