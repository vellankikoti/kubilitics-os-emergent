# Kubilitics Backend Engineering Blueprint
## Parts 2 & 3: Topology Engine & API Contracts (Summary)

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Status:** Implementation Guide

---

## Part 2: Topology Engine Implementation

### 2.1 Topology Engine Architecture

**File**: `internal/topology/engine.go`

The topology engine is the core system that:
1. Discovers all Kubernetes resources
2. Infers relationships between resources
3. Builds a canonical graph
4. Validates graph completeness
5. Generates deterministic layout seeds
6. Exports topology for UI and PDF

**Key Requirements** (from topology_engine_prd.md):
- **Exhaustive Discovery**: Must discover ALL resources (50+ types + CRDs)
- **Complete Relationships**: No partial graphs allowed
- **Deterministic Layout**: Same graph → same positions every time
- **WYSIWYG Export**: UI and PDF must be identical
- **Performance**: Handle 10,000+ nodes in <2s

### 2.2 Graph Builder Implementation

```go
// internal/topology/builder.go
package topology

type GraphBuilder struct {
    k8sClient *k8s.Client
    discovered map[string]bool
}

func (gb *GraphBuilder) BuildGraph(ctx context.Context, filters TopologyFilters) (*Graph, error) {
    graph := NewGraph()

    // Phase 1: Discover all resources
    resources, err := gb.discoverAllResources(ctx, filters)
    if err != nil {
        return nil, err
    }

    // Phase 2: Create nodes
    for _, resource := range resources {
        node := gb.createNode(resource)
        graph.AddNode(node)
    }

    // Phase 3: Infer relationships
    relationships := gb.inferRelationships(resources)
    for _, rel := range relationships {
        edge := gb.createEdge(rel)
        graph.AddEdge(edge)
    }

    // Phase 4: Validate completeness
    if err := gb.validateGraph(graph); err != nil {
        return nil, fmt.Errorf("graph validation failed: %w", err)
    }

    // Phase 5: Generate layout seed
    graph.LayoutSeed = gb.generateLayoutSeed(graph)

    return graph, nil
}
```

**Discovery Mechanisms to Implement**:
1. **OwnerReferences**: Pod → ReplicaSet → Deployment
2. **Label Selectors**: Service → Pods, Deployment → ReplicaSet
3. **Field References**: Pod.Spec.NodeName → Node
4. **Volume Mounts**: Pod → ConfigMap/Secret/PVC
5. **Env References**: Pod → ConfigMap/Secret (valueFrom)
6. **RBAC Bindings**: RoleBinding → ServiceAccount → Pod
7. **Network Policies**: NetworkPolicy → Pods (via selectors)
8. **Admission Webhooks**: Webhook → affected resources

### 2.3 Relationship Inference Logic

**File**: `internal/topology/relationships.go`

**Pod-Centric Relationships** (Example):
```go
func (gb *GraphBuilder) inferPodRelationships(pod *v1.Pod, graph *Graph) {
    // Owner relationships
    for _, owner := range pod.OwnerReferences {
        graph.AddEdge(Edge{
            Source: owner.UID,
            Target: pod.UID,
            Type:   "owner",
            Label:  "owns",
        })
    }

    // Node relationship
    if pod.Spec.NodeName != "" {
        nodeID := findNodeByName(graph, pod.Spec.NodeName)
        graph.AddEdge(Edge{
            Source: nodeID,
            Target: pod.UID,
            Type:   "placement",
            Label:  "runs on",
        })
    }

    // Service relationships (via label matching)
    services := findServicesMatchingLabels(graph, pod.Labels)
    for _, svc := range services {
        graph.AddEdge(Edge{
            Source: svc.UID,
            Target: pod.UID,
            Type:   "selector",
            Label:  "targets",
        })
    }

    // ConfigMap/Secret relationships
    for _, volume := range pod.Spec.Volumes {
        if volume.ConfigMap != nil {
            cmID := findConfigMapByName(graph, pod.Namespace, volume.ConfigMap.Name)
            graph.AddEdge(Edge{
                Source: pod.UID,
                Target: cmID,
                Type:   "volume",
                Label:  "mounts",
            })
        }
        if volume.Secret != nil {
            secretID := findSecretByName(graph, pod.Namespace, volume.Secret.SecretName)
            graph.AddEdge(Edge{
                Source: pod.UID,
                Target: secretID,
                Type:   "volume",
                Label:  "mounts",
            })
        }
    }

    // PVC relationships
    for _, volume := range pod.Spec.Volumes {
        if volume.PersistentVolumeClaim != nil {
            pvcID := findPVCByName(graph, pod.Namespace, volume.PersistentVolumeClaim.ClaimName)
            graph.AddEdge(Edge{
                Source: pod.UID,
                Target: pvcID,
                Type:   "volume",
                Label:  "claims",
            })

            // Follow PVC → PV
            pvc := getPVC(graph, pvcID)
            if pvc.Spec.VolumeName != "" {
                pvID := findPVByName(graph, pvc.Spec.VolumeName)
                graph.AddEdge(Edge{
                    Source: pvcID,
                    Target: pvID,
                    Type:   "volume",
                    Label:  "bound to",
                })
            }
        }
    }

    // Environment variable references
    for _, container := range pod.Spec.Containers {
        for _, env := range container.Env {
            if env.ValueFrom != nil {
                if env.ValueFrom.ConfigMapKeyRef != nil {
                    cmID := findConfigMapByName(graph, pod.Namespace, env.ValueFrom.ConfigMapKeyRef.Name)
                    graph.AddEdge(Edge{
                        Source: pod.UID,
                        Target: cmID,
                        Type:   "env",
                        Label:  "reads env from",
                    })
                }
                if env.ValueFrom.SecretKeyRef != nil {
                    secretID := findSecretByName(graph, pod.Namespace, env.ValueFrom.SecretKeyRef.Name)
                    graph.AddEdge(Edge{
                        Source: pod.UID,
                        Target: secretID,
                        Type:   "env",
                        Label:  "reads env from",
                    })
                }
            }
        }
    }

    // ServiceAccount relationship
    if pod.Spec.ServiceAccountName != "" {
        saID := findServiceAccountByName(graph, pod.Namespace, pod.Spec.ServiceAccountName)
        graph.AddEdge(Edge{
            Source: pod.UID,
            Target: saID,
            Type:   "security",
            Label:  "uses",
        })
    }
}
```

**CRITICAL**: Repeat this pattern for all 50+ resource types.

### 2.4 Graph Validation

**File**: `internal/topology/validator.go`

```go
func (gb *GraphBuilder) validateGraph(graph *Graph) error {
    // Rule 1: All nodes must have at least one relationship (except orphans)
    orphans := graph.FindOrphanNodes()
    if len(orphans) > 0 {
        // This is OK for some resources (e.g., Namespaces), but warn
        log.Warnf("Found %d orphan nodes", len(orphans))
    }

    // Rule 2: All edges must reference valid nodes
    for _, edge := range graph.Edges {
        if !graph.HasNode(edge.Source) || !graph.HasNode(edge.Target) {
            return fmt.Errorf("edge %s references invalid node", edge.ID)
        }
    }

    // Rule 3: No duplicate edges
    edgeSet := make(map[string]bool)
    for _, edge := range graph.Edges {
        key := fmt.Sprintf("%s-%s-%s", edge.Source, edge.Target, edge.Type)
        if edgeSet[key] {
            return fmt.Errorf("duplicate edge: %s", key)
        }
        edgeSet[key] = true
    }

    // Rule 4: Graph closure (transitive relationships must be complete)
    if err := gb.validateClosure(graph); err != nil {
        return fmt.Errorf("graph closure validation failed: %w", err)
    }

    return nil
}

func (gb *GraphBuilder) validateClosure(graph *Graph) error {
    // For each Pod, ensure all transitive relationships are present
    pods := graph.GetNodesByType("Pod")
    for _, pod := range pods {
        // Pod → PVC → PV → StorageClass → CSI Driver
        // All of these must be in the graph
        if !gb.hasPVCPath(graph, pod) {
            return fmt.Errorf("pod %s missing PVC path", pod.Name)
        }
    }

    return nil
}
```

### 2.5 Deterministic Layout

**File**: `internal/topology/layout.go`

```go
type LayoutSeed struct {
    Algorithm string             `json:"algorithm"`
    Seed      int64              `json:"seed"`
    Positions map[string]Point2D `json:"positions"`
}

func (gb *GraphBuilder) generateLayoutSeed(graph *Graph) *LayoutSeed {
    // Generate deterministic seed based on graph hash
    seed := gb.graphHash(graph)

    // Pre-compute positions for deterministic layout
    positions := make(map[string]Point2D)

    // Use deterministic algorithm (e.g., force-directed with fixed seed)
    layout := NewForceDirectedLayout(seed)
    positions = layout.Compute(graph)

    return &LayoutSeed{
        Algorithm: "cola",
        Seed:      seed,
        Positions: positions,
    }
}

func (gb *GraphBuilder) graphHash(graph *Graph) int64 {
    // Create stable hash from node IDs and edge IDs
    h := fnv.New64a()

    // Sort nodes by ID for stability
    nodeIDs := make([]string, 0, len(graph.Nodes))
    for id := range graph.Nodes {
        nodeIDs = append(nodeIDs, id)
    }
    sort.Strings(nodeIDs)

    for _, id := range nodeIDs {
        h.Write([]byte(id))
    }

    return int64(h.Sum64())
}
```

### 2.6 Export Service

**File**: `internal/service/export_service.go`

```go
type ExportService interface {
    ExportTopologyPNG(ctx context.Context, clusterID string, filters TopologyFilters) ([]byte, error)
    ExportTopologyPDF(ctx context.Context, clusterID string, filters TopologyFilters) ([]byte, error)
    ExportTopologySVG(ctx context.Context, clusterID string, filters TopologyFilters) ([]byte, error)
}

func (s *exportService) ExportTopologyPDF(ctx context.Context, clusterID string, filters TopologyFilters) ([]byte, error) {
    // 1. Build topology graph
    graph, err := s.topologyService.BuildGraph(ctx, clusterID, filters)
    if err != nil {
        return nil, err
    }

    // 2. Use same layout seed as UI
    layout := graph.LayoutSeed

    // 3. Render to PDF using headless Chrome or Go PDF library
    // CRITICAL: Must produce identical output to UI
    pdf := s.renderToPDF(graph, layout)

    return pdf, nil
}
```

---

## Part 3: API Contracts & Real-time Systems

### 3.1 REST API Endpoints

**File**: `internal/api/rest/handler.go`

#### Clusters API

```
GET    /api/v1/clusters              # List all clusters
POST   /api/v1/clusters              # Add new cluster
GET    /api/v1/clusters/:id          # Get cluster details
PUT    /api/v1/clusters/:id          # Update cluster
DELETE /api/v1/clusters/:id          # Remove cluster
GET    /api/v1/clusters/:id/health   # Get cluster health
```

#### Resources API

```
# Generic resource endpoints
GET    /api/v1/resources/:type                    # List resources of type
GET    /api/v1/resources/:type/:namespace/:name   # Get specific resource
POST   /api/v1/resources/:type/:namespace         # Create resource
PUT    /api/v1/resources/:type/:namespace/:name   # Update resource
DELETE /api/v1/resources/:type/:namespace/:name   # Delete resource

# Specific resource endpoints
GET    /api/v1/pods                              # List all pods
GET    /api/v1/pods/:namespace/:name             # Get pod
GET    /api/v1/pods/:namespace/:name/logs        # Get pod logs (stream)
POST   /api/v1/pods/:namespace/:name/exec        # Execute command in pod
DELETE /api/v1/pods/:namespace/:name             # Delete pod

GET    /api/v1/deployments/:namespace/:name/scale    # Get scale
PUT    /api/v1/deployments/:namespace/:name/scale    # Update replicas
POST   /api/v1/deployments/:namespace/:name/restart  # Rollout restart
```

#### Topology API

```
GET    /api/v1/topology                    # Get full topology
GET    /api/v1/topology/pod/:namespace/:name   # Get pod-centric topology
POST   /api/v1/topology/export/png        # Export topology as PNG
POST   /api/v1/topology/export/pdf        # Export topology as PDF
GET    /api/v1/topology/history           # Get topology history
```

#### Events API

```
GET    /api/v1/events                     # List all events
GET    /api/v1/events/:namespace          # Get namespace events
GET    /api/v1/events?involvedObject.kind=Pod&involvedObject.name=nginx
```

#### Metrics API

```
GET    /api/v1/metrics/pods/:namespace/:name       # Get pod metrics
GET    /api/v1/metrics/nodes/:name                 # Get node metrics
GET    /api/v1/metrics/cluster                     # Get cluster-wide metrics
```

### 3.2 API Request/Response Models

```go
// Request: Create Resource
type CreateResourceRequest struct {
    YAML string `json:"yaml"`
}

// Response: Resource Detail
type ResourceDetailResponse struct {
    Kind       string                 `json:"kind"`
    APIVersion string                 `json:"apiVersion"`
    Metadata   map[string]interface{} `json:"metadata"`
    Spec       map[string]interface{} `json:"spec"`
    Status     map[string]interface{} `json:"status"`
}

// Response: Topology
type TopologyResponse struct {
    Nodes []TopologyNode `json:"nodes"`
    Edges []TopologyEdge `json:"edges"`
    Meta  TopologyMeta   `json:"meta"`
}

// Response: Pod Logs
type PodLogsResponse struct {
    Logs      []string  `json:"logs"`
    Timestamp time.Time `json:"timestamp"`
    Container string    `json:"container"`
}

// Error Response
type ErrorResponse struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}
```

### 3.3 WebSocket Implementation

**File**: `internal/api/websocket/hub.go`

```go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true

        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }

        case message := <-h.broadcast:
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
        }
    }
}

// Kubernetes resource watcher
func (h *Hub) WatchResources(ctx context.Context, client *k8s.Client) {
    informerManager := k8s.NewInformerManager(client)

    // Pod updates
    informerManager.SetupPodInformer(
        func(obj interface{}) {
            pod := obj.(*v1.Pod)
            h.broadcast <- marshalEvent("added", "Pod", pod)
        },
        func(obj interface{}) {
            pod := obj.(*v1.Pod)
            h.broadcast <- marshalEvent("updated", "Pod", pod)
        },
        func(obj interface{}) {
            pod := obj.(*v1.Pod)
            h.broadcast <- marshalEvent("deleted", "Pod", pod)
        },
    )

    // Repeat for all resource types...

    informerManager.Start()
}
```

**WebSocket Message Format**:
```json
{
  "type": "resource_update",
  "event": "updated",
  "resource": {
    "kind": "Pod",
    "namespace": "default",
    "name": "nginx-abc123",
    "status": "Running"
  },
  "timestamp": "2026-02-04T12:34:56Z"
}
```

### 3.4 Caching Strategy

**File**: `internal/cache/redis.go` (optional, for production)

```go
type Cache interface {
    Get(ctx context.Context, key string) ([]byte, error)
    Set(ctx context.Context, key string, value []byte, ttl time.Duration) error
    Delete(ctx context.Context, key string) error
    Invalidate(ctx context.Context, pattern string) error
}

// Cache keys
const (
    CacheKeyTopology = "topology:%s"               // cluster ID
    CacheKeyResource = "resource:%s:%s:%s:%s"      // type, namespace, name, cluster
    CacheKeyMetrics  = "metrics:%s:%s:%s"          // type, namespace, name
)

// Cache TTLs
const (
    TopologyCacheTTL = 30 * time.Second
    ResourceCacheTTL = 10 * time.Second
    MetricsCacheTTL  = 5 * time.Second
)
```

### 3.5 Rate Limiting & Security

```go
// Middleware: Rate limiting
func RateLimitMiddleware(limit int) func(http.Handler) http.Handler {
    limiter := rate.NewLimiter(rate.Limit(limit), limit*2)

    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !limiter.Allow() {
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// Middleware: RBAC (for in-cluster deployment)
func RBACMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract user from JWT or ServiceAccount token
        user := extractUser(r)

        // Check if user has permission for this action
        resource := extractResourceFromPath(r.URL.Path)
        verb := httpMethodToK8sVerb(r.Method)

        if !canAccess(user, resource, verb) {
            http.Error(w, "Forbidden", http.StatusForbidden)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

---

## Implementation Checklist

### Backend Part 2: Topology Engine
- [ ] Implement graph data structure
- [ ] Implement resource discovery for all 50+ types
- [ ] Implement relationship inference logic (OwnerRefs, Selectors, Volumes, Env, RBAC, Network)
- [ ] Implement graph validation (completeness, closure, no duplicates)
- [ ] Implement deterministic layout seed generation
- [ ] Implement export service (PNG, PDF, SVG)
- [ ] Add unit tests for topology engine
- [ ] Add integration tests with mock K8s cluster

### Backend Part 3: API & Real-time
- [ ] Implement all REST API endpoints
- [ ] Implement WebSocket hub and client management
- [ ] Implement resource watchers with informers
- [ ] Implement real-time event broadcasting
- [ ] Implement caching layer (optional Redis)
- [ ] Implement rate limiting
- [ ] Implement RBAC middleware
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add integration tests for all APIs

### Database & Persistence
- [ ] Implement SQLite repository
- [ ] Implement PostgreSQL repository
- [ ] Add database migrations
- [ ] Add topology snapshot persistence
- [ ] Add resource history tracking

### Testing
- [ ] Unit tests for all services (85%+ coverage)
- [ ] Integration tests with mock K8s API
- [ ] End-to-end tests with real K8s cluster (kind/k3s)
- [ ] Load tests (10K+ nodes)
- [ ] Benchmark topology engine performance

---

**(End of Backend Parts 2 & 3 Summary)**

**Note**: This document provides comprehensive outlines. Implement each section following the patterns established in Part 1, ensuring consistency and maintaining the non-negotiable requirements from the topology_engine_prd.md.
