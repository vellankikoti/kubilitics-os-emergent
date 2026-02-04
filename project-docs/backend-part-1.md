# Kubilitics Backend Engineering Blueprint — Part 1

## Architecture, Services & API Contracts

**Document Version:** 1.0
**Last Updated:** February 2026
**Status:** AUTHORITATIVE — Single Source of Truth
**Language:** Go 1.24+

---

## Table of Contents

1. [Backend Architecture Overview](#1-backend-architecture-overview)
2. [Service Structure](#2-service-structure)
3. [Module Dependencies](#3-module-dependencies)
4. [API Contracts — Resource Endpoints](#4-api-contracts--resource-endpoints)
5. [API Contracts — Topology Endpoints](#5-api-contracts--topology-endpoints)
6. [API Contracts — Search Endpoints](#6-api-contracts--search-endpoints)
7. [API Contracts — Action Endpoints](#7-api-contracts--action-endpoints)
8. [Error Handling Standards](#8-error-handling-standards)

---

## 1. Backend Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KUBILITICS BACKEND ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          API LAYER                                   │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │    │
│  │  │  REST API   │  │  WebSocket  │  │  gRPC (MCP) │  │  Tauri IPC │ │    │
│  │  │  (HTTP/2)   │  │  (Real-time)│  │  (AI/Tools) │  │  (Desktop) │ │    │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬─────┘ │    │
│  │         └────────────────┴────────────────┴────────────────┘       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                         SERVICE LAYER                                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Resource   │  │  Topology   │  │   Search    │  │   Action    │  │  │
│  │  │  Service    │  │   Engine    │  │   Service   │  │   Service   │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │  │
│  │         │                │                │                │         │  │
│  │  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  │  │
│  │  │   Export    │  │ Validation  │  │    Log      │  │    Exec     │  │  │
│  │  │   Engine    │  │   Engine    │  │  Streamer   │  │   Handler   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                          DATA LAYER                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  Kubernetes │  │   Cache     │  │   SQLite    │  │   Config    │  │  │
│  │  │  Client     │  │   (Memory)  │  │   (State)   │  │   Store     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐  │
│  │                        KUBERNETES CLUSTER                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │  API Server │  │   etcd      │  │  Metrics    │  │  Logs       │  │  │
│  │  │             │  │   (Events)  │  │  (Prom)     │  │  (Loki)     │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Sidecar** | Embedded in Tauri app | Desktop application |
| **Standalone** | Separate process | Development, debugging |
| **In-Cluster** | Deployed via Helm | Web deployment, shared access |
| **Hybrid** | Desktop connects to in-cluster | Enterprise multi-user |

### 1.3 Technology Stack

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Language** | Go | 1.24+ | K8s-native, performance |
| **HTTP Server** | Chi | v5.0.12 | Lightweight, idiomatic |
| **WebSocket** | Gorilla WebSocket | v1.5.1 | Battle-tested |
| **K8s Client** | client-go | v0.29.0 | Official SDK |
| **Database** | SQLite | 3.45+ | Embedded, zero-config |
| **Cache** | BigCache | v3.1.0 | In-memory, fast |
| **Config** | Viper | v1.18.2 | Multi-format support |
| **Logging** | Zap | v1.26.0 | Structured, performant |
| **Metrics** | Prometheus client | v1.18.0 | Standard observability |
| **Testing** | Testify | v1.8.4 | Assertions, mocks |

---

## 2. Service Structure

### 2.1 Project Layout

```
kubilitics-backend/
├── cmd/
│   ├── kubilitics/           # Main application entry
│   │   └── main.go
│   ├── sidecar/              # Tauri sidecar entry
│   │   └── main.go
│   └── server/               # Standalone server entry
│       └── main.go
│
├── internal/
│   ├── api/                  # API handlers
│   │   ├── handlers/
│   │   │   ├── resources.go
│   │   │   ├── topology.go
│   │   │   ├── search.go
│   │   │   ├── actions.go
│   │   │   ├── logs.go
│   │   │   ├── exec.go
│   │   │   └── export.go
│   │   ├── middleware/
│   │   │   ├── auth.go
│   │   │   ├── cors.go
│   │   │   ├── logging.go
│   │   │   ├── ratelimit.go
│   │   │   └── recovery.go
│   │   └── router.go
│   │
│   ├── services/             # Business logic
│   │   ├── resource/
│   │   │   ├── service.go
│   │   │   ├── pods.go
│   │   │   ├── deployments.go
│   │   │   ├── services.go
│   │   │   └── ... (50+ resource types)
│   │   ├── topology/
│   │   │   ├── engine.go
│   │   │   ├── discovery.go
│   │   │   ├── relationships.go
│   │   │   ├── graph.go
│   │   │   ├── layout.go
│   │   │   └── validation.go
│   │   ├── search/
│   │   │   ├── service.go
│   │   │   ├── indexer.go
│   │   │   └── query.go
│   │   ├── action/
│   │   │   ├── service.go
│   │   │   ├── executor.go
│   │   │   └── validator.go
│   │   ├── export/
│   │   │   ├── engine.go
│   │   │   ├── png.go
│   │   │   ├── svg.go
│   │   │   └── pdf.go
│   │   └── realtime/
│   │       ├── hub.go
│   │       ├── client.go
│   │       └── broadcaster.go
│   │
│   ├── kubernetes/           # K8s client abstraction
│   │   ├── client.go
│   │   ├── clientset.go
│   │   ├── discovery.go
│   │   ├── informers.go
│   │   └── watchers/
│   │       ├── watcher.go
│   │       ├── pods.go
│   │       ├── deployments.go
│   │       └── ... (resource watchers)
│   │
│   ├── cache/                # Caching layer
│   │   ├── cache.go
│   │   ├── memory.go
│   │   └── sqlite.go
│   │
│   ├── config/               # Configuration
│   │   ├── config.go
│   │   └── kubeconfig.go
│   │
│   └── models/               # Domain models
│       ├── topology.go
│       ├── resource.go
│       ├── search.go
│       └── action.go
│
├── pkg/                      # Public packages
│   ├── types/                # Shared types
│   │   ├── kubernetes.go
│   │   ├── topology.go
│   │   └── api.go
│   └── utils/
│       ├── hash.go
│       ├── strings.go
│       └── time.go
│
├── api/                      # API specifications
│   └── openapi/
│       └── kubilitics.yaml
│
├── configs/                  # Configuration files
│   ├── default.yaml
│   └── development.yaml
│
├── scripts/                  # Build scripts
│   ├── build.sh
│   └── generate.sh
│
├── tests/                    # Test files
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
│
├── go.mod
├── go.sum
├── Makefile
└── Dockerfile
```

### 2.2 Main Entry Point

```go
// cmd/kubilitics/main.go
package main

import (
    "context"
    "fmt"
    "os"
    "os/signal"
    "syscall"

    "github.com/kubilitics/kubilitics/internal/api"
    "github.com/kubilitics/kubilitics/internal/config"
    "github.com/kubilitics/kubilitics/internal/kubernetes"
    "github.com/kubilitics/kubilitics/internal/services/realtime"
    "github.com/kubilitics/kubilitics/internal/services/resource"
    "github.com/kubilitics/kubilitics/internal/services/search"
    "github.com/kubilitics/kubilitics/internal/services/topology"
    "go.uber.org/zap"
)

func main() {
    // Initialize logger
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        logger.Fatal("Failed to load configuration", zap.Error(err))
    }

    // Create context with cancellation
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Initialize Kubernetes client manager
    k8sManager, err := kubernetes.NewClientManager(cfg.Kubeconfig)
    if err != nil {
        logger.Fatal("Failed to initialize Kubernetes client", zap.Error(err))
    }

    // Initialize services
    resourceSvc := resource.NewService(k8sManager, logger)
    topologySvc := topology.NewEngine(k8sManager, logger)
    searchSvc := search.NewService(k8sManager, logger)
    realtimeHub := realtime.NewHub(logger)

    // Start background services
    go realtimeHub.Run(ctx)
    go topologySvc.StartWatchers(ctx)

    // Create and start API server
    server := api.NewServer(api.ServerConfig{
        Port:        cfg.Server.Port,
        Logger:      logger,
        ResourceSvc: resourceSvc,
        TopologySvc: topologySvc,
        SearchSvc:   searchSvc,
        RealtimeHub: realtimeHub,
    })

    // Start server in goroutine
    go func() {
        if err := server.Start(); err != nil {
            logger.Fatal("Server failed", zap.Error(err))
        }
    }()

    logger.Info("Kubilitics backend started",
        zap.String("port", fmt.Sprintf("%d", cfg.Server.Port)),
        zap.String("mode", cfg.Mode),
    )

    // Wait for shutdown signal
    sigCh := make(chan os.Signal, 1)
    signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
    <-sigCh

    logger.Info("Shutting down...")
    cancel()

    // Graceful shutdown
    if err := server.Shutdown(ctx); err != nil {
        logger.Error("Server shutdown error", zap.Error(err))
    }
}
```

---

## 3. Module Dependencies

### 3.1 go.mod

```go
// go.mod
module github.com/kubilitics/kubilitics

go 1.24

require (
    // HTTP & Routing
    github.com/go-chi/chi/v5 v5.0.12
    github.com/go-chi/cors v1.2.1
    github.com/go-chi/render v1.0.3

    // WebSocket
    github.com/gorilla/websocket v1.5.1

    // Kubernetes
    k8s.io/api v0.29.0
    k8s.io/apimachinery v0.29.0
    k8s.io/client-go v0.29.0

    // Database
    github.com/mattn/go-sqlite3 v1.14.22
    gorm.io/gorm v1.25.5
    gorm.io/driver/sqlite v1.5.4

    // Cache
    github.com/allegro/bigcache/v3 v3.1.0

    // Configuration
    github.com/spf13/viper v1.18.2

    // Logging
    go.uber.org/zap v1.26.0

    // Metrics
    github.com/prometheus/client_golang v1.18.0

    // Validation
    github.com/go-playground/validator/v10 v10.17.0

    // Utilities
    github.com/google/uuid v1.6.0
    github.com/samber/lo v1.39.0
    golang.org/x/sync v0.6.0

    // Testing
    github.com/stretchr/testify v1.8.4
    github.com/golang/mock v1.6.0
)
```

---

## 4. API Contracts — Resource Endpoints

### 4.1 Resource List Endpoint

```yaml
# GET /api/v1/clusters/{clusterId}/resources/{resourceType}
---
path: /api/v1/clusters/{clusterId}/resources/{resourceType}
method: GET
summary: List resources of a specific type
description: |
  Returns a paginated list of Kubernetes resources with optional filtering.
  Supports all 50+ resource types defined in the PRD.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string
    description: Cluster identifier

  - name: resourceType
    in: path
    required: true
    schema:
      type: string
      enum:
        - pods
        - deployments
        - statefulsets
        - daemonsets
        - replicasets
        - jobs
        - cronjobs
        - services
        - ingresses
        - networkpolicies
        - endpointslices
        - persistentvolumes
        - persistentvolumeclaims
        - storageclasses
        - configmaps
        - secrets
        - resourcequotas
        - limitranges
        - serviceaccounts
        - roles
        - rolebindings
        - clusterroles
        - clusterrolebindings
        - nodes
        - namespaces
        - events
        - crds
        # ... (all 50+ types)

  - name: namespace
    in: query
    required: false
    schema:
      type: string
    description: Filter by namespace (empty for all namespaces)

  - name: labelSelector
    in: query
    required: false
    schema:
      type: string
    description: Kubernetes label selector (e.g., "app=nginx,version=v1")

  - name: fieldSelector
    in: query
    required: false
    schema:
      type: string
    description: Kubernetes field selector

  - name: page
    in: query
    required: false
    schema:
      type: integer
      default: 1
      minimum: 1

  - name: pageSize
    in: query
    required: false
    schema:
      type: integer
      default: 50
      minimum: 1
      maximum: 500

  - name: sortBy
    in: query
    required: false
    schema:
      type: string
      enum: [name, namespace, createdAt, status]
      default: name

  - name: sortOrder
    in: query
    required: false
    schema:
      type: string
      enum: [asc, desc]
      default: asc

responses:
  200:
    description: Resource list
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ResourceListResponse'

  400:
    description: Invalid request
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ErrorResponse'

  401:
    description: Unauthorized
  403:
    description: Forbidden - insufficient RBAC permissions
  404:
    description: Cluster not found
  500:
    description: Internal server error
```

### 4.2 Resource Get Endpoint

```yaml
# GET /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}
---
path: /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}
method: GET
summary: Get a specific resource
description: |
  Returns detailed information about a single Kubernetes resource.
  For cluster-scoped resources, use "_" as the namespace.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string

  - name: resourceType
    in: path
    required: true
    schema:
      type: string

  - name: namespace
    in: path
    required: true
    schema:
      type: string
    description: Namespace or "_" for cluster-scoped resources

  - name: name
    in: path
    required: true
    schema:
      type: string

responses:
  200:
    description: Resource details
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ResourceResponse'
```

### 4.3 Response Schemas

```go
// internal/models/resource.go
package models

import (
    "time"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/runtime"
)

// ResourceListResponse represents paginated resource list
type ResourceListResponse struct {
    // API version
    APIVersion string `json:"apiVersion"`

    // Resource kind (e.g., "PodList")
    Kind string `json:"kind"`

    // List metadata
    Metadata ListMetadata `json:"metadata"`

    // Resource items
    Items []ResourceItem `json:"items"`
}

type ListMetadata struct {
    // Total count (without pagination)
    TotalCount int `json:"totalCount"`

    // Continuation token for next page
    Continue string `json:"continue,omitempty"`

    // Resource version for watching
    ResourceVersion string `json:"resourceVersion"`
}

// ResourceItem represents a single resource
type ResourceItem struct {
    // API version
    APIVersion string `json:"apiVersion"`

    // Resource kind
    Kind string `json:"kind"`

    // Standard metadata
    Metadata ResourceMetadata `json:"metadata"`

    // Spec (varies by resource type)
    Spec runtime.RawExtension `json:"spec,omitempty"`

    // Status (varies by resource type)
    Status runtime.RawExtension `json:"status,omitempty"`

    // Computed fields for UI
    Computed ComputedFields `json:"computed"`
}

type ResourceMetadata struct {
    Name              string            `json:"name"`
    Namespace         string            `json:"namespace,omitempty"`
    UID               string            `json:"uid"`
    ResourceVersion   string            `json:"resourceVersion"`
    CreationTimestamp time.Time         `json:"creationTimestamp"`
    Labels            map[string]string `json:"labels,omitempty"`
    Annotations       map[string]string `json:"annotations,omitempty"`
    OwnerReferences   []OwnerReference  `json:"ownerReferences,omitempty"`
}

type OwnerReference struct {
    APIVersion string `json:"apiVersion"`
    Kind       string `json:"kind"`
    Name       string `json:"name"`
    UID        string `json:"uid"`
    Controller *bool  `json:"controller,omitempty"`
}

// ComputedFields contains pre-calculated values for UI
type ComputedFields struct {
    // Health status
    Health HealthStatus `json:"health"`

    // Human-readable status
    StatusText string `json:"statusText"`

    // Age in human-readable format
    Age string `json:"age"`

    // Resource-specific computed fields
    Extra map[string]interface{} `json:"extra,omitempty"`
}

type HealthStatus string

const (
    HealthStatusHealthy  HealthStatus = "healthy"
    HealthStatusWarning  HealthStatus = "warning"
    HealthStatusCritical HealthStatus = "critical"
    HealthStatusUnknown  HealthStatus = "unknown"
)

// ResourceResponse for single resource GET
type ResourceResponse struct {
    APIVersion string                 `json:"apiVersion"`
    Kind       string                 `json:"kind"`
    Metadata   ResourceMetadata       `json:"metadata"`
    Spec       runtime.RawExtension   `json:"spec,omitempty"`
    Status     runtime.RawExtension   `json:"status,omitempty"`
    Computed   ComputedFields         `json:"computed"`
    Raw        runtime.RawExtension   `json:"raw,omitempty"` // Full YAML
}
```

### 4.4 Resource Handler Implementation

```go
// internal/api/handlers/resources.go
package handlers

import (
    "net/http"
    "strconv"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/render"
    "github.com/kubilitics/kubilitics/internal/models"
    "github.com/kubilitics/kubilitics/internal/services/resource"
    "go.uber.org/zap"
)

type ResourceHandler struct {
    service *resource.Service
    logger  *zap.Logger
}

func NewResourceHandler(svc *resource.Service, logger *zap.Logger) *ResourceHandler {
    return &ResourceHandler{
        service: svc,
        logger:  logger,
    }
}

// ListResources handles GET /api/v1/clusters/{clusterId}/resources/{resourceType}
func (h *ResourceHandler) ListResources(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    // Parse path parameters
    clusterID := chi.URLParam(r, "clusterId")
    resourceType := chi.URLParam(r, "resourceType")

    // Parse query parameters
    opts := resource.ListOptions{
        Namespace:     r.URL.Query().Get("namespace"),
        LabelSelector: r.URL.Query().Get("labelSelector"),
        FieldSelector: r.URL.Query().Get("fieldSelector"),
        Page:          parseIntParam(r, "page", 1),
        PageSize:      parseIntParam(r, "pageSize", 50),
        SortBy:        r.URL.Query().Get("sortBy"),
        SortOrder:     r.URL.Query().Get("sortOrder"),
    }

    // Validate page size
    if opts.PageSize > 500 {
        opts.PageSize = 500
    }

    // Call service
    result, err := h.service.List(ctx, clusterID, resourceType, opts)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    render.JSON(w, r, result)
}

// GetResource handles GET /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}
func (h *ResourceHandler) GetResource(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()

    clusterID := chi.URLParam(r, "clusterId")
    resourceType := chi.URLParam(r, "resourceType")
    namespace := chi.URLParam(r, "namespace")
    name := chi.URLParam(r, "name")

    // Handle cluster-scoped resources
    if namespace == "_" {
        namespace = ""
    }

    result, err := h.service.Get(ctx, clusterID, resourceType, namespace, name)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    render.JSON(w, r, result)
}

func (h *ResourceHandler) handleError(w http.ResponseWriter, r *http.Request, err error) {
    switch {
    case errors.Is(err, resource.ErrNotFound):
        render.Status(r, http.StatusNotFound)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "NOT_FOUND",
            Message: err.Error(),
        })
    case errors.Is(err, resource.ErrForbidden):
        render.Status(r, http.StatusForbidden)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "FORBIDDEN",
            Message: "Insufficient RBAC permissions",
        })
    case errors.Is(err, resource.ErrClusterNotFound):
        render.Status(r, http.StatusNotFound)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "CLUSTER_NOT_FOUND",
            Message: "Cluster not found or not connected",
        })
    default:
        h.logger.Error("Resource handler error",
            zap.Error(err),
            zap.String("path", r.URL.Path),
        )
        render.Status(r, http.StatusInternalServerError)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "INTERNAL_ERROR",
            Message: "An internal error occurred",
        })
    }
}

func parseIntParam(r *http.Request, name string, defaultVal int) int {
    val := r.URL.Query().Get(name)
    if val == "" {
        return defaultVal
    }
    parsed, err := strconv.Atoi(val)
    if err != nil {
        return defaultVal
    }
    return parsed
}
```

---

## 5. API Contracts — Topology Endpoints

### 5.1 Full Topology Endpoint

```yaml
# GET /api/v1/clusters/{clusterId}/topology
---
path: /api/v1/clusters/{clusterId}/topology
method: GET
summary: Get complete cluster topology graph
description: |
  Returns the full topology graph for the cluster.
  This is the SINGLE SOURCE OF TRUTH for topology.
  UI, Export, AI, and MCP all consume this same endpoint.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string

  - name: namespace
    in: query
    required: false
    schema:
      type: string
    description: Filter to specific namespace (still shows all relationships)

  - name: includeClusterScoped
    in: query
    required: false
    schema:
      type: boolean
      default: true
    description: Include cluster-scoped resources (Nodes, PVs, etc.)

responses:
  200:
    description: Complete topology graph
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/TopologyGraph'

  400:
    description: Invalid request
  404:
    description: Cluster not found
  500:
    description: Internal server error
  503:
    description: Topology incomplete - retry
```

### 5.2 Resource-Centered Topology Endpoint

```yaml
# GET /api/v1/clusters/{clusterId}/topology/resource/{kind}/{namespace}/{name}
---
path: /api/v1/clusters/{clusterId}/topology/resource/{kind}/{namespace}/{name}
method: GET
summary: Get topology centered on a specific resource
description: |
  Returns the topology graph with full closure around a specific resource.
  Used for the Pod Detail > Topology tab (and other resource detail views).

  CRITICAL: This endpoint MUST return complete graph closure.
  No depth limits. All relationships must be included.
  Missing relationships are BUGS.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string

  - name: kind
    in: path
    required: true
    schema:
      type: string
    description: Resource kind (e.g., "Pod", "Deployment")

  - name: namespace
    in: path
    required: true
    schema:
      type: string
    description: Resource namespace or "_" for cluster-scoped

  - name: name
    in: path
    required: true
    schema:
      type: string

  - name: depth
    in: query
    required: false
    schema:
      type: integer
      default: -1
    description: |
      Traversal depth limit. -1 means full closure (RECOMMENDED).
      Any positive value will limit relationship traversal.
      NOTE: Limited depth may hide important relationships.

responses:
  200:
    description: Resource-centered topology graph
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/TopologyGraph'
```

### 5.3 Topology Graph Schema

```go
// internal/models/topology.go
package models

import (
    "time"
)

// TopologyGraph is the canonical graph representation
// This is the SINGLE SOURCE OF TRUTH consumed by all Kubilitics surfaces
type TopologyGraph struct {
    // Schema version for compatibility
    SchemaVersion string `json:"schemaVersion"`

    // Graph nodes (Kubernetes resources)
    Nodes []TopologyNode `json:"nodes"`

    // Graph edges (relationships)
    Edges []TopologyEdge `json:"edges"`

    // Graph metadata
    Metadata GraphMetadata `json:"metadata"`
}

// TopologyNode represents a Kubernetes resource in the graph
type TopologyNode struct {
    // Unique identifier: {kind}/{namespace}/{name} or {kind}/{name}
    ID string `json:"id"`

    // Kubernetes resource kind
    Kind string `json:"kind"`

    // API version
    APIVersion string `json:"apiVersion"`

    // Resource namespace (empty for cluster-scoped)
    Namespace string `json:"namespace"`

    // Resource name
    Name string `json:"name"`

    // Current status for visual encoding
    Status string `json:"status"`

    // Resource metadata
    Metadata NodeMetadata `json:"metadata"`

    // Computed properties for rendering
    Computed NodeComputed `json:"computed"`
}

type NodeMetadata struct {
    Labels      map[string]string `json:"labels"`
    Annotations map[string]string `json:"annotations"`
    UID         string            `json:"uid"`
    CreatedAt   time.Time         `json:"createdAt"`
}

type NodeComputed struct {
    // Health indicator
    Health HealthStatus `json:"health"`

    // Human-readable status
    StatusText string `json:"statusText"`

    // Pod-specific
    RestartCount *int `json:"restartCount,omitempty"`
    Phase        *string `json:"phase,omitempty"`

    // Controller-specific
    Replicas *ReplicaStatus `json:"replicas,omitempty"`

    // Node-specific
    Capacity *NodeCapacity `json:"capacity,omitempty"`

    // Service-specific
    ClusterIP *string `json:"clusterIP,omitempty"`
    Type      *string `json:"type,omitempty"`
}

type ReplicaStatus struct {
    Desired   int `json:"desired"`
    Ready     int `json:"ready"`
    Available int `json:"available"`
    Updated   int `json:"updated,omitempty"`
}

type NodeCapacity struct {
    CPU    string `json:"cpu"`
    Memory string `json:"memory"`
    Pods   string `json:"pods"`
}

// TopologyEdge represents a relationship between resources
type TopologyEdge struct {
    // Unique identifier
    ID string `json:"id"`

    // Source node ID
    Source string `json:"source"`

    // Target node ID
    Target string `json:"target"`

    // Relationship type
    RelationshipType RelationshipType `json:"relationshipType"`

    // Human-readable label
    Label string `json:"label"`

    // Edge metadata
    Metadata EdgeMetadata `json:"metadata"`
}

type EdgeMetadata struct {
    // How this relationship was discovered
    Derivation string `json:"derivation"`

    // Confidence level (1.0 = certain)
    Confidence float64 `json:"confidence"`

    // Source field in Kubernetes API that defines this relationship
    SourceField string `json:"sourceField"`
}

type RelationshipType string

const (
    RelationshipOwns       RelationshipType = "owns"
    RelationshipSelects    RelationshipType = "selects"
    RelationshipMounts     RelationshipType = "mounts"
    RelationshipReferences RelationshipType = "references"
    RelationshipConfigures RelationshipType = "configures"
    RelationshipPermits    RelationshipType = "permits"
    RelationshipValidates  RelationshipType = "validates"
    RelationshipMutates    RelationshipType = "mutates"
    RelationshipExposes    RelationshipType = "exposes"
    RelationshipRoutes     RelationshipType = "routes"
    RelationshipStores     RelationshipType = "stores"
    RelationshipSchedules  RelationshipType = "schedules"
    RelationshipLimits     RelationshipType = "limits"
    RelationshipManages    RelationshipType = "manages"
    RelationshipContains   RelationshipType = "contains"
)

// GraphMetadata contains information about the graph itself
type GraphMetadata struct {
    // Cluster ID
    ClusterID string `json:"clusterId"`

    // Generation timestamp
    GeneratedAt time.Time `json:"generatedAt"`

    // Layout seed for deterministic rendering
    // CRITICAL: Same seed MUST produce same layout
    LayoutSeed string `json:"layoutSeed"`

    // Whether graph is complete (all relationships discovered)
    // If false, Warnings must explain why
    IsComplete bool `json:"isComplete"`

    // Validation result
    Validation ValidationResult `json:"validation"`

    // Any warnings during graph construction
    Warnings []GraphWarning `json:"warnings,omitempty"`

    // Statistics
    Stats GraphStats `json:"stats"`
}

type ValidationResult struct {
    // Whether validation passed
    IsValid bool `json:"isValid"`

    // Validation errors (if any)
    Errors []ValidationError `json:"errors,omitempty"`
}

type ValidationError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    NodeID  string `json:"nodeId,omitempty"`
}

type GraphWarning struct {
    Code          string   `json:"code"`
    Message       string   `json:"message"`
    AffectedNodes []string `json:"affectedNodes,omitempty"`
}

type GraphStats struct {
    NodeCount        int            `json:"nodeCount"`
    EdgeCount        int            `json:"edgeCount"`
    NamespaceCount   int            `json:"namespaceCount"`
    KindDistribution map[string]int `json:"kindDistribution"`
}
```

### 5.4 Topology Handler

```go
// internal/api/handlers/topology.go
package handlers

import (
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/render"
    "github.com/kubilitics/kubilitics/internal/models"
    "github.com/kubilitics/kubilitics/internal/services/topology"
    "go.uber.org/zap"
)

type TopologyHandler struct {
    engine *topology.Engine
    logger *zap.Logger
}

func NewTopologyHandler(engine *topology.Engine, logger *zap.Logger) *TopologyHandler {
    return &TopologyHandler{
        engine: engine,
        logger: logger,
    }
}

// GetClusterTopology returns the full cluster topology
func (h *TopologyHandler) GetClusterTopology(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    clusterID := chi.URLParam(r, "clusterId")

    opts := topology.GetOptions{
        Namespace:            r.URL.Query().Get("namespace"),
        IncludeClusterScoped: r.URL.Query().Get("includeClusterScoped") != "false",
    }

    graph, err := h.engine.GetClusterTopology(ctx, clusterID, opts)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    // Validate graph completeness (PRD requirement)
    if !graph.Metadata.IsComplete {
        h.logger.Warn("Topology graph incomplete",
            zap.String("clusterId", clusterID),
            zap.Any("warnings", graph.Metadata.Warnings),
        )
    }

    // Validate graph
    if !graph.Metadata.Validation.IsValid {
        h.logger.Error("Topology graph validation failed",
            zap.String("clusterId", clusterID),
            zap.Any("errors", graph.Metadata.Validation.Errors),
        )
        // Return 503 - topology not ready
        render.Status(r, http.StatusServiceUnavailable)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "TOPOLOGY_INVALID",
            Message: "Topology graph validation failed",
            Details: graph.Metadata.Validation.Errors,
        })
        return
    }

    render.JSON(w, r, graph)
}

// GetResourceTopology returns topology centered on a specific resource
func (h *TopologyHandler) GetResourceTopology(w http.ResponseWriter, r *http.Request) {
    ctx := r.Context()
    clusterID := chi.URLParam(r, "clusterId")
    kind := chi.URLParam(r, "kind")
    namespace := chi.URLParam(r, "namespace")
    name := chi.URLParam(r, "name")

    if namespace == "_" {
        namespace = ""
    }

    // Parse depth (-1 = full closure)
    depth := parseIntParam(r, "depth", -1)

    graph, err := h.engine.GetResourceTopology(ctx, clusterID, kind, namespace, name, depth)
    if err != nil {
        h.handleError(w, r, err)
        return
    }

    // Same validation as cluster topology
    if !graph.Metadata.Validation.IsValid {
        render.Status(r, http.StatusServiceUnavailable)
        render.JSON(w, r, models.ErrorResponse{
            Code:    "TOPOLOGY_INVALID",
            Message: "Resource topology validation failed",
            Details: graph.Metadata.Validation.Errors,
        })
        return
    }

    render.JSON(w, r, graph)
}

func (h *TopologyHandler) handleError(w http.ResponseWriter, r *http.Request, err error) {
    // Error handling similar to resource handler
    // ...
}
```

---

## 6. API Contracts — Search Endpoints

### 6.1 Universal Search Endpoint

```yaml
# GET /api/v1/clusters/{clusterId}/search
---
path: /api/v1/clusters/{clusterId}/search
method: GET
summary: Universal search across all resources
description: |
  Searches across all Kubernetes resources in the cluster.
  Supports natural language queries in premium tier.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string

  - name: q
    in: query
    required: true
    schema:
      type: string
      minLength: 2
      maxLength: 500
    description: Search query

  - name: types
    in: query
    required: false
    schema:
      type: array
      items:
        type: string
    description: Limit to specific resource types

  - name: namespaces
    in: query
    required: false
    schema:
      type: array
      items:
        type: string
    description: Limit to specific namespaces

  - name: limit
    in: query
    required: false
    schema:
      type: integer
      default: 20
      maximum: 100

responses:
  200:
    description: Search results
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/SearchResponse'
```

### 6.2 Search Response Schema

```go
// internal/models/search.go
package models

// SearchResponse contains search results
type SearchResponse struct {
    // Search query
    Query string `json:"query"`

    // Total results found
    TotalCount int `json:"totalCount"`

    // Grouped results
    Groups []SearchResultGroup `json:"groups"`

    // Suggested actions
    Actions []SuggestedAction `json:"actions,omitempty"`

    // AI-generated insights (premium)
    AIInsights *AIInsights `json:"aiInsights,omitempty"`
}

type SearchResultGroup struct {
    // Resource kind
    Kind string `json:"kind"`

    // Number of results in this group
    Count int `json:"count"`

    // Results
    Items []SearchResult `json:"items"`
}

type SearchResult struct {
    // Resource identifier
    Kind      string `json:"kind"`
    Namespace string `json:"namespace,omitempty"`
    Name      string `json:"name"`

    // Match information
    MatchedFields []MatchedField `json:"matchedFields"`
    Score         float64        `json:"score"`

    // Resource summary
    Status     string            `json:"status"`
    Health     HealthStatus      `json:"health"`
    Labels     map[string]string `json:"labels,omitempty"`
    CreatedAt  string            `json:"createdAt"`

    // Navigation path
    Path string `json:"path"`
}

type MatchedField struct {
    Field       string `json:"field"`
    Value       string `json:"value"`
    Highlighted string `json:"highlighted"`
}

type SuggestedAction struct {
    ID          string `json:"id"`
    Label       string `json:"label"`
    Description string `json:"description"`
    Action      string `json:"action"` // e.g., "scale", "logs", "restart"
    Target      string `json:"target"` // Resource path
}

type AIInsights struct {
    Summary     string   `json:"summary"`
    Suggestions []string `json:"suggestions"`
    RelatedPath string   `json:"relatedPath,omitempty"`
}
```

---

## 7. API Contracts — Action Endpoints

### 7.1 Pod Actions

```yaml
# POST /api/v1/clusters/{clusterId}/pods/{namespace}/{name}/restart
---
path: /api/v1/clusters/{clusterId}/pods/{namespace}/{name}/restart
method: POST
summary: Restart a pod
description: |
  Deletes the pod, triggering the controller to recreate it.
  Returns immediately; pod recreation is asynchronous.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string
  - name: namespace
    in: path
    required: true
    schema:
      type: string
  - name: name
    in: path
    required: true
    schema:
      type: string

requestBody:
  required: false
  content:
    application/json:
      schema:
        type: object
        properties:
          gracePeriodSeconds:
            type: integer
            default: 30
          force:
            type: boolean
            default: false

responses:
  202:
    description: Restart initiated
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ActionResponse'
  400:
    description: Invalid request
  403:
    description: Forbidden - RBAC
  404:
    description: Pod not found
```

### 7.2 Delete Action (Guarded)

```yaml
# DELETE /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}
---
path: /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}
method: DELETE
summary: Delete a resource
description: |
  Deletes a Kubernetes resource.
  REQUIRES confirmation token for destructive resources.

parameters:
  - name: clusterId
    in: path
    required: true
    schema:
      type: string
  - name: resourceType
    in: path
    required: true
    schema:
      type: string
  - name: namespace
    in: path
    required: true
    schema:
      type: string
  - name: name
    in: path
    required: true
    schema:
      type: string

requestBody:
  required: true
  content:
    application/json:
      schema:
        type: object
        required:
          - confirmationToken
        properties:
          confirmationToken:
            type: string
            description: |
              Token obtained from DELETE preview endpoint.
              Prevents accidental deletion.
          gracePeriodSeconds:
            type: integer
            default: 30
          propagationPolicy:
            type: string
            enum: [Orphan, Background, Foreground]
            default: Background

responses:
  202:
    description: Deletion initiated
  400:
    description: Invalid confirmation token
  403:
    description: Forbidden
  404:
    description: Resource not found
```

### 7.3 Delete Preview (for confirmation)

```yaml
# GET /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}/delete-preview
---
path: /api/v1/clusters/{clusterId}/resources/{resourceType}/{namespace}/{name}/delete-preview
method: GET
summary: Preview delete impact
description: |
  Returns the blast radius of deleting this resource.
  Includes a confirmation token required for actual deletion.

responses:
  200:
    description: Delete preview
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/DeletePreviewResponse'
```

### 7.4 Action Response Schemas

```go
// internal/models/action.go
package models

import "time"

// ActionResponse for async actions
type ActionResponse struct {
    // Action ID for tracking
    ActionID string `json:"actionId"`

    // Action type
    Type string `json:"type"`

    // Current status
    Status ActionStatus `json:"status"`

    // Target resource
    Target ActionTarget `json:"target"`

    // Timestamp
    InitiatedAt time.Time `json:"initiatedAt"`

    // Message
    Message string `json:"message,omitempty"`
}

type ActionStatus string

const (
    ActionStatusPending    ActionStatus = "pending"
    ActionStatusInProgress ActionStatus = "in_progress"
    ActionStatusCompleted  ActionStatus = "completed"
    ActionStatusFailed     ActionStatus = "failed"
)

type ActionTarget struct {
    Kind      string `json:"kind"`
    Namespace string `json:"namespace,omitempty"`
    Name      string `json:"name"`
}

// DeletePreviewResponse shows impact of deletion
type DeletePreviewResponse struct {
    // Resource being deleted
    Resource ActionTarget `json:"resource"`

    // Confirmation token (required for DELETE)
    ConfirmationToken string `json:"confirmationToken"`

    // Token expiry (short-lived for safety)
    TokenExpiresAt time.Time `json:"tokenExpiresAt"`

    // Impact analysis
    Impact DeletionImpact `json:"impact"`
}

type DeletionImpact struct {
    // Directly owned resources that will be deleted
    OwnedResources []ActionTarget `json:"ownedResources"`

    // Resources that reference this one (will become orphaned/broken)
    DependentResources []ActionTarget `json:"dependentResources"`

    // Total cascade count
    TotalAffected int `json:"totalAffected"`

    // Warnings
    Warnings []string `json:"warnings"`

    // Is this a critical resource?
    IsCritical bool `json:"isCritical"`
}
```

---

## 8. Error Handling Standards

### 8.1 Error Response Schema

```go
// internal/models/error.go
package models

// ErrorResponse is the standard error format
type ErrorResponse struct {
    // Machine-readable error code
    Code string `json:"code"`

    // Human-readable message
    Message string `json:"message"`

    // Additional details (optional)
    Details interface{} `json:"details,omitempty"`

    // Request ID for debugging
    RequestID string `json:"requestId,omitempty"`

    // Timestamp
    Timestamp string `json:"timestamp"`
}

// Error codes
const (
    // 4xx Client Errors
    ErrCodeBadRequest       = "BAD_REQUEST"
    ErrCodeUnauthorized     = "UNAUTHORIZED"
    ErrCodeForbidden        = "FORBIDDEN"
    ErrCodeNotFound         = "NOT_FOUND"
    ErrCodeConflict         = "CONFLICT"
    ErrCodeValidation       = "VALIDATION_ERROR"
    ErrCodeRateLimited      = "RATE_LIMITED"

    // Resource-specific
    ErrCodeClusterNotFound  = "CLUSTER_NOT_FOUND"
    ErrCodeClusterOffline   = "CLUSTER_OFFLINE"
    ErrCodeResourceNotFound = "RESOURCE_NOT_FOUND"
    ErrCodeRBACDenied       = "RBAC_DENIED"

    // Topology-specific
    ErrCodeTopologyIncomplete = "TOPOLOGY_INCOMPLETE"
    ErrCodeTopologyInvalid    = "TOPOLOGY_INVALID"
    ErrCodeLayoutFailed       = "LAYOUT_FAILED"

    // 5xx Server Errors
    ErrCodeInternal          = "INTERNAL_ERROR"
    ErrCodeTimeout           = "TIMEOUT"
    ErrCodeUnavailable       = "SERVICE_UNAVAILABLE"
    ErrCodeK8sAPIError       = "K8S_API_ERROR"
)
```

### 8.2 HTTP Status Code Mapping

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| BAD_REQUEST | 400 | Malformed request |
| UNAUTHORIZED | 401 | Missing/invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource version conflict |
| VALIDATION_ERROR | 422 | Request validation failed |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unexpected server error |
| SERVICE_UNAVAILABLE | 503 | Temporary unavailability |
| TIMEOUT | 504 | Request timeout |

### 8.3 Error Middleware

```go
// internal/api/middleware/recovery.go
package middleware

import (
    "net/http"
    "runtime/debug"
    "time"

    "github.com/go-chi/render"
    "github.com/google/uuid"
    "github.com/kubilitics/kubilitics/internal/models"
    "go.uber.org/zap"
)

func Recovery(logger *zap.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            defer func() {
                if rec := recover(); rec != nil {
                    requestID := uuid.New().String()

                    logger.Error("Panic recovered",
                        zap.Any("panic", rec),
                        zap.String("requestId", requestID),
                        zap.String("path", r.URL.Path),
                        zap.String("stack", string(debug.Stack())),
                    )

                    render.Status(r, http.StatusInternalServerError)
                    render.JSON(w, r, models.ErrorResponse{
                        Code:      models.ErrCodeInternal,
                        Message:   "An internal error occurred",
                        RequestID: requestID,
                        Timestamp: time.Now().UTC().Format(time.RFC3339),
                    })
                }
            }()

            next.ServeHTTP(w, r)
        })
    }
}
```

---

## Next: Part 2 — Topology Engine & Data Layer

Continue to `backend-part-2.md` for:
- Topology Engine implementation
- Relationship inference logic
- Graph construction
- Kubernetes client patterns
- Caching strategy
- CRD handling
