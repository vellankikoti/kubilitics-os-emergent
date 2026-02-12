/**
 * Kubilitics backend API client.
 * Base URL + /api/v1/clusters and /api/v1/clusters/{clusterId}/...
 * Per TASKS A3.1: client for Kubilitics backend; used by topology and cluster list.
 */
import type { TopologyGraph } from '@/topology-engine';
import { adaptTopologyGraph, validateTopologyGraph } from '@/topology-engine';

const API_PREFIX = '/api/v1';

/** Cluster shape returned by GET /api/v1/clusters (matches backend models.Cluster) */
export interface BackendCluster {
  id: string;
  name: string;
  context: string;
  kubeconfig_path?: string;
  server_url?: string;
  server?: string;
  version?: string;
  status?: string;
  provider?: string; // EKS, GKE, AKS, OpenShift, Rancher, k3s, Kind, Minikube, Docker Desktop, on-prem
  last_connected?: string;
  created_at?: string;
  updated_at?: string;
  node_count?: number;
  namespace_count?: number;
}

/** C2.3: Error transparency — status and requestId for support. */
export class BackendApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
    /** X-Request-ID from response header when present (for support correlation). */
    public requestId?: string
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

/** D1.2: Header required for destructive actions (delete resource, apply). */
export const CONFIRM_DESTRUCTIVE_HEADER = 'X-Confirm-Destructive';

/**
 * Low-level request against the backend.
 * Path is relative to API root, e.g. "clusters" -> /api/v1/clusters.
 */
export async function backendRequest<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = `${normalizedBase}${API_PREFIX}/${normalizedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const requestId = response.headers.get('X-Request-ID') ?? undefined;
  const body = await response.text();
  if (!response.ok) {
    throw new BackendApiError(
      `Backend API error: ${response.status}${body ? ` - ${body}` : ''}`,
      response.status,
      body,
      requestId
    );
  }

  if (!body || body.trim() === '') {
    return undefined as T;
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new BackendApiError(
      `Invalid JSON response: ${body.slice(0, 200)}`,
      response.status,
      body,
      requestId
    );
  }
}

/**
 * GET /api/v1/clusters — list all clusters.
 */
export async function getClusters(baseUrl: string): Promise<BackendCluster[]> {
  return backendRequest<BackendCluster[]>(baseUrl, 'clusters');
}

/** Cluster summary shape from GET /api/v1/clusters/{clusterId}/summary (matches backend ClusterSummary). */
export interface BackendClusterSummary {
  id: string;
  name: string;
  node_count: number;
  namespace_count: number;
  pod_count: number;
  deployment_count: number;
  service_count: number;
  health_status: string;
}

/**
 * GET /api/v1/clusters/{clusterId}/summary — cluster statistics (node_count, namespace_count, pod_count, etc.).
 */
export async function getClusterSummary(
  baseUrl: string,
  clusterId: string
): Promise<BackendClusterSummary> {
  const path = `clusters/${encodeURIComponent(clusterId)}/summary`;
  return backendRequest<BackendClusterSummary>(baseUrl, path);
}

/**
 * POST /api/v1/clusters — add a cluster (kubeconfig path + context).
 * Backend creates K8s client and registers the cluster; use default kubeconfig path for Docker Desktop (e.g. ~/.kube/config).
 */
export async function addCluster(
  baseUrl: string,
  kubeconfigPath: string,
  context: string
): Promise<BackendCluster> {
  return backendRequest<BackendCluster>(baseUrl, 'clusters', {
    method: 'POST',
    body: JSON.stringify({
      kubeconfig_path: kubeconfigPath,
      context: context || undefined,
    }),
  });
}

/**
 * POST /api/v1/clusters — add a cluster by uploading kubeconfig content (base64).
 * Use when user uploads a file from the browser; backend writes to temp and registers the cluster.
 */
export async function addClusterWithUpload(
  baseUrl: string,
  kubeconfigBase64: string,
  context: string
): Promise<BackendCluster> {
  return backendRequest<BackendCluster>(baseUrl, 'clusters', {
    method: 'POST',
    body: JSON.stringify({
      kubeconfig_base64: kubeconfigBase64,
      context: context || undefined,
    }),
  });
}

/**
 * GET /api/v1/clusters/{clusterId}/topology — get topology graph.
 * Optional query: namespace, resource_types.
 */
export async function getTopology(
  baseUrl: string,
  clusterId: string,
  params?: { namespace?: string; resource_types?: string[] }
): Promise<TopologyGraph> {
  const search = new URLSearchParams();
  if (params?.namespace) search.set('namespace', params.namespace);
  if (params?.resource_types?.length)
    params.resource_types.forEach((t) => search.append('resource_types', t));
  const query = search.toString();
  const path = `clusters/${encodeURIComponent(clusterId)}/topology${query ? `?${query}` : ''}`;
  
  try {
    const result = await backendRequest<any>(baseUrl, path);
    
    if (!result) {
      throw new Error('Empty response from topology API');
    }

    // Transform backend format to frontend format
    const transformedGraph = adaptTopologyGraph(result);

    // Validate transformed graph
    const validation = validateTopologyGraph(transformedGraph);
    if (!validation.valid) {
      console.error('Topology graph validation failed:', validation.errors);
    }

    return transformedGraph;
  } catch (error) {
    console.error('Error fetching topology:', {
      baseUrl,
      clusterId,
      params,
      error,
    });
    throw error;
  }
}

/**
 * GET /api/v1/clusters/{clusterId}/topology/resource/{kind}/{namespace}/{name} — resource-scoped topology.
 * For cluster-scoped resources (Node, PV, StorageClass) use namespace '-' or '_'.
 */
export async function getResourceTopology(
  baseUrl: string,
  clusterId: string,
  kind: string,
  namespace: string,
  name: string
): Promise<TopologyGraph> {
  const ns = namespace === '' ? '-' : namespace;
  const path = `clusters/${encodeURIComponent(clusterId)}/topology/resource/${encodeURIComponent(kind)}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}`;

  try {
    const result = await backendRequest<any>(baseUrl, path);
    if (!result) throw new Error('Empty response from topology API');

    const transformedGraph = adaptTopologyGraph(result);

    const validation = validateTopologyGraph(transformedGraph);
    if (!validation.valid) {
      console.error('[getResourceTopology] Graph validation errors:', validation.errors);
    }

    return transformedGraph;
  } catch (error) {
    console.error('[getResourceTopology] Failed:', { kind, namespace: ns, name, error });
    throw error;
  }
}

/**
 * GET /api/v1/../health => /health — backend health check (at API base, not under /api/v1).
 */
export async function getHealth(
  baseUrl: string
): Promise<{ status: string; service?: string; version?: string }> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const url = `${normalizedBase}/health`;
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new BackendApiError(
      `Health check failed: ${response.status}${body ? ` - ${body}` : ''}`,
      response.status,
      body
    );
  }
  if (!body?.trim()) return undefined as { status: string };
  try {
    return JSON.parse(body) as { status: string; service?: string; version?: string };
  } catch {
    const preview = body?.trim() ? body.slice(0, 100) : '(empty)';
    throw new BackendApiError(
      `Invalid JSON from /health (backend may have returned HTML or wrong URL). Body: ${preview}${(body?.length ?? 0) > 100 ? '…' : ''}`,
      response.status,
      body
    );
  }
}

/** List response shape from GET /api/v1/clusters/{clusterId}/resources/{kind} (matches backend). */
export interface BackendResourceListResponse {
  kind?: string;
  apiVersion?: string;
  metadata?: { resourceVersion?: string; continue?: string; remainingItemCount?: number };
  items: Record<string, unknown>[];
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/{kind} — list resources by kind.
 * Query: namespace, limit, continue, labelSelector, fieldSelector.
 */
export async function listResources(
  baseUrl: string,
  clusterId: string,
  kind: string,
  params?: { namespace?: string; limit?: number; continue?: string; labelSelector?: string; fieldSelector?: string }
): Promise<BackendResourceListResponse> {
  const search = new URLSearchParams();
  if (params?.namespace !== undefined && params.namespace !== '') search.set('namespace', params.namespace);
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.continue) search.set('continue', params.continue);
  if (params?.labelSelector) search.set('labelSelector', params.labelSelector);
  if (params?.fieldSelector) search.set('fieldSelector', params.fieldSelector);
  const query = search.toString();
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/${encodeURIComponent(kind)}${query ? `?${query}` : ''}`;
  return backendRequest<BackendResourceListResponse>(baseUrl, path);
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/{kind}/{namespace}/{name} — get single resource.
 * For cluster-scoped resources (IngressClass, Node, etc.) pass namespace as ''; path uses '-' sentinel.
 */
export async function getResource(
  baseUrl: string,
  clusterId: string,
  kind: string,
  namespace: string,
  name: string
): Promise<Record<string, unknown>> {
  const ns = namespace === '' ? '-' : namespace;
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}`;
  return backendRequest<Record<string, unknown>>(baseUrl, path);
}

/**
 * PATCH /api/v1/clusters/{clusterId}/resources/{kind}/{namespace}/{name}
 * Body: JSON merge-patch (e.g. { spec: { replicas: 3 } } for scaling).
 * For cluster-scoped resources pass namespace as ''; path uses '-' sentinel.
 */
export async function patchResource(
  baseUrl: string,
  clusterId: string,
  kind: string,
  namespace: string,
  name: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const ns = namespace === '' ? '-' : namespace;
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}`;
  return backendRequest<Record<string, unknown>>(baseUrl, path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

/**
 * DELETE /api/v1/clusters/{clusterId}/resources/{kind}/{namespace}/{name}
 * D1.2: Requires X-Confirm-Destructive: true (call only after user confirmation).
 * For cluster-scoped resources pass namespace as ''; path uses '-' sentinel.
 */
export async function deleteResource(
  baseUrl: string,
  clusterId: string,
  kind: string,
  namespace: string,
  name: string
): Promise<{ message: string; cluster_id: string; kind: string; namespace: string; name: string }> {
  const ns = namespace === '' ? '-' : namespace;
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/${encodeURIComponent(kind)}/${encodeURIComponent(ns)}/${encodeURIComponent(name)}`;
  return backendRequest(baseUrl, path, {
    method: 'DELETE',
    headers: { [CONFIRM_DESTRUCTIVE_HEADER]: 'true' },
  });
}

/**
 * POST /api/v1/clusters/{clusterId}/apply — apply YAML manifest.
 * D1.2: Requires X-Confirm-Destructive: true (review YAML before applying).
 */
export async function applyManifest(
  baseUrl: string,
  clusterId: string,
  yaml: string
): Promise<{ message: string; cluster_id: string; resources: Array<{ kind: string; namespace: string; name: string; action: string }> }> {
  const path = `clusters/${encodeURIComponent(clusterId)}/apply`;
  return backendRequest(baseUrl, path, {
    method: 'POST',
    headers: { [CONFIRM_DESTRUCTIVE_HEADER]: 'true' },
    body: JSON.stringify({ yaml }),
  });
}

/** Rollout history entry from GET .../deployments/{namespace}/{name}/rollout-history */
export interface RolloutHistoryRevision {
  revision: number;
  creationTimestamp: string;
  changeCause: string;
  podTemplateHash: string;
  ready: number;
  desired: number;
  available: number;
  name: string;
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/deployments/{namespace}/{name}/rollout-history
 */
export async function getDeploymentRolloutHistory(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<{ revisions: RolloutHistoryRevision[] }> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/rollout-history`;
  return backendRequest<{ revisions: RolloutHistoryRevision[] }>(baseUrl, path);
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/services/{namespace}/{name}/endpoints
 * Returns the Endpoints resource with the same name as the service.
 */
export async function getServiceEndpoints(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<Record<string, unknown>> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/services/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/endpoints`;
  return backendRequest<Record<string, unknown>>(baseUrl, path);
}

/** Ref shape for consumers API (namespace/name). */
export interface ConsumersRef {
  namespace: string;
  name: string;
}

/** Response from GET .../configmaps|secrets/{namespace}/{name}/consumers */
export interface ConsumersResponse {
  pods: ConsumersRef[];
  deployments: ConsumersRef[];
  statefulSets: ConsumersRef[];
  daemonSets: ConsumersRef[];
  jobs: ConsumersRef[];
  cronJobs: ConsumersRef[];
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/configmaps/{namespace}/{name}/consumers
 */
export async function getConfigMapConsumers(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<ConsumersResponse> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/configmaps/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/consumers`;
  return backendRequest<ConsumersResponse>(baseUrl, path);
}

/**
 * GET /api/v1/clusters/{clusterId}/resources/secrets/{namespace}/{name}/consumers
 */
export async function getSecretConsumers(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<ConsumersResponse> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/secrets/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/consumers`;
  return backendRequest<ConsumersResponse>(baseUrl, path);
}

/**
 * POST /api/v1/clusters/{clusterId}/resources/deployments/{namespace}/{name}/rollback
 * Body: { revision?: number } — optional; omit to roll back to previous revision.
 */
export async function postDeploymentRollback(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string,
  body?: { revision?: number }
): Promise<Record<string, unknown>> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/deployments/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/rollback`;
  return backendRequest<Record<string, unknown>>(baseUrl, path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * POST /api/v1/clusters/{clusterId}/resources/cronjobs/{namespace}/{name}/trigger
 * Creates a one-off Job from the CronJob's jobTemplate.
 */
export async function postCronJobTrigger(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<Record<string, unknown>> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/cronjobs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/trigger`;
  return backendRequest<Record<string, unknown>>(baseUrl, path, { method: 'POST' });
}

/**
 * POST /api/v1/clusters/{clusterId}/resources/jobs/{namespace}/{name}/retry
 * Creates a new Job with the same spec (retry).
 */
export async function postJobRetry(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<Record<string, unknown>> {
  const path = `clusters/${encodeURIComponent(clusterId)}/resources/jobs/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/retry`;
  return backendRequest<Record<string, unknown>>(baseUrl, path, { method: 'POST' });
}

/** Event shape from GET /api/v1/clusters/{clusterId}/events (matches backend models.Event). */
export interface BackendEvent {
  id: string;
  name: string;
  event_namespace: string;
  type: string;
  reason: string;
  message: string;
  resource_kind: string;
  resource_name: string;
  namespace: string;
  first_timestamp: string;
  last_timestamp: string;
  count: number;
  source_component?: string;
}

/**
 * GET /api/v1/clusters/{clusterId}/events — list events (namespace, limit).
 * Optional: involvedObjectKind + involvedObjectName for pod-scoped events.
 */
export async function getEvents(
  baseUrl: string,
  clusterId: string,
  params?: { namespace?: string; limit?: number }
): Promise<BackendEvent[]> {
  const search = new URLSearchParams();
  if (params?.namespace) search.set('namespace', params.namespace);
  if (params?.limit != null) search.set('limit', String(params.limit));
  const query = search.toString();
  const path = `clusters/${encodeURIComponent(clusterId)}/events${query ? `?${query}` : ''}`;
  return backendRequest<BackendEvent[]>(baseUrl, path);
}

/**
 * GET /api/v1/clusters/{clusterId}/events — resource-scoped events (e.g. pod).
 * Query: namespace, involvedObjectKind, involvedObjectName, limit (default 20).
 */
export async function getResourceEvents(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  kind: string,
  name: string,
  limit = 20
): Promise<BackendEvent[]> {
  const search = new URLSearchParams();
  search.set('namespace', namespace);
  search.set('involvedObjectKind', kind);
  search.set('involvedObjectName', name);
  search.set('limit', String(limit));
  const path = `clusters/${encodeURIComponent(clusterId)}/events?${search.toString()}`;
  return backendRequest<BackendEvent[]>(baseUrl, path);
}

/** Per-container metrics from pod metrics API. */
export interface BackendContainerMetrics {
  name: string;
  cpu: string;
  memory: string;
}

/** Pod metrics shape from GET /api/v1/clusters/{clusterId}/metrics/{namespace}/{pod}. */
export interface BackendPodMetrics {
  name: string;
  namespace: string;
  CPU: string;
  Memory: string;
  containers?: BackendContainerMetrics[];
}

/**
 * GET /api/v1/clusters/{clusterId}/metrics/{namespace}/{pod} — pod CPU/Memory from Metrics Server.
 */
export async function getPodMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  podName: string
): Promise<BackendPodMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}`;
  return backendRequest<BackendPodMetrics>(baseUrl, path);
}

/** Node metrics shape from GET /api/v1/clusters/{clusterId}/metrics/nodes/{nodeName}. */
export interface BackendNodeMetrics {
  name: string;
  CPU: string;
  Memory: string;
}

/**
 * GET /api/v1/clusters/{clusterId}/metrics/nodes/{nodeName} — node CPU/Memory from Metrics Server.
 */
export async function getNodeMetrics(
  baseUrl: string,
  clusterId: string,
  nodeName: string
): Promise<BackendNodeMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/nodes/${encodeURIComponent(nodeName)}`;
  return backendRequest<BackendNodeMetrics>(baseUrl, path);
}

/** Deployment metrics: aggregated + per-pod from GET .../metrics/{namespace}/deployment/{name}. */
export interface BackendDeploymentMetrics {
  deploymentName: string;
  namespace: string;
  podCount: number;
  totalCPU: string;
  totalMemory: string;
  pods: BackendPodMetrics[];
}

/**
 * GET /api/v1/clusters/{clusterId}/metrics/{namespace}/deployment/{name} — deployment aggregated pod metrics.
 */
export async function getDeploymentMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  deploymentName: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/deployment/${encodeURIComponent(deploymentName)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

/** Workload metrics use the same shape as deployment (aggregated + per-pod). */
export async function getReplicaSetMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/replicaset/${encodeURIComponent(name)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

export async function getStatefulSetMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/statefulset/${encodeURIComponent(name)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

export async function getDaemonSetMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/daemonset/${encodeURIComponent(name)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

export async function getJobMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/job/${encodeURIComponent(name)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

export async function getCronJobMetrics(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  name: string
): Promise<BackendDeploymentMetrics> {
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/${encodeURIComponent(namespace)}/cronjob/${encodeURIComponent(name)}`;
  return backendRequest<BackendDeploymentMetrics>(baseUrl, path);
}

/** Per-pod entry in unified metrics summary (backend sends lowercase cpu/memory). */
export interface BackendMetricsSummaryPod {
  name: string;
  namespace?: string;
  cpu: string;
  memory: string;
  containers?: BackendContainerMetrics[];
}

/** Unified metrics summary: one API for pod, node, deployment, replicaset, statefulset, daemonset, job, cronjob. */
export interface BackendMetricsSummary {
  cluster_id: string;
  namespace: string;
  resource_type: string;
  resource_name: string;
  total_cpu: string;
  total_memory: string;
  pod_count: number;
  pods?: BackendMetricsSummaryPod[];
  source?: string;
  warning?: string;
}

/** Response from GET .../metrics/summary. Always 200; use error_code for "no data" reasons (no silent failures). */
export interface BackendMetricsQueryResult {
  summary?: BackendMetricsSummary;
  error?: string;
  error_code?: string;
  query_ms?: number;
  cache_hit?: boolean;
}

/**
 * GET /api/v1/clusters/{clusterId}/metrics/summary?namespace=&resource_type=&resource_name=
 * Unified, resource-agnostic metrics. Use for all resource types (pod, node, deployment, replicaset, etc.).
 */
export async function getMetricsSummary(
  baseUrl: string,
  clusterId: string,
  params: { namespace?: string; resource_type: string; resource_name: string }
): Promise<BackendMetricsQueryResult> {
  const search = new URLSearchParams();
  if (params.namespace != null && params.namespace !== '') search.set('namespace', params.namespace);
  search.set('resource_type', params.resource_type);
  search.set('resource_name', params.resource_name);
  const path = `clusters/${encodeURIComponent(clusterId)}/metrics/summary?${search.toString()}`;
  return backendRequest<BackendMetricsQueryResult>(baseUrl, path);
}

/**
 * Returns the URL for GET /api/v1/clusters/{clusterId}/logs/{namespace}/{pod}.
 * Use with fetch() for streaming or non-streaming log read.
 */
export function getPodLogsUrl(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  pod: string,
  params?: { container?: string; tail?: number; follow?: boolean }
): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const search = new URLSearchParams();
  if (params?.container) search.set('container', params.container);
  if (params?.tail != null) search.set('tail', String(params.tail));
  if (params?.follow) search.set('follow', 'true');
  const query = search.toString();
  return `${normalizedBase}${API_PREFIX}/clusters/${encodeURIComponent(clusterId)}/logs/${encodeURIComponent(namespace)}/${encodeURIComponent(pod)}${query ? `?${query}` : ''}`;
}

/**
 * Returns the WebSocket URL for GET /api/v1/clusters/{clusterId}/pods/{namespace}/{name}/exec.
 * Converts http(s) baseUrl to ws(s). When baseUrl is empty (dev proxy), uses window.location.origin.
 */
export function getPodExecWebSocketUrl(
  baseUrl: string,
  clusterId: string,
  namespace: string,
  podName: string,
  params?: { container?: string; shell?: string }
): string {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '');
  let wsBase = normalizedBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  if (!wsBase && typeof window !== 'undefined') {
    wsBase = window.location.origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  }
  const search = new URLSearchParams();
  if (params?.container) search.set('container', params.container);
  if (params?.shell) search.set('shell', params.shell);
  const query = search.toString();
  return `${wsBase}${API_PREFIX}/clusters/${encodeURIComponent(clusterId)}/pods/${encodeURIComponent(namespace)}/${encodeURIComponent(podName)}/exec${query ? `?${query}` : ''}`;
}

/**
 * WebSocket URL for GET /api/v1/clusters/{clusterId}/shell/stream — full PTY cloud shell
 * (kubectl and any CLI with cluster KUBECONFIG set). Same protocol as pod exec: stdin, resize, stdout/stderr.
 * When baseUrl is empty (dev proxy), uses window.location.origin so the URL is absolute and the proxy is used.
 */
export function getKubectlShellStreamUrl(baseUrl: string, clusterId: string): string {
  const normalizedBase = (baseUrl || '').replace(/\/+$/, '');
  let wsBase = normalizedBase.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  if (!wsBase && typeof window !== 'undefined') {
    wsBase = window.location.origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  }
  return `${wsBase}${API_PREFIX}/clusters/${encodeURIComponent(clusterId)}/shell/stream`;
}

/** Response from POST /clusters/{clusterId}/shell */
export interface ShellCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * POST /api/v1/clusters/{clusterId}/shell — run a kubectl command (get, describe, logs, top, etc.) and return output.
 */
export async function postShellCommand(
  baseUrl: string,
  clusterId: string,
  command: string
): Promise<ShellCommandResult> {
  return backendRequest<ShellCommandResult>(baseUrl, `clusters/${encodeURIComponent(clusterId)}/shell`, {
    method: 'POST',
    body: JSON.stringify({ command: command.trim() }),
  });
}

/** Response from GET /api/v1/clusters/{clusterId}/shell/complete?line=... */
export interface ShellCompleteResult {
  completions: string[];
}

/**
 * GET /api/v1/clusters/{clusterId}/shell/complete?line=... — IDE-style kubectl completions (optional for dropdown).
 */
export async function getShellComplete(
  baseUrl: string,
  clusterId: string,
  line: string
): Promise<ShellCompleteResult> {
  const path = `clusters/${encodeURIComponent(clusterId)}/shell/complete`;
  const query = line ? `?line=${encodeURIComponent(line)}` : '';
  return backendRequest<ShellCompleteResult>(baseUrl, `${path}${query}`);
}

/**
 * Parse Content-Disposition header for filename (e.g. attachment; filename="kubeconfig-cluster.yaml").
 */
function parseContentDispositionFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";\n]+)"?/i) ||
    contentDisposition.match(/filename="?([^";\n]+)"?/i);
  return match ? match[1].trim() : null;
}

/**
 * GET /api/v1/clusters/{clusterId}/kubeconfig — returns kubeconfig YAML for the cluster (context-specific).
 * Returns blob and filename (from Content-Disposition when present) for download.
 */
export async function getClusterKubeconfig(
  baseUrl: string,
  clusterId: string
): Promise<{ blob: Blob; filename: string }> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const path = `clusters/${encodeURIComponent(clusterId)}/kubeconfig`;
  const url = `${normalizedBase}${API_PREFIX}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text();
    throw new BackendApiError(
      `Failed to get kubeconfig: ${response.status}${body ? ` - ${body}` : ''}`,
      response.status,
      body
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  const filename = parseContentDispositionFilename(disposition) || `kubeconfig-${clusterId}.yaml`;
  return { blob, filename };
}

/** Factory: create a client interface bound to a base URL (for hooks/pages). */
export function createBackendApiClient(baseUrl: string) {
  return {
    getClusters: () => getClusters(baseUrl),
    getClusterSummary: (clusterId: string) => getClusterSummary(baseUrl, clusterId),
    addCluster: (kubeconfigPath: string, context: string) =>
      addCluster(baseUrl, kubeconfigPath, context),
    getTopology: (clusterId: string, params?: Parameters<typeof getTopology>[2]) =>
      getTopology(baseUrl, clusterId, params),
    getResourceTopology: (clusterId: string, kind: string, namespace: string, name: string) =>
      getResourceTopology(baseUrl, clusterId, kind, namespace, name),
    getHealth: () => getHealth(baseUrl),
    listResources: (clusterId: string, kind: string, params?: Parameters<typeof listResources>[3]) =>
      listResources(baseUrl, clusterId, kind, params),
    getResource: (clusterId: string, kind: string, namespace: string, name: string) =>
      getResource(baseUrl, clusterId, kind, namespace, name),
    deleteResource: (cid: string, kind: string, ns: string, n: string) =>
      deleteResource(baseUrl, cid, kind, ns, n),
    applyManifest: (cid: string, yaml: string) => applyManifest(baseUrl, cid, yaml),
    getEvents: (clusterId: string, params?: Parameters<typeof getEvents>[2]) =>
      getEvents(baseUrl, clusterId, params),
    getResourceEvents: (clusterId: string, namespace: string, kind: string, name: string, limit?: number) =>
      getResourceEvents(baseUrl, clusterId, namespace, kind, name, limit),
    getPodMetrics: (clusterId: string, namespace: string, podName: string) =>
      getPodMetrics(baseUrl, clusterId, namespace, podName),
    getPodLogsUrl: (clusterId: string, namespace: string, pod: string, params?: Parameters<typeof getPodLogsUrl>[4]) =>
      getPodLogsUrl(baseUrl, clusterId, namespace, pod, params),
    getPodExecWebSocketUrl: (clusterId: string, namespace: string, podName: string, params?: Parameters<typeof getPodExecWebSocketUrl>[4]) =>
      getPodExecWebSocketUrl(baseUrl, clusterId, namespace, podName, params),
    postShellCommand: (clusterId: string, command: string) =>
      postShellCommand(baseUrl, clusterId, command),
  };
}
