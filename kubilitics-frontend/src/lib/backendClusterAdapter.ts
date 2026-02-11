/**
 * Converts backend cluster API shape to frontend Cluster (clusterStore).
 * Shared by ClusterConnect and ConnectedRedirect so URL-only navigation works.
 * Uses real backend fields (version, node_count, namespace_count) and infers provider/region from server URL.
 */
import type { Cluster } from '@/stores/clusterStore';
import type { BackendCluster } from '@/services/backendApiClient';

/** Infer cloud region from server URL when possible (e.g. us-east-1 from EKS/GKE/AKS hostnames). */
export function inferRegion(serverUrl: string): string {
  if (!serverUrl) return '';
  try {
    const u = new URL(serverUrl.startsWith('http') ? serverUrl : `https://${serverUrl}`);
    const host = u.hostname.toLowerCase();
    // EKS: *.us-east-1.eks.amazonaws.com or *.region.eks.amazonaws.com
    const eksMatch = host.match(/\.([a-z0-9-]+)\.eks\.amazonaws\.com$/i);
    if (eksMatch) return eksMatch[1];
    // GKE: *.us-east1-b.container.google.com or *-region.zone.container.google.com
    const gkeMatch = host.match(/([a-z]+[0-9]-[a-z])\.([a-z]+[0-9])\.container\.googleapis\.com$/i)
      || host.match(/([a-z]+[0-9]-[a-z])\.([a-z]+[0-9])\.container\.google\.com$/i);
    if (gkeMatch) return `${gkeMatch[2]}-${gkeMatch[1]}`;
    // AKS: *.region.azmk8s.io or similar
    const aksMatch = host.match(/\.([a-z0-9-]+)\.azmk8s\.io$/i) || host.match(/\.([a-z0-9-]+)\.azure\.com$/i);
    if (aksMatch) return aksMatch[1];
    // Generic: look for region-like segment (word-digit-word, e.g. us-east-1, eu-west-1)
    const genericMatch = host.match(/([a-z]{2}-[a-z]+-[0-9])/i);
    if (genericMatch) return genericMatch[1];
  } catch {
    // URL parse failed
  }
  return '';
}

export function backendClusterToCluster(b: BackendCluster): Cluster {
  const server = b.server_url ?? b.server ?? '';
  const provider = ((): Cluster['provider'] => {
    if (server.includes('eks') || server.includes('amazonaws')) return 'eks';
    if (server.includes('gke') || server.includes('google')) return 'gke';
    if (server.includes('aks') || server.includes('azure')) return 'aks';
    if (server.includes('minikube')) return 'minikube';
    if (server.includes('kind')) return 'kind';
    return 'on-prem';
  })();
  const region = inferRegion(server);
  return {
    id: b.id,
    name: b.name,
    context: b.context,
    version: b.version ?? 'v1.28.0',
    status: b.status === 'connected' ? 'healthy' : b.status === 'disconnected' ? 'warning' : 'error',
    region: region || '',
    provider,
    nodes: b.node_count ?? 0,
    namespaces: b.namespace_count ?? 0,
    pods: { running: 0, pending: 0, failed: 0 },
    cpu: { used: 0, total: 100 },
    memory: { used: 0, total: 100 },
  };
}
