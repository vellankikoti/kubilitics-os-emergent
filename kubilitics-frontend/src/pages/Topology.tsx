/**
 * World-Class Topology Page
 * Full-screen cluster topology visualization with advanced filtering
 * Per Reference Design: Complete with resource filters, relationship toggles, layout controls
 */
import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Network, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useClusterStore } from '@/stores/clusterStore';
import { useBackendConfigStore } from '@/stores/backendConfigStore';
import { useTopologyFromBackend } from '@/hooks/useTopologyFromBackend';
import { useClusterTopologyGraph } from '@/hooks/useClusterTopologyGraph';
import { useNodeTopology } from '@/hooks/useNodeTopology';
import { useK8sResourceList } from '@/hooks/useKubernetes';
import {
  TopologyFilters,
  TopologyToolbar,
  resourceTypes,
} from '@/features/topology';
import { ClusterTopologyViewer, type ClusterTopologyViewerRef } from '@/components/topology/ClusterTopologyViewer';
import { TopologyViewer } from '@/components/resources';
import { ClusterInsightsPanel } from '@/components/topology/ClusterInsightsPanel';
import { ResourceDetailPanel } from '@/components/topology/ResourceDetailPanel';
import { BlastRadiusVisualization } from '@/components/topology/BlastRadiusVisualization';
import { NamespaceGroupedTopology } from '@/components/topology/NamespaceGroupedTopology';
import { useTopologyMetrics } from '@/hooks/useTopologyMetrics';
import { transformTopologyGraph } from '@/utils/topologyDataTransformer';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { TopologyGraph, TopologyNode as BackendTopologyNode, KubernetesKind, HealthStatus, RelationshipType } from '@/types/topology';
import type { TopologyNode } from '@/components/resources/D3ForceTopology';
import { BackendApiError } from '@/services/backendApiClient';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { parseSearchQuery, buildNavigationPath, findMatchingNode } from '@/utils/topologySearchParser';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// Comprehensive mock topology data
const mockGraph: TopologyGraph = {
  schemaVersion: '1.0',
  nodes: [
    // Namespaces
    { id: 'Namespace/blue-green-demo', kind: 'Namespace', namespace: '', name: 'blue-green-demo', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ns-1' }, computed: { health: 'healthy' } },
    
    // Nodes
    { id: 'Node/desktop-worker', kind: 'Node', namespace: '', name: 'desktop-worker', apiVersion: 'v1', status: 'Ready', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'node-1' }, computed: { health: 'healthy' } },
    
    // Deployments
    { id: 'Deployment/blue-green-demo/nginx', kind: 'Deployment', namespace: 'blue-green-demo', name: 'nginx-deployment', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } },
    { id: 'Deployment/blue-green-demo/api', kind: 'Deployment', namespace: 'blue-green-demo', name: 'api-gateway', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'dep-2' }, computed: { health: 'warning', replicas: { desired: 2, ready: 1, available: 1 } } },
    
    // ReplicaSets
    { id: 'ReplicaSet/blue-green-demo/nginx-rs', kind: 'ReplicaSet', namespace: 'blue-green-demo', name: 'nginx-rs-abc12', apiVersion: 'apps/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'rs-1' }, computed: { health: 'healthy', replicas: { desired: 3, ready: 3, available: 3 } } },
    
    // Pods
    { id: 'Pod/blue-green-demo/nginx-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-abc12', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-1' }, computed: { health: 'healthy', restartCount: 0 } },
    { id: 'Pod/blue-green-demo/nginx-2', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-def34', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-2' }, computed: { health: 'healthy', restartCount: 0 } },
    { id: 'Pod/blue-green-demo/nginx-3', kind: 'Pod', namespace: 'blue-green-demo', name: 'nginx-ghi56', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-3' }, computed: { health: 'warning', restartCount: 2 } },
    { id: 'Pod/blue-green-demo/api-1', kind: 'Pod', namespace: 'blue-green-demo', name: 'api-jkl78', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pod-4' }, computed: { health: 'healthy', restartCount: 0 } },
    
    // Services
    { id: 'Service/blue-green-demo/nginx-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'nginx-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-1' }, computed: { health: 'healthy' } },
    { id: 'Service/blue-green-demo/api-svc', kind: 'Service', namespace: 'blue-green-demo', name: 'api-svc', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'svc-2' }, computed: { health: 'healthy' } },
    
    // ConfigMap & Secret
    { id: 'ConfigMap/blue-green-demo/nginx-config', kind: 'ConfigMap', namespace: 'blue-green-demo', name: 'nginx-config', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'cm-1' }, computed: { health: 'healthy' } },
    { id: 'Secret/blue-green-demo/api-secrets', kind: 'Secret', namespace: 'blue-green-demo', name: 'api-secrets', apiVersion: 'v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sec-1' }, computed: { health: 'healthy' } },
    
    // Ingress
    { id: 'Ingress/blue-green-demo/main-ingress', kind: 'Ingress', namespace: 'blue-green-demo', name: 'todo-ingress', apiVersion: 'networking.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'ing-1' }, computed: { health: 'healthy' } },
    
    // PVs and PVCs
    { id: 'PersistentVolume/pv-test-001', kind: 'PersistentVolume', namespace: '', name: 'pv-test-001', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-1' }, computed: { health: 'healthy' } },
    { id: 'PersistentVolume/pv-test-002', kind: 'PersistentVolume', namespace: '', name: 'pv-test-002', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-2' }, computed: { health: 'healthy' } },
    { id: 'PersistentVolume/pv-test-003', kind: 'PersistentVolume', namespace: '', name: 'pv-test-003', apiVersion: 'v1', status: 'Available', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pv-3' }, computed: { health: 'warning' } },
    { id: 'PersistentVolumeClaim/blue-green-demo/data-pvc', kind: 'PersistentVolumeClaim', namespace: 'blue-green-demo', name: 'data-pvc', apiVersion: 'v1', status: 'Bound', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'pvc-1' }, computed: { health: 'healthy' } },
    
    // StorageClasses
    { id: 'StorageClass/hostpath', kind: 'StorageClass', namespace: '', name: 'hostpath', apiVersion: 'storage.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sc-1' }, computed: { health: 'healthy' } },
    { id: 'StorageClass/standard', kind: 'StorageClass', namespace: '', name: 'standard', apiVersion: 'storage.k8s.io/v1', status: 'Running', metadata: { labels: {}, annotations: {}, createdAt: '2024-01-01', uid: 'sc-2' }, computed: { health: 'healthy' } },
  ],
  edges: [
    // Namespace contains resources
    { id: 'e-ns-dep1', source: 'Namespace/blue-green-demo', target: 'Deployment/blue-green-demo/nginx', relationshipType: 'contains', label: 'contains', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'metadata.namespace' } },
    { id: 'e-ns-dep2', source: 'Namespace/blue-green-demo', target: 'Deployment/blue-green-demo/api', relationshipType: 'contains', label: 'contains', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'metadata.namespace' } },
    
    // Deployment owns ReplicaSet
    { id: 'e-dep-rs', source: 'Deployment/blue-green-demo/nginx', target: 'ReplicaSet/blue-green-demo/nginx-rs', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // ReplicaSet owns Pods
    { id: 'e-rs-pod1', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod2', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    { id: 'e-rs-pod3', source: 'ReplicaSet/blue-green-demo/nginx-rs', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // Deployment owns Pod (API)
    { id: 'e-dep-pod4', source: 'Deployment/blue-green-demo/api', target: 'Pod/blue-green-demo/api-1', relationshipType: 'owns', label: 'owns', metadata: { derivation: 'ownerReference', confidence: 1, sourceField: 'metadata.ownerReferences' } },
    
    // Service selects Pods
    { id: 'e-svc-pod1', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-1', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod2', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-2', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod3', source: 'Service/blue-green-demo/nginx-svc', target: 'Pod/blue-green-demo/nginx-3', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    { id: 'e-svc-pod4', source: 'Service/blue-green-demo/api-svc', target: 'Pod/blue-green-demo/api-1', relationshipType: 'selects', label: 'selects', metadata: { derivation: 'labelSelector', confidence: 1, sourceField: 'spec.selector' } },
    
    // Ingress routes to Services
    { id: 'e-ing-svc1', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/nginx-svc', relationshipType: 'routes', label: 'routes', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    { id: 'e-ing-svc2', source: 'Ingress/blue-green-demo/main-ingress', target: 'Service/blue-green-demo/api-svc', relationshipType: 'routes', label: 'routes', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.rules' } },
    
    // Deployment uses ConfigMap/Secret
    { id: 'e-dep-cm', source: 'Deployment/blue-green-demo/nginx', target: 'ConfigMap/blue-green-demo/nginx-config', relationshipType: 'configures', label: 'uses', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.volumes' } },
    { id: 'e-dep-sec', source: 'Deployment/blue-green-demo/api', target: 'Secret/blue-green-demo/api-secrets', relationshipType: 'configures', label: 'uses', metadata: { derivation: 'envReference', confidence: 1, sourceField: 'spec.template.spec.containers[].envFrom' } },
    
    // Pods scheduled on Node
    { id: 'e-pod-node1', source: 'Pod/blue-green-demo/nginx-1', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node2', source: 'Pod/blue-green-demo/nginx-2', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node3', source: 'Pod/blue-green-demo/nginx-3', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    { id: 'e-pod-node4', source: 'Pod/blue-green-demo/api-1', target: 'Node/desktop-worker', relationshipType: 'schedules', label: 'runs on', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.nodeName' } },
    
    // PVC binds to PV
    { id: 'e-pvc-pv', source: 'PersistentVolumeClaim/blue-green-demo/data-pvc', target: 'PersistentVolume/pv-test-001', relationshipType: 'stores', label: 'binds', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.volumeName' } },
    
    // StorageClass provisions PVs
    { id: 'e-sc-pv1', source: 'StorageClass/hostpath', target: 'PersistentVolume/pv-test-001', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    { id: 'e-sc-pv2', source: 'StorageClass/standard', target: 'PersistentVolume/pv-test-002', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    { id: 'e-sc-pv3', source: 'StorageClass/standard', target: 'PersistentVolume/pv-test-003', relationshipType: 'owns', label: 'provisions', metadata: { derivation: 'fieldReference', confidence: 1, sourceField: 'spec.storageClassName' } },
    
    // Pod mounts PVC
    { id: 'e-pod-pvc', source: 'Pod/blue-green-demo/nginx-1', target: 'PersistentVolumeClaim/blue-green-demo/data-pvc', relationshipType: 'mounts', label: 'mounts', metadata: { derivation: 'volumeMount', confidence: 1, sourceField: 'spec.volumes' } },
  ],
  metadata: {
    clusterId: 'docker-desktop',
    generatedAt: new Date().toISOString(),
    layoutSeed: 'deterministic-seed-123',
    isComplete: true,
    warnings: [],
  },
};

export default function Topology() {
  const { activeCluster } = useClusterStore();
  const isBackendConfigured = useBackendConfigStore((s) => s.isBackendConfigured());
  const currentClusterId = useBackendConfigStore((s) => s.currentClusterId);
  const clusterId = activeCluster?.id ?? currentClusterId;
  
  const navigate = useNavigate();
  const topologyViewerRef = useRef<ClusterTopologyViewerRef>(null);
  const queryClient = useQueryClient();
  const [selectedNodeForDetail, setSelectedNodeForDetail] = useState<TopologyNode | null>(null);
  const [showBlastRadius, setShowBlastRadius] = useState(false);

  // View state - MUST be declared before useMemo/useEffect that use them
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [selectedNodeFilter, setSelectedNodeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useDemoGraph, setUseDemoGraph] = useState(false);

  // Namespace filter: when user selects a namespace from dropdown, filter immediately (no view mode coupling)
  const namespaceFilter = useMemo(() => {
    if (selectedNamespace && selectedNamespace !== 'all') {
      return selectedNamespace;
    }
    return undefined;
  }, [selectedNamespace]);

  // Backend topology (when available)
  const topologyFromBackend = useTopologyFromBackend(
    isBackendConfigured ? clusterId : null,
    { namespace: namespaceFilter }
  );

  // Frontend-built topology (fallback when backend unavailable)
  const frontendTopology = useClusterTopologyGraph(namespaceFilter);

  // Nodes list for node filter dropdown
  const { data: nodesList } = useK8sResourceList('nodes', undefined, { enabled: !!activeCluster });
  const availableNodes = useMemo(() => {
    const items = nodesList?.items ?? [];
    return items.map((n: any) => n.metadata?.name).filter(Boolean) as string[];
  }, [nodesList]);

  // Node-specific topology (when node filter is selected)
  const nodeTopology = useNodeTopology(selectedNodeFilter || undefined);

  // Filter state
  const [selectedResources, setSelectedResources] = useState<Set<KubernetesKind>>(
    new Set(resourceTypes.map((r) => r.kind))
  );
  const [selectedRelationships, setSelectedRelationships] = useState<Set<RelationshipType>>(
    new Set(['owns', 'selects', 'schedules', 'routes', 'configures', 'mounts', 'stores', 'contains', 'references'])
  );
  const [selectedHealth, setSelectedHealth] = useState<Set<HealthStatus | 'pending'>>(
    new Set(['healthy', 'warning', 'critical', 'unknown'])
  );

  // Detect if only namespace filter is selected
  const isNamespaceOnlyFilter = useMemo(() => {
    return selectedResources.size === 1 && selectedResources.has('Namespace');
  }, [selectedResources]);

  // Convert selectedResources to Set<string> for ClusterTopologyViewer
  const selectedResourcesSet = useMemo(() => {
    return new Set(Array.from(selectedResources).map(k => k.toString()));
  }, [selectedResources]);

  // Convert selectedHealth to Set<string> for ClusterTopologyViewer
  const selectedHealthSet = useMemo(() => {
    return new Set(Array.from(selectedHealth).map(h => h.toString()));
  }, [selectedHealth]);

  // Selected node state (using TopologyNode from D3ForceTopology)
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [centeredNodeId, setCenteredNodeId] = useState<string | undefined>();

  // Graph: when backend is configured and clusterId set, use only backend data (no mock).
  // Mock is used only when backend is not configured (demo/offline).
  const emptyGraph: TopologyGraph = useMemo(
    () => ({
      schemaVersion: '1.0',
      nodes: [],
      edges: [],
      metadata: { nodeCount: 0, edgeCount: 0, layoutSeed: '', isComplete: true, warnings: [] },
    }),
    []
  );
  // Build final graph: prefer backend, fallback to frontend-built, then mock
  const graph: TopologyGraph = useMemo(() => {
    if (useDemoGraph && !isBackendConfigured) return mockGraph;
    if (isBackendConfigured && clusterId && topologyFromBackend.data) {
      return topologyFromBackend.data;
    }
    // Use frontend-built topology when backend unavailable
    if (frontendTopology.nodes.length > 0 || frontendTopology.edges.length > 0) {
      return {
        schemaVersion: '1.0',
        nodes: frontendTopology.nodes,
        edges: frontendTopology.edges,
        metadata: {
          clusterId: clusterId || '',
          generatedAt: new Date().toISOString(),
          layoutSeed: `frontend-${Date.now()}`,
          isComplete: true,
          warnings: [],
        },
      };
    }
    return emptyGraph;
  }, [
    useDemoGraph,
    isBackendConfigured,
    clusterId,
    topologyFromBackend.data,
    frontendTopology.nodes,
    frontendTopology.edges,
    emptyGraph,
  ]);

  // Transform graph for TopologyViewer
  const { nodes: transformedNodes, edges: transformedEdges } = useMemo(() => {
    return transformTopologyGraph(graph, undefined, activeCluster?.name);
  }, [graph, activeCluster?.name]);

  // For namespace-grouped view, we need all nodes (not filtered by resource type)
  // So we use transformedNodes directly instead of filtered nodes

  // Fetch metrics
  const { metrics, isLoading: metricsLoading } = useTopologyMetrics(transformedNodes, {
    enabled: true,
    refetchInterval: 30_000,
  });

  // Namespaces from API - available immediately (like nodes), no topology dependency
  const { data: namespacesList } = useK8sResourceList('namespaces', undefined, { enabled: !!activeCluster });
  const availableNamespaces = useMemo(() => {
    const items = namespacesList?.items ?? [];
    return items.map((n: any) => n.metadata?.name).filter(Boolean) as string[];
  }, [namespacesList]);

  const handleResourceToggle = useCallback((kind: KubernetesKind) => {
    setSelectedResources(prev => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleRelationshipToggle = useCallback((type: RelationshipType) => {
    setSelectedRelationships(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleHealthToggle = useCallback((status: HealthStatus | 'pending') => {
    setSelectedHealth(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  const handleSelectAllResources = useCallback(() => {
    setSelectedResources(new Set(resourceTypes.map(r => r.kind)));
  }, []);

  const handleClearAllResources = useCallback(() => {
    setSelectedResources(new Set());
  }, []);

  const handlePresetFilter = useCallback((preset: 'workloads' | 'networking' | 'storage' | 'security') => {
    const presetMap = {
      workloads: new Set<KubernetesKind>(['Deployment', 'ReplicaSet', 'StatefulSet', 'DaemonSet', 'Pod', 'Job', 'CronJob']),
      networking: new Set<KubernetesKind>(['Service', 'Ingress', 'Endpoints', 'EndpointSlice', 'NetworkPolicy']),
      storage: new Set<KubernetesKind>(['PersistentVolumeClaim', 'PersistentVolume', 'StorageClass']),
      security: new Set<KubernetesKind>(['ServiceAccount', 'Role', 'ClusterRole', 'RoleBinding', 'ClusterRoleBinding', 'NetworkPolicy', 'Secret']),
    };
    setSelectedResources(presetMap[preset]);
    toast.success(`Applied ${preset} filter`);
  }, []);

  const handleNodeSelect = useCallback((node: TopologyNode | null) => {
    setSelectedNode(node);
    setSelectedNodeForDetail(node);
  }, []);

  const handleNodeClick = useCallback((node: TopologyNode) => {
    handleNodeSelect(node);
  }, [handleNodeSelect]);

  const handleNodeDoubleClick = useCallback((node: TopologyNode) => {
    const original = (node as any)._original as BackendTopologyNode | undefined;
    if (!original) return;

    const routeMap: Record<string, string> = {
      Pod: 'pods',
      Deployment: 'deployments',
      ReplicaSet: 'replicasets',
      StatefulSet: 'statefulsets',
      DaemonSet: 'daemonsets',
      Service: 'services',
      ConfigMap: 'configmaps',
      Secret: 'secrets',
      Ingress: 'ingresses',
      Node: 'nodes',
      Namespace: 'namespaces',
      PersistentVolume: 'persistentvolumes',
      PersistentVolumeClaim: 'persistentvolumeclaims',
      StorageClass: 'storageclasses',
      Job: 'jobs',
      CronJob: 'cronjobs',
    };
    const route = routeMap[original.kind];
    if (route) {
      if (original.namespace) {
        navigate(`/${route}/${original.namespace}/${original.name}`);
      } else {
        navigate(`/${route}/${original.name}`);
      }
    }
  }, [navigate]);

  const handleExport = useCallback((format: 'png' | 'svg' | 'pdf') => {
    if (!topologyViewerRef.current) return;
    
    topologyViewerRef.current.exportAsPng();
    toast.success(`Exported as ${format.toUpperCase()}`);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isBackendConfigured && clusterId) {
        await topologyFromBackend.refetch();
      } else {
        // Invalidate all K8s resource queries to refresh frontend topology
        queryClient.invalidateQueries({ queryKey: ['k8s'] });
        queryClient.invalidateQueries({ queryKey: ['backend', 'resources', clusterId] });
        // Wait a bit for queries to refetch
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      toast.success('Topology refreshed');
    } catch (error) {
      toast.error('Failed to refresh topology');
    } finally {
      setIsRefreshing(false);
    }
  }, [isBackendConfigured, clusterId, topologyFromBackend, queryClient]);


  // Search-based navigation handler
  const handleSearchSubmit = useCallback((query: string) => {
    if (!query.trim()) return;

    const parsed = parseSearchQuery(query);
    
    // First, try to find matching node in current graph
    const matchingNode = findMatchingNode(
      graph.nodes.map(n => ({ id: n.id, kind: n.kind, name: n.name, namespace: n.namespace })),
      parsed
    );
    if (matchingNode) {
      // Center/highlight the node
      const transformedNode = transformedNodes.find(n => n.id === matchingNode.id);
      if (transformedNode) {
        topologyViewerRef.current?.centerOnNode(matchingNode.id);
        handleNodeClick(transformedNode);
        toast.success(`Found ${matchingNode.kind}: ${matchingNode.name}`);
      }
      return;
    }

    // If no match in graph, try to navigate to resource detail page
    const navPath = buildNavigationPath(parsed);
    if (navPath) {
      navigate(navPath);
      toast.success(`Navigating to ${parsed.type || 'resource'}: ${parsed.name}`);
    } else {
      toast.info(`No matching resource found for "${query}"`);
    }
  }, [graph.nodes, navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (inInput) return;

      // F - Focus search (would need search input ref, skip for now)
      // R - Reset view
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        topologyViewerRef.current?.resetView();
        return;
      }
      // Esc - Clear selection
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setSelectedNodeForDetail(null);
        setShowBlastRadius(false);
        return;
      }
      // B - Toggle blast radius
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (selectedNodeForDetail) {
          setShowBlastRadius(!showBlastRadius);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Network className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cluster Topology</h1>
          <p className="text-sm text-muted-foreground">
            {selectedNamespace === 'all' 
              ? `Complete cluster view • ${activeCluster?.name || 'docker-desktop'}`
              : `Namespace: ${selectedNamespace} • ${activeCluster?.name || 'docker-desktop'}`}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <TopologyToolbar
        selectedNamespace={selectedNamespace}
        namespaces={availableNamespaces}
        onNamespaceChange={setSelectedNamespace}
        selectedNode={selectedNodeFilter}
        nodes={availableNodes}
        onNodeChange={setSelectedNodeFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        onExport={handleExport}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        className="flex-shrink-0"
      />

      {/* Filters */}
      <TopologyFilters
        selectedResources={selectedResources}
        onResourceToggle={handleResourceToggle}
        selectedRelationships={selectedRelationships}
        onRelationshipToggle={handleRelationshipToggle}
        selectedHealth={selectedHealth}
        onHealthToggle={handleHealthToggle}
        onSelectAll={handleSelectAllResources}
        onClearAll={handleClearAllResources}
        onPresetFilter={handlePresetFilter}
        className="flex-shrink-0 bg-card/50 p-4 rounded-xl border border-border"
      />

      {/* Topology loading / error */}
      {(selectedNodeFilter
        ? nodeTopology.isLoading && !nodeTopology.nodes.length
        : (isBackendConfigured && clusterId ? topologyFromBackend.isLoading : frontendTopology.isLoading) && !graph.nodes.length) && (
        <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Building topology…</span>
        </div>
      )}
      {isBackendConfigured && clusterId && (
        <>
          {topologyFromBackend.error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-sm text-destructive">
                  {topologyFromBackend.error instanceof Error
                    ? topologyFromBackend.error.message
                    : 'Failed to load topology'}
                </span>
                <div className="flex items-center gap-2">
                  {topologyFromBackend.error instanceof BackendApiError && [404, 403, 503, 504].includes(topologyFromBackend.error.status) && (
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <Link to="/setup/clusters">
                        <ArrowLeft className="h-4 w-4" />
                        Back to cluster list
                      </Link>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => topologyFromBackend.refetch()}
                    disabled={topologyFromBackend.isFetching}
                  >
                    Retry
                  </Button>
                </div>
              </div>
              {topologyFromBackend.error instanceof BackendApiError && (
                <p className="text-xs text-muted-foreground">
                  {topologyFromBackend.error.status > 0 && <>Status: {topologyFromBackend.error.status}. </>}
                  {topologyFromBackend.error.requestId && (
                    <>Request ID: <code className="bg-muted px-1 rounded">{topologyFromBackend.error.requestId}</code> (for support)</>
                  )}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Empty state when no cluster connection */}
      {!activeCluster && !clusterId && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <Network className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Connect to a cluster to view topology.</p>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/setup/clusters">
              <ArrowLeft className="h-4 w-4" />
              Select cluster
            </Link>
          </Button>
        </div>
      )}

      {/* Empty state when no topology data available */}
      {activeCluster && !selectedNode && graph.nodes.length === 0 && !frontendTopology.isLoading && !topologyFromBackend.isLoading && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center min-h-[200px]">
          <Network className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            {selectedResources.size === 0 
              ? 'No resources selected. Use filters to show resources.'
              : 'No topology data available for the current filters.'}
          </p>
          {selectedResources.size === 0 && (
            <Button variant="outline" onClick={handleSelectAllResources}>
              Show All Resources
            </Button>
          )}
        </div>
      )}

      {/* Empty state when node selected but no pods on that node */}
      {activeCluster && selectedNodeFilter && !nodeTopology.isLoading && nodeTopology.nodes.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/30 p-8 text-center min-h-[200px]">
          <Network className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No pods running on node {selectedNodeFilter}.</p>
        </div>
      )}

      {/* Canvas Container — flows with content, page scrolls (like NodeDetail topology) */}
      {activeCluster && (graph.nodes.length > 0 || (selectedNodeFilter && nodeTopology.nodes.length > 0)) && (
        <div className="min-h-[60vh] w-full">
          {(selectedNodeFilter
            ? // Node-specific topology (same as NodeDetail tab)
              nodeTopology.nodes.length > 0 && (
                <div className="w-full min-h-[60vh]">
                  <TopologyViewer
                    nodes={nodeTopology.nodes}
                    edges={nodeTopology.edges}
                    onNodeClick={(node) => {
                      handleNodeClick(node);
                      setSelectedNodeForDetail(node);
                    }}
                    scrollWithPage={true}
                    className="w-full rounded-xl border border-border bg-card"
                  />
                </div>
              )
            : (isBackendConfigured && clusterId ? topologyFromBackend.isLoading : frontendTopology.isLoading) && !graph.nodes.length
              ? null
              : (() => {
                  if (isNamespaceOnlyFilter) {
                    return (
                      <NamespaceGroupedTopology
                        nodes={transformedNodes}
                        edges={transformedEdges}
                        onNodeClick={(node) => {
                          handleNodeClick(node);
                          setSelectedNodeForDetail(node);
                        }}
                        className="w-full min-h-[600px]"
                      />
                    );
                  }
                  return (
                    <ClusterTopologyViewer
                      ref={topologyViewerRef}
                      graph={graph}
                      selectedResources={selectedResourcesSet}
                      selectedHealth={selectedHealthSet}
                      selectedRelationships={new Set(Array.from(selectedRelationships).map(r => r.toString()))}
                      searchQuery={searchQuery}
                      namespace={namespaceFilter}
                      onNodeClick={handleNodeClick}
                      onNodeDoubleClick={handleNodeDoubleClick}
                      showMetrics={true}
                      showInsights={true}
                      layoutMode="hierarchical"
                      scrollWithPage={true}
                      className="w-full"
                    />
                  );
                })())}
          {/* Large-graph notice */}
          {graph.nodes.length > 1000 && (
            <div className="absolute top-4 left-4 max-w-sm rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 text-xs text-muted-foreground shadow z-30">
              Large graph: {graph.nodes.length} nodes. Use namespace or filters for smoother interaction.
            </div>
          )}
          {/* Layout controls removed - handled by ClusterTopologyViewer */}
          {/* Resource Detail Panel */}
          <ResourceDetailPanel
            node={selectedNodeForDetail}
            edges={transformedEdges}
            metrics={metrics}
            onClose={() => {
              setSelectedNodeForDetail(null);
              setShowBlastRadius(false);
            }}
            onNavigate={(node) => {
              handleNodeDoubleClick(node);
            }}
            onShowBlastRadius={() => {
              if (selectedNodeForDetail) {
                setShowBlastRadius(true);
              }
            }}
          />

          {/* Blast Radius Visualization */}
          {showBlastRadius && selectedNodeForDetail && (
            <BlastRadiusVisualization
              selectedNodeId={selectedNodeForDetail.id}
              nodes={transformedNodes}
              edges={transformedEdges}
              onNodeClick={handleNodeClick}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
