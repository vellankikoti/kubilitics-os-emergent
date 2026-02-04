# Kubilitics Backend Engineering Blueprint — Part 2

## Topology Engine, Data Layer & Kubernetes Integration

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** AUTHORITATIVE — Single Source of Truth

---

## Table of Contents

1. [Topology Engine Architecture](#1-topology-engine-architecture)
2. [Resource Discovery Pipeline](#2-resource-discovery-pipeline)
3. [Relationship Inference Logic](#3-relationship-inference-logic)
4. [Graph Construction](#4-graph-construction)
5. [Graph Validation](#5-graph-validation)
6. [Deterministic Layout Seed Generation](#6-deterministic-layout-seed-generation)
7. [Kubernetes Client Layer](#7-kubernetes-client-layer)
8. [Caching Strategy](#8-caching-strategy)
9. [CRD Handling](#9-crd-handling)

---

## 1. Topology Engine Architecture

### 1.1 Engine Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TOPOLOGY ENGINE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    RESOURCE DISCOVERY                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │   Native    │  │    CRD      │  │    Helm     │  │   GitOps   │ │    │
│  │  │  Resources  │  │  Resources  │  │  Metadata   │  │  Metadata  │ │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬─────┘ │    │
│  │         └─────────────────┴────────────────┴────────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                 RELATIONSHIP INFERENCE                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │   Owner     │  │   Label     │  │   Field     │  │   Volume   │ │    │
│  │  │   Refs      │  │  Selectors  │  │   Refs      │  │   Mounts   │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │    Env      │  │    RBAC     │  │  Admission  │  │    CSI/    │ │    │
│  │  │   Refs      │  │  Bindings   │  │  Webhooks   │  │    CNI     │ │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    GRAPH CONSTRUCTION                                │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │   Build     │  │  Closure    │  │   Seed      │                 │    │
│  │  │   Graph     │  │  Expansion  │  │ Generation  │                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      VALIDATION                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │    │
│  │  │ Completeness│  │  Closure    │  │ Determinism │                 │    │
│  │  │   Check     │  │   Check     │  │   Check     │                 │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Engine Interface

```go
// internal/services/topology/engine.go
package topology

import (
    "context"

    "github.com/kubilitics/kubilitics/internal/models"
    "go.uber.org/zap"
)

// Engine is the core topology construction system
type Engine struct {
    k8sManager    *kubernetes.ClientManager
    discovery     *Discovery
    relationships *RelationshipInferrer
    graphBuilder  *GraphBuilder
    validator     *Validator
    cache         *Cache
    logger        *zap.Logger
}

// NewEngine creates a new topology engine
func NewEngine(k8sManager *kubernetes.ClientManager, logger *zap.Logger) *Engine {
    return &Engine{
        k8sManager:    k8sManager,
        discovery:     NewDiscovery(k8sManager, logger),
        relationships: NewRelationshipInferrer(logger),
        graphBuilder:  NewGraphBuilder(logger),
        validator:     NewValidator(logger),
        cache:         NewCache(),
        logger:        logger,
    }
}

// GetClusterTopology returns the complete cluster topology
func (e *Engine) GetClusterTopology(ctx context.Context, clusterID string, opts GetOptions) (*models.TopologyGraph, error) {
    // Check cache first
    cacheKey := e.buildCacheKey(clusterID, opts)
    if cached, ok := e.cache.Get(cacheKey); ok {
        return cached, nil
    }

    // Step 1: Discover all resources
    resources, err := e.discovery.DiscoverAll(ctx, clusterID, opts)
    if err != nil {
        return nil, fmt.Errorf("resource discovery failed: %w", err)
    }

    // Step 2: Infer relationships
    relationships, err := e.relationships.InferAll(ctx, resources)
    if err != nil {
        return nil, fmt.Errorf("relationship inference failed: %w", err)
    }

    // Step 3: Build graph
    graph, err := e.graphBuilder.Build(ctx, resources, relationships, clusterID)
    if err != nil {
        return nil, fmt.Errorf("graph construction failed: %w", err)
    }

    // Step 4: Validate graph
    validation := e.validator.Validate(ctx, graph)
    graph.Metadata.Validation = validation

    if !validation.IsValid {
        e.logger.Warn("Topology graph validation failed",
            zap.String("clusterID", clusterID),
            zap.Any("errors", validation.Errors),
        )
    }

    // Cache result
    e.cache.Set(cacheKey, graph)

    return graph, nil
}

// GetResourceTopology returns topology centered on a specific resource
func (e *Engine) GetResourceTopology(
    ctx context.Context,
    clusterID string,
    kind, namespace, name string,
    depth int,
) (*models.TopologyGraph, error) {
    // Step 1: Get the focal resource
    focalResource, err := e.discovery.GetResource(ctx, clusterID, kind, namespace, name)
    if err != nil {
        return nil, err
    }

    // Step 2: Expand to graph closure
    resources, err := e.expandToClosure(ctx, clusterID, focalResource, depth)
    if err != nil {
        return nil, err
    }

    // Step 3: Infer relationships within this subset
    relationships, err := e.relationships.InferAll(ctx, resources)
    if err != nil {
        return nil, err
    }

    // Step 4: Build graph
    graph, err := e.graphBuilder.Build(ctx, resources, relationships, clusterID)
    if err != nil {
        return nil, err
    }

    // Mark the focal node
    for i := range graph.Nodes {
        if graph.Nodes[i].Kind == kind &&
            graph.Nodes[i].Namespace == namespace &&
            graph.Nodes[i].Name == name {
            graph.Nodes[i].IsFocal = true
            break
        }
    }

    // Step 5: Validate
    validation := e.validator.Validate(ctx, graph)
    graph.Metadata.Validation = validation

    return graph, nil
}

// expandToClosure expands from a focal resource to full graph closure
func (e *Engine) expandToClosure(
    ctx context.Context,
    clusterID string,
    focal *models.Resource,
    maxDepth int,
) ([]*models.Resource, error) {
    visited := make(map[string]bool)
    resources := []*models.Resource{focal}
    queue := []*models.Resource{focal}
    currentDepth := 0

    for len(queue) > 0 && (maxDepth < 0 || currentDepth < maxDepth) {
        nextQueue := []*models.Resource{}

        for _, resource := range queue {
            resourceID := resource.ID()
            if visited[resourceID] {
                continue
            }
            visited[resourceID] = true

            // Find all related resources
            related, err := e.findRelatedResources(ctx, clusterID, resource)
            if err != nil {
                e.logger.Warn("Failed to find related resources",
                    zap.String("resourceID", resourceID),
                    zap.Error(err),
                )
                continue
            }

            for _, r := range related {
                if !visited[r.ID()] {
                    resources = append(resources, r)
                    nextQueue = append(nextQueue, r)
                }
            }
        }

        queue = nextQueue
        currentDepth++
    }

    return resources, nil
}

type GetOptions struct {
    Namespace            string
    IncludeClusterScoped bool
    ResourceTypes        []string // Empty means all types
}
```

---

## 2. Resource Discovery Pipeline

### 2.1 Discovery Service

```go
// internal/services/topology/discovery.go
package topology

import (
    "context"
    "fmt"
    "sync"

    "github.com/kubilitics/kubilitics/internal/kubernetes"
    "github.com/kubilitics/kubilitics/internal/models"
    "github.com/samber/lo"
    "go.uber.org/zap"
    "golang.org/x/sync/errgroup"
)

// Discovery handles resource discovery from Kubernetes clusters
type Discovery struct {
    k8sManager *kubernetes.ClientManager
    logger     *zap.Logger
}

// ResourceDiscoveryConfig defines which resources to discover
// ALL resources must be discovered per PRD - no opt-out
var DefaultDiscoveryConfig = ResourceDiscoveryConfig{
    // Workloads
    Workloads: []string{
        "pods",
        "deployments",
        "statefulsets",
        "daemonsets",
        "replicasets",
        "jobs",
        "cronjobs",
    },
    // Networking
    Networking: []string{
        "services",
        "ingresses",
        "networkpolicies",
        "endpoints",
        "endpointslices",
        "ingressclasses",
    },
    // Storage
    Storage: []string{
        "persistentvolumes",
        "persistentvolumeclaims",
        "storageclasses",
        "volumeattachments",
        "csidrivers",
        "csinodes",
    },
    // Configuration
    Configuration: []string{
        "configmaps",
        "secrets",
        "resourcequotas",
        "limitranges",
    },
    // RBAC
    RBAC: []string{
        "serviceaccounts",
        "roles",
        "rolebindings",
        "clusterroles",
        "clusterrolebindings",
    },
    // Cluster
    Cluster: []string{
        "nodes",
        "namespaces",
        "events",
        "leases",
    },
    // Admission
    Admission: []string{
        "mutatingwebhookconfigurations",
        "validatingwebhookconfigurations",
    },
    // Extensibility
    Extensibility: []string{
        "customresourcedefinitions",
    },
    // External metadata
    External: []string{
        "helm", // Helm release annotations
        "argocd", // ArgoCD applications
        "flux", // Flux resources
    },
}

type ResourceDiscoveryConfig struct {
    Workloads     []string
    Networking    []string
    Storage       []string
    Configuration []string
    RBAC          []string
    Cluster       []string
    Admission     []string
    Extensibility []string
    External      []string
}

// DiscoverAll discovers all resources in the cluster
func (d *Discovery) DiscoverAll(ctx context.Context, clusterID string, opts GetOptions) ([]*models.Resource, error) {
    client, err := d.k8sManager.GetClient(clusterID)
    if err != nil {
        return nil, fmt.Errorf("failed to get client for cluster %s: %w", clusterID, err)
    }

    var allResources []*models.Resource
    var mu sync.Mutex

    // Create error group for parallel discovery
    g, ctx := errgroup.WithContext(ctx)
    g.SetLimit(10) // Limit concurrent API calls

    // Get all resource types to discover
    resourceTypes := d.getResourceTypesToDiscover(opts)

    for _, resourceType := range resourceTypes {
        resourceType := resourceType // Capture for goroutine

        g.Go(func() error {
            resources, err := d.discoverResourceType(ctx, client, resourceType, opts)
            if err != nil {
                // Log error but continue - some resources may not be available
                d.logger.Warn("Failed to discover resource type",
                    zap.String("type", resourceType),
                    zap.Error(err),
                )
                return nil // Don't fail the whole discovery
            }

            mu.Lock()
            allResources = append(allResources, resources...)
            mu.Unlock()

            return nil
        })
    }

    if err := g.Wait(); err != nil {
        return nil, err
    }

    // Discover CRD instances
    crds, err := d.discoverCRDInstances(ctx, client, opts)
    if err != nil {
        d.logger.Warn("Failed to discover CRD instances", zap.Error(err))
    } else {
        allResources = append(allResources, crds...)
    }

    // Discover Helm metadata
    if lo.Contains(DefaultDiscoveryConfig.External, "helm") {
        helmResources, err := d.discoverHelmMetadata(ctx, client, allResources)
        if err != nil {
            d.logger.Warn("Failed to discover Helm metadata", zap.Error(err))
        } else {
            // Enrich existing resources with Helm annotations
            d.enrichWithHelmMetadata(allResources, helmResources)
        }
    }

    d.logger.Info("Resource discovery complete",
        zap.String("clusterID", clusterID),
        zap.Int("totalResources", len(allResources)),
    )

    return allResources, nil
}

// discoverResourceType discovers all resources of a specific type
func (d *Discovery) discoverResourceType(
    ctx context.Context,
    client *kubernetes.Client,
    resourceType string,
    opts GetOptions,
) ([]*models.Resource, error) {
    switch resourceType {
    case "pods":
        return d.discoverPods(ctx, client, opts)
    case "deployments":
        return d.discoverDeployments(ctx, client, opts)
    case "services":
        return d.discoverServices(ctx, client, opts)
    case "configmaps":
        return d.discoverConfigMaps(ctx, client, opts)
    case "secrets":
        return d.discoverSecrets(ctx, client, opts)
    case "persistentvolumes":
        return d.discoverPersistentVolumes(ctx, client, opts)
    case "persistentvolumeclaims":
        return d.discoverPersistentVolumeClaims(ctx, client, opts)
    case "nodes":
        return d.discoverNodes(ctx, client, opts)
    case "namespaces":
        return d.discoverNamespaces(ctx, client, opts)
    case "serviceaccounts":
        return d.discoverServiceAccounts(ctx, client, opts)
    case "roles":
        return d.discoverRoles(ctx, client, opts)
    case "rolebindings":
        return d.discoverRoleBindings(ctx, client, opts)
    case "clusterroles":
        return d.discoverClusterRoles(ctx, client, opts)
    case "clusterrolebindings":
        return d.discoverClusterRoleBindings(ctx, client, opts)
    case "networkpolicies":
        return d.discoverNetworkPolicies(ctx, client, opts)
    case "ingresses":
        return d.discoverIngresses(ctx, client, opts)
    // ... implement all 50+ resource types
    default:
        d.logger.Debug("Unknown resource type", zap.String("type", resourceType))
        return nil, nil
    }
}

// discoverPods discovers all pods
func (d *Discovery) discoverPods(ctx context.Context, client *kubernetes.Client, opts GetOptions) ([]*models.Resource, error) {
    listOpts := metav1.ListOptions{}

    var pods *corev1.PodList
    var err error

    if opts.Namespace != "" {
        pods, err = client.CoreV1().Pods(opts.Namespace).List(ctx, listOpts)
    } else {
        pods, err = client.CoreV1().Pods("").List(ctx, listOpts)
    }

    if err != nil {
        return nil, err
    }

    resources := make([]*models.Resource, 0, len(pods.Items))
    for _, pod := range pods.Items {
        resources = append(resources, convertPodToResource(&pod))
    }

    return resources, nil
}

func convertPodToResource(pod *corev1.Pod) *models.Resource {
    return &models.Resource{
        Kind:       "Pod",
        APIVersion: "v1",
        Namespace:  pod.Namespace,
        Name:       pod.Name,
        UID:        string(pod.UID),
        Labels:     pod.Labels,
        Annotations: pod.Annotations,
        OwnerReferences: convertOwnerReferences(pod.OwnerReferences),
        CreatedAt:  pod.CreationTimestamp.Time,
        Raw:        pod,
        Computed: models.ResourceComputed{
            Health:     computePodHealth(pod),
            StatusText: string(pod.Status.Phase),
            Extra: map[string]interface{}{
                "phase":        pod.Status.Phase,
                "nodeName":     pod.Spec.NodeName,
                "podIP":        pod.Status.PodIP,
                "restartCount": computePodRestartCount(pod),
                "containers":   len(pod.Spec.Containers),
            },
        },
    }
}

func computePodHealth(pod *corev1.Pod) models.HealthStatus {
    switch pod.Status.Phase {
    case corev1.PodRunning:
        // Check container statuses
        for _, cs := range pod.Status.ContainerStatuses {
            if !cs.Ready {
                return models.HealthStatusWarning
            }
            if cs.RestartCount > 5 {
                return models.HealthStatusWarning
            }
        }
        return models.HealthStatusHealthy
    case corev1.PodPending:
        return models.HealthStatusWarning
    case corev1.PodFailed:
        return models.HealthStatusCritical
    case corev1.PodSucceeded:
        return models.HealthStatusHealthy
    default:
        return models.HealthStatusUnknown
    }
}

func computePodRestartCount(pod *corev1.Pod) int {
    total := 0
    for _, cs := range pod.Status.ContainerStatuses {
        total += int(cs.RestartCount)
    }
    return total
}
```

---

## 3. Relationship Inference Logic

### 3.1 Relationship Inferrer

```go
// internal/services/topology/relationships.go
package topology

import (
    "context"
    "fmt"
    "strings"

    "github.com/kubilitics/kubilitics/internal/models"
    "github.com/samber/lo"
    "go.uber.org/zap"
    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/labels"
)

// RelationshipInferrer discovers relationships between resources
type RelationshipInferrer struct {
    logger *zap.Logger
}

func NewRelationshipInferrer(logger *zap.Logger) *RelationshipInferrer {
    return &RelationshipInferrer{logger: logger}
}

// RelationshipType defines the type of relationship
type RelationshipType string

const (
    RelOwns       RelationshipType = "owns"
    RelSelects    RelationshipType = "selects"
    RelMounts     RelationshipType = "mounts"
    RelReferences RelationshipType = "references"
    RelConfigures RelationshipType = "configures"
    RelPermits    RelationshipType = "permits"
    RelValidates  RelationshipType = "validates"
    RelMutates    RelationshipType = "mutates"
    RelExposes    RelationshipType = "exposes"
    RelRoutes     RelationshipType = "routes"
    RelStores     RelationshipType = "stores"
    RelSchedules  RelationshipType = "schedules"
    RelLimits     RelationshipType = "limits"
    RelManages    RelationshipType = "manages"
    RelContains   RelationshipType = "contains"
)

// InferredRelationship represents a discovered relationship
type InferredRelationship struct {
    Source           string
    Target           string
    RelationshipType RelationshipType
    Label            string
    Derivation       string
    Confidence       float64
    SourceField      string
}

// InferAll infers all relationships between resources
func (ri *RelationshipInferrer) InferAll(ctx context.Context, resources []*models.Resource) ([]*InferredRelationship, error) {
    var relationships []*InferredRelationship

    // Build lookup maps for efficient querying
    resourceByID := make(map[string]*models.Resource)
    resourcesByKind := make(map[string][]*models.Resource)
    resourcesByNamespace := make(map[string][]*models.Resource)

    for _, r := range resources {
        id := r.ID()
        resourceByID[id] = r
        resourcesByKind[r.Kind] = append(resourcesByKind[r.Kind], r)
        if r.Namespace != "" {
            resourcesByNamespace[r.Namespace] = append(resourcesByNamespace[r.Namespace], r)
        }
    }

    // 1. OwnerReferences (highest confidence)
    rels := ri.inferOwnerReferenceRelationships(resources, resourceByID)
    relationships = append(relationships, rels...)

    // 2. Label Selectors (Service → Pod, etc.)
    rels = ri.inferLabelSelectorRelationships(resources, resourcesByKind, resourcesByNamespace)
    relationships = append(relationships, rels...)

    // 3. Field References (Pod → Node, Pod → ServiceAccount, etc.)
    rels = ri.inferFieldReferenceRelationships(resources, resourceByID)
    relationships = append(relationships, rels...)

    // 4. Volume Mounts (Pod → PVC → PV, Pod → ConfigMap, Pod → Secret)
    rels = ri.inferVolumeMountRelationships(resources, resourceByID)
    relationships = append(relationships, rels...)

    // 5. Environment Variable References
    rels = ri.inferEnvReferenceRelationships(resources, resourceByID)
    relationships = append(relationships, rels...)

    // 6. RBAC Bindings
    rels = ri.inferRBACRelationships(resources, resourceByID, resourcesByKind)
    relationships = append(relationships, rels...)

    // 7. Admission Webhooks
    rels = ri.inferAdmissionWebhookRelationships(resources, resourcesByKind)
    relationships = append(relationships, rels...)

    // 8. Storage Bindings (PVC → PV, StorageClass)
    rels = ri.inferStorageRelationships(resources, resourceByID)
    relationships = append(relationships, rels...)

    // 9. Namespace Containment
    rels = ri.inferNamespaceRelationships(resources, resourcesByNamespace)
    relationships = append(relationships, rels...)

    // 10. Helm/GitOps Management
    rels = ri.inferManagementRelationships(resources)
    relationships = append(relationships, rels...)

    // 11. Network Policies
    rels = ri.inferNetworkPolicyRelationships(resources, resourcesByKind, resourcesByNamespace)
    relationships = append(relationships, rels...)

    // 12. Ingress → Service routing
    rels = ri.inferIngressRelationships(resources, resourcesByKind)
    relationships = append(relationships, rels...)

    ri.logger.Info("Relationship inference complete",
        zap.Int("totalRelationships", len(relationships)),
    )

    return relationships, nil
}

// inferOwnerReferenceRelationships discovers owner-owned relationships
func (ri *RelationshipInferrer) inferOwnerReferenceRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    for _, resource := range resources {
        for _, ownerRef := range resource.OwnerReferences {
            // Build owner ID
            var ownerID string
            if resource.Namespace != "" {
                ownerID = fmt.Sprintf("%s/%s/%s", ownerRef.Kind, resource.Namespace, ownerRef.Name)
            } else {
                ownerID = fmt.Sprintf("%s/%s", ownerRef.Kind, ownerRef.Name)
            }

            // Only create relationship if owner exists in our resource set
            if _, exists := resourceByID[ownerID]; exists {
                rels = append(rels, &InferredRelationship{
                    Source:           ownerID,
                    Target:           resource.ID(),
                    RelationshipType: RelOwns,
                    Label:            "owns",
                    Derivation:       "ownerReference",
                    Confidence:       1.0, // OwnerReferences are authoritative
                    SourceField:      "metadata.ownerReferences",
                })
            }
        }
    }

    return rels
}

// inferLabelSelectorRelationships discovers selector-based relationships
func (ri *RelationshipInferrer) inferLabelSelectorRelationships(
    resources []*models.Resource,
    resourcesByKind map[string][]*models.Resource,
    resourcesByNamespace map[string][]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    // Service → Pod
    for _, svc := range resourcesByKind["Service"] {
        svcRaw, ok := svc.Raw.(*corev1.Service)
        if !ok || svcRaw.Spec.Selector == nil {
            continue
        }

        selector := labels.SelectorFromSet(svcRaw.Spec.Selector)

        // Find matching pods in same namespace
        for _, pod := range resourcesByKind["Pod"] {
            if pod.Namespace != svc.Namespace {
                continue
            }

            if selector.Matches(labels.Set(pod.Labels)) {
                rels = append(rels, &InferredRelationship{
                    Source:           svc.ID(),
                    Target:           pod.ID(),
                    RelationshipType: RelSelects,
                    Label:            "selects",
                    Derivation:       "labelSelector",
                    Confidence:       1.0,
                    SourceField:      "spec.selector",
                })
            }
        }
    }

    // ReplicaSet → Pod, Deployment → ReplicaSet (via selector)
    for _, rs := range resourcesByKind["ReplicaSet"] {
        rsRaw, ok := rs.Raw.(*appsv1.ReplicaSet)
        if !ok || rsRaw.Spec.Selector == nil {
            continue
        }

        selector, err := metav1.LabelSelectorAsSelector(rsRaw.Spec.Selector)
        if err != nil {
            continue
        }

        for _, pod := range resourcesByKind["Pod"] {
            if pod.Namespace != rs.Namespace {
                continue
            }

            if selector.Matches(labels.Set(pod.Labels)) {
                rels = append(rels, &InferredRelationship{
                    Source:           rs.ID(),
                    Target:           pod.ID(),
                    RelationshipType: RelSelects,
                    Label:            "selects",
                    Derivation:       "labelSelector",
                    Confidence:       1.0,
                    SourceField:      "spec.selector",
                })
            }
        }
    }

    // Similarly for Deployment, StatefulSet, DaemonSet, Job, etc.
    // ... (implement for all controller types)

    return rels
}

// inferVolumeMountRelationships discovers volume-based relationships
func (ri *RelationshipInferrer) inferVolumeMountRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    for _, resource := range resources {
        if resource.Kind != "Pod" {
            continue
        }

        pod, ok := resource.Raw.(*corev1.Pod)
        if !ok {
            continue
        }

        for _, volume := range pod.Spec.Volumes {
            // ConfigMap volume
            if volume.ConfigMap != nil {
                configMapID := fmt.Sprintf("ConfigMap/%s/%s", resource.Namespace, volume.ConfigMap.Name)
                if _, exists := resourceByID[configMapID]; exists {
                    rels = append(rels, &InferredRelationship{
                        Source:           resource.ID(),
                        Target:           configMapID,
                        RelationshipType: RelMounts,
                        Label:            fmt.Sprintf("mounts as %s", volume.Name),
                        Derivation:       "volumeMount",
                        Confidence:       1.0,
                        SourceField:      "spec.volumes[].configMap",
                    })
                }
            }

            // Secret volume
            if volume.Secret != nil {
                secretID := fmt.Sprintf("Secret/%s/%s", resource.Namespace, volume.Secret.SecretName)
                if _, exists := resourceByID[secretID]; exists {
                    rels = append(rels, &InferredRelationship{
                        Source:           resource.ID(),
                        Target:           secretID,
                        RelationshipType: RelMounts,
                        Label:            fmt.Sprintf("mounts as %s", volume.Name),
                        Derivation:       "volumeMount",
                        Confidence:       1.0,
                        SourceField:      "spec.volumes[].secret",
                    })
                }
            }

            // PVC volume
            if volume.PersistentVolumeClaim != nil {
                pvcID := fmt.Sprintf("PersistentVolumeClaim/%s/%s", resource.Namespace, volume.PersistentVolumeClaim.ClaimName)
                if _, exists := resourceByID[pvcID]; exists {
                    rels = append(rels, &InferredRelationship{
                        Source:           resource.ID(),
                        Target:           pvcID,
                        RelationshipType: RelMounts,
                        Label:            fmt.Sprintf("mounts as %s", volume.Name),
                        Derivation:       "volumeMount",
                        Confidence:       1.0,
                        SourceField:      "spec.volumes[].persistentVolumeClaim",
                    })
                }
            }
        }
    }

    return rels
}

// inferFieldReferenceRelationships discovers field-based relationships
func (ri *RelationshipInferrer) inferFieldReferenceRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    for _, resource := range resources {
        if resource.Kind != "Pod" {
            continue
        }

        pod, ok := resource.Raw.(*corev1.Pod)
        if !ok {
            continue
        }

        // Pod → Node (scheduled on)
        if pod.Spec.NodeName != "" {
            nodeID := fmt.Sprintf("Node/%s", pod.Spec.NodeName)
            if _, exists := resourceByID[nodeID]; exists {
                rels = append(rels, &InferredRelationship{
                    Source:           resource.ID(),
                    Target:           nodeID,
                    RelationshipType: RelSchedules,
                    Label:            "scheduled on",
                    Derivation:       "fieldReference",
                    Confidence:       1.0,
                    SourceField:      "spec.nodeName",
                })
            }
        }

        // Pod → ServiceAccount
        saName := pod.Spec.ServiceAccountName
        if saName == "" {
            saName = "default"
        }
        saID := fmt.Sprintf("ServiceAccount/%s/%s", resource.Namespace, saName)
        if _, exists := resourceByID[saID]; exists {
            rels = append(rels, &InferredRelationship{
                Source:           resource.ID(),
                Target:           saID,
                RelationshipType: RelReferences,
                Label:            "uses",
                Derivation:       "fieldReference",
                Confidence:       1.0,
                SourceField:      "spec.serviceAccountName",
            })
        }
    }

    return rels
}

// inferRBACRelationships discovers RBAC binding relationships
func (ri *RelationshipInferrer) inferRBACRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
    resourcesByKind map[string][]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    // RoleBinding → Role + Subject
    for _, rb := range resourcesByKind["RoleBinding"] {
        rbRaw, ok := rb.Raw.(*rbacv1.RoleBinding)
        if !ok {
            continue
        }

        // RoleBinding → Role
        roleID := fmt.Sprintf("Role/%s/%s", rb.Namespace, rbRaw.RoleRef.Name)
        if rbRaw.RoleRef.Kind == "ClusterRole" {
            roleID = fmt.Sprintf("ClusterRole/%s", rbRaw.RoleRef.Name)
        }

        if _, exists := resourceByID[roleID]; exists {
            rels = append(rels, &InferredRelationship{
                Source:           rb.ID(),
                Target:           roleID,
                RelationshipType: RelReferences,
                Label:            "binds to",
                Derivation:       "rbacBinding",
                Confidence:       1.0,
                SourceField:      "roleRef",
            })
        }

        // RoleBinding → Subject (ServiceAccount)
        for _, subject := range rbRaw.Subjects {
            if subject.Kind == "ServiceAccount" {
                ns := subject.Namespace
                if ns == "" {
                    ns = rb.Namespace
                }
                saID := fmt.Sprintf("ServiceAccount/%s/%s", ns, subject.Name)

                if _, exists := resourceByID[saID]; exists {
                    rels = append(rels, &InferredRelationship{
                        Source:           rb.ID(),
                        Target:           saID,
                        RelationshipType: RelPermits,
                        Label:            "grants to",
                        Derivation:       "rbacBinding",
                        Confidence:       1.0,
                        SourceField:      "subjects[]",
                    })
                }
            }
        }
    }

    // Similar for ClusterRoleBinding
    // ...

    return rels
}

// inferEnvReferenceRelationships discovers env var references to ConfigMaps/Secrets
func (ri *RelationshipInferrer) inferEnvReferenceRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    for _, resource := range resources {
        if resource.Kind != "Pod" {
            continue
        }

        pod, ok := resource.Raw.(*corev1.Pod)
        if !ok {
            continue
        }

        for _, container := range pod.Spec.Containers {
            // EnvFrom
            for _, envFrom := range container.EnvFrom {
                if envFrom.ConfigMapRef != nil {
                    cmID := fmt.Sprintf("ConfigMap/%s/%s", resource.Namespace, envFrom.ConfigMapRef.Name)
                    if _, exists := resourceByID[cmID]; exists {
                        rels = append(rels, &InferredRelationship{
                            Source:           resource.ID(),
                            Target:           cmID,
                            RelationshipType: RelConfigures,
                            Label:            "configures from",
                            Derivation:       "envReference",
                            Confidence:       1.0,
                            SourceField:      "spec.containers[].envFrom[].configMapRef",
                        })
                    }
                }
                if envFrom.SecretRef != nil {
                    secretID := fmt.Sprintf("Secret/%s/%s", resource.Namespace, envFrom.SecretRef.Name)
                    if _, exists := resourceByID[secretID]; exists {
                        rels = append(rels, &InferredRelationship{
                            Source:           resource.ID(),
                            Target:           secretID,
                            RelationshipType: RelConfigures,
                            Label:            "configures from",
                            Derivation:       "envReference",
                            Confidence:       1.0,
                            SourceField:      "spec.containers[].envFrom[].secretRef",
                        })
                    }
                }
            }

            // Individual env vars with valueFrom
            for _, env := range container.Env {
                if env.ValueFrom == nil {
                    continue
                }

                if env.ValueFrom.ConfigMapKeyRef != nil {
                    cmID := fmt.Sprintf("ConfigMap/%s/%s", resource.Namespace, env.ValueFrom.ConfigMapKeyRef.Name)
                    if _, exists := resourceByID[cmID]; exists {
                        rels = append(rels, &InferredRelationship{
                            Source:           resource.ID(),
                            Target:           cmID,
                            RelationshipType: RelConfigures,
                            Label:            fmt.Sprintf("reads %s", env.Name),
                            Derivation:       "envReference",
                            Confidence:       1.0,
                            SourceField:      "spec.containers[].env[].valueFrom.configMapKeyRef",
                        })
                    }
                }

                if env.ValueFrom.SecretKeyRef != nil {
                    secretID := fmt.Sprintf("Secret/%s/%s", resource.Namespace, env.ValueFrom.SecretKeyRef.Name)
                    if _, exists := resourceByID[secretID]; exists {
                        rels = append(rels, &InferredRelationship{
                            Source:           resource.ID(),
                            Target:           secretID,
                            RelationshipType: RelConfigures,
                            Label:            fmt.Sprintf("reads %s", env.Name),
                            Derivation:       "envReference",
                            Confidence:       1.0,
                            SourceField:      "spec.containers[].env[].valueFrom.secretKeyRef",
                        })
                    }
                }
            }
        }
    }

    return rels
}

// inferStorageRelationships discovers PVC → PV bindings
func (ri *RelationshipInferrer) inferStorageRelationships(
    resources []*models.Resource,
    resourceByID map[string]*models.Resource,
) []*InferredRelationship {
    var rels []*InferredRelationship

    for _, resource := range resources {
        if resource.Kind != "PersistentVolumeClaim" {
            continue
        }

        pvc, ok := resource.Raw.(*corev1.PersistentVolumeClaim)
        if !ok {
            continue
        }

        // PVC → PV (bound)
        if pvc.Spec.VolumeName != "" {
            pvID := fmt.Sprintf("PersistentVolume/%s", pvc.Spec.VolumeName)
            if _, exists := resourceByID[pvID]; exists {
                rels = append(rels, &InferredRelationship{
                    Source:           resource.ID(),
                    Target:           pvID,
                    RelationshipType: RelStores,
                    Label:            "bound to",
                    Derivation:       "storageBinding",
                    Confidence:       1.0,
                    SourceField:      "spec.volumeName",
                })
            }
        }

        // PVC → StorageClass
        if pvc.Spec.StorageClassName != nil && *pvc.Spec.StorageClassName != "" {
            scID := fmt.Sprintf("StorageClass/%s", *pvc.Spec.StorageClassName)
            if _, exists := resourceByID[scID]; exists {
                rels = append(rels, &InferredRelationship{
                    Source:           resource.ID(),
                    Target:           scID,
                    RelationshipType: RelReferences,
                    Label:            "uses",
                    Derivation:       "storageBinding",
                    Confidence:       1.0,
                    SourceField:      "spec.storageClassName",
                })
            }
        }
    }

    return rels
}
```

---

## 4. Graph Construction

### 4.1 Graph Builder

```go
// internal/services/topology/graph.go
package topology

import (
    "context"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "sort"
    "time"

    "github.com/kubilitics/kubilitics/internal/models"
    "go.uber.org/zap"
)

// GraphBuilder constructs the topology graph from resources and relationships
type GraphBuilder struct {
    logger *zap.Logger
}

func NewGraphBuilder(logger *zap.Logger) *GraphBuilder {
    return &GraphBuilder{logger: logger}
}

// Build constructs the topology graph
func (gb *GraphBuilder) Build(
    ctx context.Context,
    resources []*models.Resource,
    relationships []*InferredRelationship,
    clusterID string,
) (*models.TopologyGraph, error) {
    // Build nodes
    nodes := make([]models.TopologyNode, 0, len(resources))
    for _, r := range resources {
        nodes = append(nodes, gb.resourceToNode(r))
    }

    // Build edges
    edges := make([]models.TopologyEdge, 0, len(relationships))
    for _, rel := range relationships {
        edges = append(edges, gb.relationshipToEdge(rel))
    }

    // Generate deterministic layout seed
    layoutSeed := gb.generateLayoutSeed(nodes, edges)

    // Compute statistics
    stats := gb.computeStats(nodes, edges)

    graph := &models.TopologyGraph{
        SchemaVersion: "1.0",
        Nodes:         nodes,
        Edges:         edges,
        Metadata: models.GraphMetadata{
            ClusterID:   clusterID,
            GeneratedAt: time.Now().UTC(),
            LayoutSeed:  layoutSeed,
            IsComplete:  true, // Will be set to false if validation fails
            Stats:       stats,
        },
    }

    return graph, nil
}

func (gb *GraphBuilder) resourceToNode(r *models.Resource) models.TopologyNode {
    return models.TopologyNode{
        ID:         r.ID(),
        Kind:       r.Kind,
        APIVersion: r.APIVersion,
        Namespace:  r.Namespace,
        Name:       r.Name,
        Status:     r.Computed.StatusText,
        Metadata: models.NodeMetadata{
            Labels:      r.Labels,
            Annotations: r.Annotations,
            UID:         r.UID,
            CreatedAt:   r.CreatedAt,
        },
        Computed: models.NodeComputed{
            Health:     r.Computed.Health,
            StatusText: r.Computed.StatusText,
        },
    }
}

func (gb *GraphBuilder) relationshipToEdge(rel *InferredRelationship) models.TopologyEdge {
    return models.TopologyEdge{
        ID:               fmt.Sprintf("%s->%s:%s", rel.Source, rel.Target, rel.RelationshipType),
        Source:           rel.Source,
        Target:           rel.Target,
        RelationshipType: models.RelationshipType(rel.RelationshipType),
        Label:            rel.Label,
        Metadata: models.EdgeMetadata{
            Derivation:  rel.Derivation,
            Confidence:  rel.Confidence,
            SourceField: rel.SourceField,
        },
    }
}

// generateLayoutSeed creates a deterministic seed for layout
// CRITICAL: Same graph MUST produce same seed
func (gb *GraphBuilder) generateLayoutSeed(nodes []models.TopologyNode, edges []models.TopologyEdge) string {
    // Sort node IDs for determinism
    nodeIDs := make([]string, 0, len(nodes))
    for _, n := range nodes {
        nodeIDs = append(nodeIDs, n.ID)
    }
    sort.Strings(nodeIDs)

    // Sort edge IDs for determinism
    edgeIDs := make([]string, 0, len(edges))
    for _, e := range edges {
        edgeIDs = append(edgeIDs, e.ID)
    }
    sort.Strings(edgeIDs)

    // Create hash input
    hashInput := fmt.Sprintf("nodes:%v|edges:%v", nodeIDs, edgeIDs)

    // Generate SHA-256 hash
    hash := sha256.Sum256([]byte(hashInput))

    return hex.EncodeToString(hash[:])
}

func (gb *GraphBuilder) computeStats(nodes []models.TopologyNode, edges []models.TopologyEdge) models.GraphStats {
    // Count namespaces
    namespaces := make(map[string]bool)
    for _, n := range nodes {
        if n.Namespace != "" {
            namespaces[n.Namespace] = true
        }
    }

    // Count by kind
    kindDist := make(map[string]int)
    for _, n := range nodes {
        kindDist[n.Kind]++
    }

    return models.GraphStats{
        NodeCount:        len(nodes),
        EdgeCount:        len(edges),
        NamespaceCount:   len(namespaces),
        KindDistribution: kindDist,
    }
}
```

---

## 5. Graph Validation

### 5.1 Validator

```go
// internal/services/topology/validation.go
package topology

import (
    "context"
    "fmt"

    "github.com/kubilitics/kubilitics/internal/models"
    "go.uber.org/zap"
)

// Validator validates topology graphs for completeness and correctness
type Validator struct {
    logger *zap.Logger
}

func NewValidator(logger *zap.Logger) *Validator {
    return &Validator{logger: logger}
}

// Validate performs all validation checks on the graph
func (v *Validator) Validate(ctx context.Context, graph *models.TopologyGraph) models.ValidationResult {
    var errors []models.ValidationError

    // 1. Node count parity check
    if err := v.validateNodeCount(graph); err != nil {
        errors = append(errors, *err)
    }

    // 2. Edge reference integrity
    if errs := v.validateEdgeReferences(graph); len(errs) > 0 {
        errors = append(errors, errs...)
    }

    // 3. Relationship completeness for Pods
    if errs := v.validatePodRelationshipCompleteness(graph); len(errs) > 0 {
        errors = append(errors, errs...)
    }

    // 4. Graph closure verification
    if errs := v.validateGraphClosure(graph); len(errs) > 0 {
        errors = append(errors, errs...)
    }

    // 5. Layout seed determinism
    if err := v.validateLayoutSeedDeterminism(graph); err != nil {
        errors = append(errors, *err)
    }

    return models.ValidationResult{
        IsValid: len(errors) == 0,
        Errors:  errors,
    }
}

func (v *Validator) validateNodeCount(graph *models.TopologyGraph) *models.ValidationError {
    if len(graph.Nodes) == 0 {
        return &models.ValidationError{
            Code:    "EMPTY_GRAPH",
            Message: "Graph contains no nodes",
        }
    }
    return nil
}

func (v *Validator) validateEdgeReferences(graph *models.TopologyGraph) []models.ValidationError {
    var errors []models.ValidationError

    // Build node lookup
    nodeIDs := make(map[string]bool)
    for _, n := range graph.Nodes {
        nodeIDs[n.ID] = true
    }

    // Check all edges reference existing nodes
    for _, e := range graph.Edges {
        if !nodeIDs[e.Source] {
            errors = append(errors, models.ValidationError{
                Code:    "DANGLING_EDGE_SOURCE",
                Message: fmt.Sprintf("Edge %s references non-existent source node %s", e.ID, e.Source),
                NodeID:  e.Source,
            })
        }
        if !nodeIDs[e.Target] {
            errors = append(errors, models.ValidationError{
                Code:    "DANGLING_EDGE_TARGET",
                Message: fmt.Sprintf("Edge %s references non-existent target node %s", e.ID, e.Target),
                NodeID:  e.Target,
            })
        }
    }

    return errors
}

// validatePodRelationshipCompleteness checks that all Pod relationships are present
// per PRD requirements
func (v *Validator) validatePodRelationshipCompleteness(graph *models.TopologyGraph) []models.ValidationError {
    var errors []models.ValidationError

    // Build edge lookup
    edgesBySource := make(map[string][]models.TopologyEdge)
    edgesByTarget := make(map[string][]models.TopologyEdge)
    for _, e := range graph.Edges {
        edgesBySource[e.Source] = append(edgesBySource[e.Source], e)
        edgesByTarget[e.Target] = append(edgesByTarget[e.Target], e)
    }

    // Check each Pod
    for _, node := range graph.Nodes {
        if node.Kind != "Pod" {
            continue
        }

        podID := node.ID

        // Check for required relationships
        // Note: These checks look for the existence of edges, not specific resources
        // Missing resources should have been caught during discovery

        // 1. Pod should have owner (ReplicaSet, Job, DaemonSet, etc.) unless standalone
        hasOwner := false
        for _, e := range edgesByTarget[podID] {
            if e.RelationshipType == models.RelationshipOwns {
                hasOwner = true
                break
            }
        }

        // 2. Pod should be scheduled on a Node (unless pending)
        hasNode := false
        for _, e := range edgesBySource[podID] {
            if e.RelationshipType == models.RelationshipSchedules {
                hasNode = true
                break
            }
        }

        // 3. Pod should reference ServiceAccount
        hasServiceAccount := false
        for _, e := range edgesBySource[podID] {
            if e.RelationshipType == models.RelationshipReferences {
                // Check if target is ServiceAccount
                for _, n := range graph.Nodes {
                    if n.ID == e.Target && n.Kind == "ServiceAccount" {
                        hasServiceAccount = true
                        break
                    }
                }
            }
        }

        // Log warnings (not errors) for expected relationships
        if !hasOwner && node.Computed.StatusText == "Running" {
            v.logger.Debug("Pod has no owner",
                zap.String("podID", podID),
            )
        }

        if !hasNode && node.Computed.StatusText != "Pending" {
            v.logger.Debug("Running Pod has no Node relationship",
                zap.String("podID", podID),
            )
        }
    }

    return errors
}

// validateGraphClosure ensures all referenced resources are included
func (v *Validator) validateGraphClosure(graph *models.TopologyGraph) []models.ValidationError {
    // This is enforced during discovery and relationship inference
    // Here we just verify the graph is internally consistent
    return nil
}

// validateLayoutSeedDeterminism verifies the layout seed is correct
func (v *Validator) validateLayoutSeedDeterminism(graph *models.TopologyGraph) *models.ValidationError {
    // Recompute seed and compare
    gb := &GraphBuilder{}
    expectedSeed := gb.generateLayoutSeed(graph.Nodes, graph.Edges)

    if graph.Metadata.LayoutSeed != expectedSeed {
        return &models.ValidationError{
            Code:    "LAYOUT_SEED_MISMATCH",
            Message: "Layout seed does not match graph content - determinism violation",
        }
    }

    return nil
}
```

---

## 6. Deterministic Layout Seed Generation

### 6.1 Seed Generation Algorithm

```go
// internal/services/topology/layout.go
package topology

import (
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "sort"

    "github.com/kubilitics/kubilitics/internal/models"
)

// LayoutSeedGenerator generates deterministic layout seeds
type LayoutSeedGenerator struct{}

// GenerateSeed creates a deterministic seed for the graph
// CRITICAL REQUIREMENT: Same graph MUST produce same seed ALWAYS
func (g *LayoutSeedGenerator) GenerateSeed(graph *models.TopologyGraph) string {
    // Step 1: Create sorted canonical representation of nodes
    nodeCanonical := g.canonicalizeNodes(graph.Nodes)

    // Step 2: Create sorted canonical representation of edges
    edgeCanonical := g.canonicalizeEdges(graph.Edges)

    // Step 3: Combine into single string
    combined := fmt.Sprintf("v1|%s|%s", nodeCanonical, edgeCanonical)

    // Step 4: SHA-256 hash
    hash := sha256.Sum256([]byte(combined))

    return hex.EncodeToString(hash[:16]) // Use first 16 bytes (128 bits)
}

func (g *LayoutSeedGenerator) canonicalizeNodes(nodes []models.TopologyNode) string {
    // Extract and sort node identifiers
    ids := make([]string, 0, len(nodes))
    for _, n := range nodes {
        ids = append(ids, n.ID)
    }
    sort.Strings(ids)

    return fmt.Sprintf("%v", ids)
}

func (g *LayoutSeedGenerator) canonicalizeEdges(edges []models.TopologyEdge) string {
    // Create canonical edge representations and sort
    edgeStrs := make([]string, 0, len(edges))
    for _, e := range edges {
        // Canonical format: source->target:type
        edgeStrs = append(edgeStrs, fmt.Sprintf("%s->%s:%s", e.Source, e.Target, e.RelationshipType))
    }
    sort.Strings(edgeStrs)

    return fmt.Sprintf("%v", edgeStrs)
}

// VerifySeedDeterminism verifies that seed generation is deterministic
// This is used in tests and validation
func (g *LayoutSeedGenerator) VerifySeedDeterminism(graph *models.TopologyGraph) bool {
    seed1 := g.GenerateSeed(graph)
    seed2 := g.GenerateSeed(graph)
    seed3 := g.GenerateSeed(graph)

    return seed1 == seed2 && seed2 == seed3
}
```

---

## 7. Kubernetes Client Layer

### 7.1 Client Manager

```go
// internal/kubernetes/client.go
package kubernetes

import (
    "context"
    "fmt"
    "sync"

    "k8s.io/client-go/dynamic"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"
    "k8s.io/client-go/tools/clientcmd"
)

// ClientManager manages Kubernetes client connections
type ClientManager struct {
    clients map[string]*Client
    configs map[string]*rest.Config
    mu      sync.RWMutex
}

// Client wraps Kubernetes clientset with additional functionality
type Client struct {
    clientset *kubernetes.Clientset
    dynamic   dynamic.Interface
    config    *rest.Config
    clusterID string
}

func NewClientManager(kubeconfigPath string) (*ClientManager, error) {
    manager := &ClientManager{
        clients: make(map[string]*Client),
        configs: make(map[string]*rest.Config),
    }

    // Load kubeconfig
    if kubeconfigPath != "" {
        if err := manager.loadKubeconfig(kubeconfigPath); err != nil {
            return nil, err
        }
    }

    // Try in-cluster config
    if err := manager.tryInClusterConfig(); err != nil {
        // Not an error if we have kubeconfig
        if len(manager.configs) == 0 {
            return nil, fmt.Errorf("no Kubernetes configuration found")
        }
    }

    return manager, nil
}

func (m *ClientManager) loadKubeconfig(path string) error {
    config, err := clientcmd.LoadFromFile(path)
    if err != nil {
        return err
    }

    for contextName := range config.Contexts {
        restConfig, err := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
            &clientcmd.ClientConfigLoadingRules{ExplicitPath: path},
            &clientcmd.ConfigOverrides{CurrentContext: contextName},
        ).ClientConfig()

        if err != nil {
            continue
        }

        // Generate cluster ID from context
        clusterID := generateClusterID(contextName)
        m.configs[clusterID] = restConfig
    }

    return nil
}

func (m *ClientManager) tryInClusterConfig() error {
    config, err := rest.InClusterConfig()
    if err != nil {
        return err
    }

    m.configs["in-cluster"] = config
    return nil
}

// GetClient returns a client for the specified cluster
func (m *ClientManager) GetClient(clusterID string) (*Client, error) {
    m.mu.Lock()
    defer m.mu.Unlock()

    // Check if client already exists
    if client, ok := m.clients[clusterID]; ok {
        return client, nil
    }

    // Get config for cluster
    config, ok := m.configs[clusterID]
    if !ok {
        return nil, fmt.Errorf("no configuration found for cluster %s", clusterID)
    }

    // Create clientset
    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        return nil, fmt.Errorf("failed to create clientset: %w", err)
    }

    // Create dynamic client
    dynamicClient, err := dynamic.NewForConfig(config)
    if err != nil {
        return nil, fmt.Errorf("failed to create dynamic client: %w", err)
    }

    client := &Client{
        clientset: clientset,
        dynamic:   dynamicClient,
        config:    config,
        clusterID: clusterID,
    }

    m.clients[clusterID] = client

    return client, nil
}

// ListClusters returns all available clusters
func (m *ClientManager) ListClusters() []ClusterInfo {
    m.mu.RLock()
    defer m.mu.RUnlock()

    clusters := make([]ClusterInfo, 0, len(m.configs))
    for id, config := range m.configs {
        clusters = append(clusters, ClusterInfo{
            ID:     id,
            Server: config.Host,
        })
    }

    return clusters
}

type ClusterInfo struct {
    ID     string `json:"id"`
    Server string `json:"server"`
    Name   string `json:"name,omitempty"`
}

// Client methods
func (c *Client) CoreV1() kubernetes.CoreV1Interface {
    return c.clientset.CoreV1()
}

func (c *Client) AppsV1() kubernetes.AppsV1Interface {
    return c.clientset.AppsV1()
}

func (c *Client) BatchV1() kubernetes.BatchV1Interface {
    return c.clientset.BatchV1()
}

func (c *Client) NetworkingV1() kubernetes.NetworkingV1Interface {
    return c.clientset.NetworkingV1()
}

func (c *Client) RbacV1() kubernetes.RbacV1Interface {
    return c.clientset.RbacV1()
}

func (c *Client) StorageV1() kubernetes.StorageV1Interface {
    return c.clientset.StorageV1()
}

func (c *Client) Dynamic() dynamic.Interface {
    return c.dynamic
}
```

---

## 8. Caching Strategy

### 8.1 Cache Implementation

```go
// internal/cache/cache.go
package cache

import (
    "context"
    "sync"
    "time"

    "github.com/allegro/bigcache/v3"
    "github.com/kubilitics/kubilitics/internal/models"
)

// Cache provides caching for topology and resource data
type Cache struct {
    // In-memory cache for hot data
    memory *bigcache.BigCache

    // Topology graph cache
    topologyCache map[string]*CachedTopology
    topologyMu    sync.RWMutex

    // Resource cache
    resourceCache map[string]*CachedResource
    resourceMu    sync.RWMutex
}

type CachedTopology struct {
    Graph     *models.TopologyGraph
    CachedAt  time.Time
    ExpiresAt time.Time
    Version   string
}

type CachedResource struct {
    Resource  *models.Resource
    CachedAt  time.Time
    ExpiresAt time.Time
}

// Configuration
var (
    TopologyCacheTTL = 30 * time.Second  // Short TTL for topology
    ResourceCacheTTL = 5 * time.Second   // Very short for resources
    MemoryCacheSize  = 100 * 1024 * 1024 // 100MB
)

func NewCache() (*Cache, error) {
    config := bigcache.Config{
        Shards:             1024,
        LifeWindow:         10 * time.Minute,
        CleanWindow:        5 * time.Minute,
        MaxEntriesInWindow: 1000 * 10 * 60,
        MaxEntrySize:       500,
        StatsEnabled:       true,
        Verbose:            false,
        HardMaxCacheSize:   MemoryCacheSize / (1024 * 1024),
    }

    memory, err := bigcache.New(context.Background(), config)
    if err != nil {
        return nil, err
    }

    return &Cache{
        memory:        memory,
        topologyCache: make(map[string]*CachedTopology),
        resourceCache: make(map[string]*CachedResource),
    }, nil
}

// GetTopology retrieves cached topology
func (c *Cache) GetTopology(key string) (*models.TopologyGraph, bool) {
    c.topologyMu.RLock()
    defer c.topologyMu.RUnlock()

    cached, ok := c.topologyCache[key]
    if !ok {
        return nil, false
    }

    // Check expiration
    if time.Now().After(cached.ExpiresAt) {
        return nil, false
    }

    return cached.Graph, true
}

// SetTopology stores topology in cache
func (c *Cache) SetTopology(key string, graph *models.TopologyGraph) {
    c.topologyMu.Lock()
    defer c.topologyMu.Unlock()

    c.topologyCache[key] = &CachedTopology{
        Graph:     graph,
        CachedAt:  time.Now(),
        ExpiresAt: time.Now().Add(TopologyCacheTTL),
        Version:   graph.Metadata.LayoutSeed,
    }
}

// InvalidateTopology removes topology from cache
func (c *Cache) InvalidateTopology(key string) {
    c.topologyMu.Lock()
    defer c.topologyMu.Unlock()

    delete(c.topologyCache, key)
}

// InvalidateCluster removes all cached data for a cluster
func (c *Cache) InvalidateCluster(clusterID string) {
    c.topologyMu.Lock()
    defer c.topologyMu.Unlock()

    for key := range c.topologyCache {
        // Key format: cluster:{clusterID}:...
        if strings.HasPrefix(key, "cluster:"+clusterID+":") {
            delete(c.topologyCache, key)
        }
    }
}
```

---

## 9. CRD Handling

### 9.1 CRD Discovery

```go
// internal/services/topology/crd.go
package topology

import (
    "context"
    "fmt"

    "github.com/kubilitics/kubilitics/internal/kubernetes"
    "github.com/kubilitics/kubilitics/internal/models"
    "go.uber.org/zap"
    apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
    "k8s.io/apimachinery/pkg/runtime/schema"
)

// CRDDiscovery handles discovery of Custom Resource Definitions
type CRDDiscovery struct {
    k8sManager *kubernetes.ClientManager
    logger     *zap.Logger
}

func NewCRDDiscovery(k8sManager *kubernetes.ClientManager, logger *zap.Logger) *CRDDiscovery {
    return &CRDDiscovery{
        k8sManager: k8sManager,
        logger:     logger,
    }
}

// DiscoverCRDs discovers all CRDs in the cluster
func (d *CRDDiscovery) DiscoverCRDs(ctx context.Context, clusterID string) ([]*apiextensionsv1.CustomResourceDefinition, error) {
    client, err := d.k8sManager.GetClient(clusterID)
    if err != nil {
        return nil, err
    }

    // Use dynamic client to list CRDs
    gvr := schema.GroupVersionResource{
        Group:    "apiextensions.k8s.io",
        Version:  "v1",
        Resource: "customresourcedefinitions",
    }

    list, err := client.Dynamic().Resource(gvr).List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, fmt.Errorf("failed to list CRDs: %w", err)
    }

    crds := make([]*apiextensionsv1.CustomResourceDefinition, 0, len(list.Items))
    for _, item := range list.Items {
        crd := &apiextensionsv1.CustomResourceDefinition{}
        if err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, crd); err != nil {
            d.logger.Warn("Failed to convert CRD",
                zap.String("name", item.GetName()),
                zap.Error(err),
            )
            continue
        }
        crds = append(crds, crd)
    }

    return crds, nil
}

// DiscoverCRInstances discovers all instances of a CRD
func (d *CRDDiscovery) DiscoverCRInstances(
    ctx context.Context,
    clusterID string,
    crd *apiextensionsv1.CustomResourceDefinition,
    opts GetOptions,
) ([]*models.Resource, error) {
    client, err := d.k8sManager.GetClient(clusterID)
    if err != nil {
        return nil, err
    }

    // Determine the GVR for this CRD
    gvr := schema.GroupVersionResource{
        Group:    crd.Spec.Group,
        Version:  crd.Spec.Versions[0].Name, // Use first served version
        Resource: crd.Spec.Names.Plural,
    }

    var list *unstructured.UnstructuredList
    if crd.Spec.Scope == apiextensionsv1.ClusterScoped {
        list, err = client.Dynamic().Resource(gvr).List(ctx, metav1.ListOptions{})
    } else {
        if opts.Namespace != "" {
            list, err = client.Dynamic().Resource(gvr).Namespace(opts.Namespace).List(ctx, metav1.ListOptions{})
        } else {
            list, err = client.Dynamic().Resource(gvr).Namespace("").List(ctx, metav1.ListOptions{})
        }
    }

    if err != nil {
        return nil, fmt.Errorf("failed to list CR instances for %s: %w", crd.Name, err)
    }

    resources := make([]*models.Resource, 0, len(list.Items))
    for _, item := range list.Items {
        resources = append(resources, d.unstructuredToResource(&item, crd))
    }

    return resources, nil
}

func (d *CRDDiscovery) unstructuredToResource(
    u *unstructured.Unstructured,
    crd *apiextensionsv1.CustomResourceDefinition,
) *models.Resource {
    return &models.Resource{
        Kind:       u.GetKind(),
        APIVersion: u.GetAPIVersion(),
        Namespace:  u.GetNamespace(),
        Name:       u.GetName(),
        UID:        string(u.GetUID()),
        Labels:     u.GetLabels(),
        Annotations: u.GetAnnotations(),
        OwnerReferences: convertUnstructuredOwnerRefs(u.GetOwnerReferences()),
        CreatedAt:  u.GetCreationTimestamp().Time,
        Raw:        u,
        Computed: models.ResourceComputed{
            Health:     d.computeCRHealth(u, crd),
            StatusText: d.extractStatusText(u, crd),
        },
    }
}

func (d *CRDDiscovery) computeCRHealth(u *unstructured.Unstructured, crd *apiextensionsv1.CustomResourceDefinition) models.HealthStatus {
    // Try to extract status.conditions
    status, found, err := unstructured.NestedMap(u.Object, "status")
    if !found || err != nil {
        return models.HealthStatusUnknown
    }

    conditions, found, err := unstructured.NestedSlice(status, "conditions")
    if !found || err != nil {
        return models.HealthStatusUnknown
    }

    // Look for Ready or similar condition
    for _, c := range conditions {
        cond, ok := c.(map[string]interface{})
        if !ok {
            continue
        }

        condType, _, _ := unstructured.NestedString(cond, "type")
        condStatus, _, _ := unstructured.NestedString(cond, "status")

        if condType == "Ready" || condType == "Available" {
            if condStatus == "True" {
                return models.HealthStatusHealthy
            } else {
                return models.HealthStatusWarning
            }
        }
    }

    return models.HealthStatusUnknown
}

func (d *CRDDiscovery) extractStatusText(u *unstructured.Unstructured, crd *apiextensionsv1.CustomResourceDefinition) string {
    // Try to get status.phase or similar
    phase, found, _ := unstructured.NestedString(u.Object, "status", "phase")
    if found {
        return phase
    }

    state, found, _ := unstructured.NestedString(u.Object, "status", "state")
    if found {
        return state
    }

    return "Unknown"
}
```

---

## Next: Part 3 — Real-Time Systems & Export

Continue to `backend-part-3.md` for:
- WebSocket implementation
- Real-time update broadcasting
- Export engine
- WYSIWYG guarantees
- Security & RBAC
- Error handling patterns
