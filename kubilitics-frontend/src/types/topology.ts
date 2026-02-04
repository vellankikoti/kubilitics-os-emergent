/**
 * Kubilitics Topology Types
 * Canonical graph model representing Kubernetes resources and relationships
 * Per PRD Part 3: Topology Rendering Engine specification
 */

// Kubernetes resource kinds
export type KubernetesKind =
  | 'Pod'
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'ReplicaSet'
  | 'Job'
  | 'CronJob'
  | 'Service'
  | 'Ingress'
  | 'ConfigMap'
  | 'Secret'
  | 'PersistentVolume'
  | 'PersistentVolumeClaim'
  | 'StorageClass'
  | 'Node'
  | 'Namespace'
  | 'ServiceAccount'
  | 'Role'
  | 'ClusterRole'
  | 'RoleBinding'
  | 'ClusterRoleBinding'
  | 'NetworkPolicy'
  | 'ResourceQuota'
  | 'LimitRange'
  | 'HorizontalPodAutoscaler'
  | 'Endpoints'
  | 'EndpointSlice';

// Resource status types
export type ResourceStatus =
  | 'Running'
  | 'Pending'
  | 'Failed'
  | 'Succeeded'
  | 'Terminating'
  | 'Unknown'
  | 'Ready'
  | 'NotReady'
  | 'Available'
  | 'Bound'
  | 'Released';

// Health indicator types
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * Canonical graph node representing a Kubernetes resource
 */
export interface TopologyNode {
  /** Unique identifier: `${kind}/${namespace}/${name}` or `${kind}/${name}` for cluster-scoped */
  id: string;

  /** Kubernetes resource kind */
  kind: KubernetesKind;

  /** Resource namespace (empty for cluster-scoped) */
  namespace: string;

  /** Resource name */
  name: string;

  /** API version */
  apiVersion: string;

  /** Current status for visual encoding */
  status: ResourceStatus;

  /** Additional metadata for rendering */
  metadata: {
    /** Labels for filtering */
    labels: Record<string, string>;
    /** Annotations */
    annotations: Record<string, string>;
    /** Creation timestamp */
    createdAt: string;
    /** UID */
    uid: string;
  };

  /** Computed properties */
  computed: {
    /** Health indicator */
    health: HealthStatus;
    /** Restart count (for pods) */
    restartCount?: number;
    /** Replica counts (for controllers) */
    replicas?: {
      desired: number;
      ready: number;
      available: number;
    };
  };

  /** Optional traffic percentage for visualization */
  traffic?: number;
}

/**
 * Relationship types between resources
 */
export type RelationshipType =
  | 'owns'        // OwnerReference
  | 'selects'     // Label selector (Service → Pod)
  | 'mounts'      // Volume mount
  | 'references'  // Field reference (pod.spec.nodeName)
  | 'configures'  // ConfigMap/Secret injection
  | 'permits'     // RBAC permission
  | 'validates'   // Admission webhook
  | 'mutates'     // Mutating webhook
  | 'exposes'     // Service exposure
  | 'routes'      // Ingress routing
  | 'stores'      // PVC → PV binding
  | 'schedules'   // Node scheduling
  | 'limits'      // ResourceQuota/LimitRange
  | 'manages'     // Helm/GitOps management
  | 'contains';   // Namespace containment

/**
 * Canonical graph edge representing a relationship
 */
export interface TopologyEdge {
  /** Unique identifier */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Relationship type */
  relationshipType: RelationshipType;

  /** Human-readable label */
  label: string;

  /** Relationship metadata */
  metadata: {
    /** How this relationship was discovered */
    derivation:
      | 'ownerReference'
      | 'labelSelector'
      | 'fieldReference'
      | 'volumeMount'
      | 'envReference'
      | 'rbacBinding'
      | 'admission'
      | 'helm'
      | 'gitops';
    /** Confidence level (1.0 = certain) */
    confidence: number;
    /** Source field in Kubernetes API */
    sourceField: string;
  };

  /** Optional traffic value for animation */
  traffic?: number;
}

/**
 * Graph warning (non-fatal issues)
 */
export interface GraphWarning {
  code: string;
  message: string;
  affectedNodes: string[];
}

/**
 * Complete topology graph
 */
export interface TopologyGraph {
  /** Schema version for compatibility */
  schemaVersion: string;

  /** Graph nodes */
  nodes: TopologyNode[];

  /** Graph edges */
  edges: TopologyEdge[];

  /** Graph metadata */
  metadata: {
    /** Cluster ID */
    clusterId: string;
    /** Generation timestamp */
    generatedAt: string;
    /** Layout seed for determinism */
    layoutSeed: string;
    /** Whether graph is complete (all relationships discovered) */
    isComplete: boolean;
    /** Any warnings during graph construction */
    warnings: GraphWarning[];
  };
}

/**
 * Layout seed information for deterministic rendering
 */
export interface LayoutSeedInfo {
  /** The seed value */
  seed: string;
  /** How the seed was derived */
  derivation: {
    /** Hash of node IDs */
    nodeHash: string;
    /** Hash of edge definitions */
    edgeHash: string;
    /** Timestamp of first graph generation */
    firstSeenAt: string;
  };
}

/**
 * Topology filter options
 */
export interface TopologyFilters {
  namespaces?: string[];
  kinds?: KubernetesKind[];
  healthStatuses?: HealthStatus[];
  labels?: Record<string, string>;
  searchQuery?: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf';

/**
 * Topology view state
 */
export interface TopologyViewState {
  zoom: number;
  pan: { x: number; y: number };
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  isPaused: boolean;
  showLabels: boolean;
  showNamespaces: boolean;
  filters: TopologyFilters;
}
