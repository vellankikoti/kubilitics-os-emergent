# Kubilitics Backend Engineering Blueprint
## Part 1: Architecture & Core Services (Go)

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Language:** Go 1.24+
**Framework:** Standard library + Gorilla + client-go

---

## Table of Contents

1. [Backend Architecture Overview](#1-backend-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Kubernetes Client Integration](#4-kubernetes-client-integration)
5. [Database Schema & Models](#5-database-schema--models)
6. [Core Services Architecture](#6-core-services-architecture)
7. [HTTP Server & Middleware](#7-http-server--middleware)
8. [Configuration Management](#8-configuration-management)
9. [Logging & Observability](#9-logging--observability)
10. [Error Handling Patterns](#10-error-handling-patterns)

---

## 1. Backend Architecture Overview

### 1.1 Architecture Principles

The Kubilitics backend is built on **five foundational principles**:

1. **Kubernetes-Native**: Uses official client-go SDK, respects K8s API conventions
2. **Stateless Design**: No session state; all state in K8s cluster or database
3. **Horizontal Scalability**: Can run multiple instances behind load balancer
4. **Real-Time First**: WebSocket streams for all resource updates
5. **Topology as Core**: Topology engine is first-class service, not auxiliary feature

### 1.2 System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    KUBILITICS BACKEND                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                  API LAYER (HTTP/WS)                     │ │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────┐   │ │
│  │  │  REST API  │  │ WebSocket  │  │  GraphQL (fut) │   │ │
│  │  │  /api/v1/* │  │  /ws/*     │  │  /graphql      │   │ │
│  │  └────────────┘  └────────────┘  └─────────────────┘   │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │                  SERVICE LAYER                           │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │ │
│  │  │ Cluster  │  │Topology  │  │Resource │  │ Events │  │ │
│  │  │ Service  │  │ Engine   │  │ Service │  │Service │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │ │
│  │  │  Logs    │  │  Metrics │  │  Export  │  │ AI/MCP │  │ │
│  │  │ Service  │  │ Service  │  │ Service  │  │Service │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘  │ │
│  └────────────────────┬─────────────────────────────────────┘ │
│                       │                                       │
│  ┌────────────────────▼─────────────────────────────────────┐ │
│  │                  DATA LAYER                              │ │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────────┐  │ │
│  │  │  client-go   │  │  Database  │  │  Cache (Redis) │  │ │
│  │  │  (K8s API)   │  │  (SQLite/  │  │  (optional)    │  │ │
│  │  │              │  │   Postgres)│  │                │  │ │
│  │  └──────────────┘  └────────────┘  └────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
                           │
                           │ (Kubernetes API)
                           ▼
               ┌────────────────────┐
               │ Kubernetes Cluster │
               │  (Any K8s distro)  │
               └────────────────────┘
```

### 1.3 Deployment Modes

#### Mode 1: Desktop Sidecar (Tauri)
- Backend runs as child process of Tauri app
- Listens on `localhost:8080`
- Reads kubeconfig from `~/.kube/config`
- SQLite database in app data directory

#### Mode 2: Helm Deployment (In-Cluster)
- Runs as Kubernetes Deployment
- Service exposed via Ingress
- Reads kubeconfig from ServiceAccount
- PostgreSQL database

#### Mode 3: Standalone Server
- Binary runs on server
- Configurable via environment variables or config file
- Can connect to multiple clusters

---

## 2. Project Structure

```
kubilitics-backend/
├── cmd/
│   ├── server/
│   │   └── main.go                      # Main entry point
│   └── cli/
│       └── main.go                      # CLI tool (future)
│
├── internal/                            # Private application code
│   ├── api/                             # API handlers
│   │   ├── rest/                        # REST API
│   │   │   ├── handler.go
│   │   │   ├── clusters.go
│   │   │   ├── resources.go
│   │   │   ├── topology.go
│   │   │   ├── events.go
│   │   │   └── middleware.go
│   │   ├── websocket/                   # WebSocket handlers
│   │   │   ├── hub.go
│   │   │   ├── client.go
│   │   │   └── handlers.go
│   │   └── errors.go                    # API error responses
│   │
│   ├── service/                         # Business logic
│   │   ├── cluster_service.go
│   │   ├── resource_service.go
│   │   ├── topology_service.go
│   │   ├── events_service.go
│   │   ├── logs_service.go
│   │   ├── metrics_service.go
│   │   ├── export_service.go
│   │   └── ai_service.go
│   │
│   ├── topology/                        # Topology engine
│   │   ├── engine.go                    # Main topology engine
│   │   ├── graph.go                     # Graph data structure
│   │   ├── builder.go                   # Graph builder
│   │   ├── relationships.go             # Relationship inference
│   │   ├── layout.go                    # Layout algorithms
│   │   ├── validator.go                 # Graph validation
│   │   └── export.go                    # Export functionality
│   │
│   ├── k8s/                             # Kubernetes integration
│   │   ├── client.go                    # client-go wrapper
│   │   ├── informer.go                  # Informer setup
│   │   ├── watcher.go                   # Resource watchers
│   │   ├── discovery.go                 # API discovery
│   │   └── resources/                   # Resource-specific logic
│   │       ├── pods.go
│   │       ├── deployments.go
│   │       ├── services.go
│   │       └── ... (50+ types)
│   │
│   ├── models/                          # Data models
│   │   ├── cluster.go
│   │   ├── resource.go
│   │   ├── topology.go
│   │   ├── event.go
│   │   └── user.go
│   │
│   ├── repository/                      # Data access layer
│   │   ├── cluster_repo.go
│   │   ├── resource_history_repo.go
│   │   ├── topology_snapshot_repo.go
│   │   └── user_preferences_repo.go
│   │
│   ├── config/                          # Configuration
│   │   ├── config.go
│   │   └── defaults.go
│   │
│   └── util/                            # Utilities
│       ├── logger.go
│       ├── errors.go
│       ├── yaml.go
│       └── metrics.go
│
├── pkg/                                 # Public libraries
│   └── types/                           # Shared types
│       └── topology.go
│
├── scripts/                             # Build & deployment
│   ├── build.sh
│   ├── docker-build.sh
│   └── helm-package.sh
│
├── deployments/                         # Deployment configs
│   ├── docker/
│   │   └── Dockerfile
│   └── helm/
│       └── kubilitics/
│           ├── Chart.yaml
│           ├── values.yaml
│           └── templates/
│
├── migrations/                          # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_add_topology_snapshots.sql
│   └── ...
│
├── go.mod
├── go.sum
└── README.md
```

---

## 3. Technology Stack

### 3.1 Core Dependencies

```go
// go.mod
module github.com/kubilitics/kubilitics-backend

go 1.24

require (
    // Kubernetes
    k8s.io/client-go v0.30.0
    k8s.io/api v0.30.0
    k8s.io/apimachinery v0.30.0
    k8s.io/apiextensions-apiserver v0.30.0
    k8s.io/metrics v0.30.0

    // HTTP & WebSocket
    github.com/gorilla/mux v1.8.1
    github.com/gorilla/websocket v1.5.1
    github.com/rs/cors v1.10.1

    // Database
    github.com/jmoiron/sqlx v1.3.5
    github.com/mattn/go-sqlite3 v1.14.19
    github.com/lib/pq v1.10.9 // PostgreSQL

    // Caching (optional)
    github.com/redis/go-redis/v9 v9.4.0

    // Logging
    go.uber.org/zap v1.26.0

    // Configuration
    github.com/spf13/viper v1.18.2

    // YAML
    sigs.k8s.io/yaml v1.4.0

    // Testing
    github.com/stretchr/testify v1.8.4
    github.com/golang/mock v1.6.0
)
```

### 3.2 Database Choice

**Desktop/Sidecar Mode**: SQLite (embedded, no setup)
**Server/Helm Mode**: PostgreSQL (production-grade)

Both use same interface (`repository` layer abstracts DB):

```go
type Repository interface {
    SaveCluster(ctx context.Context, cluster *models.Cluster) error
    GetCluster(ctx context.Context, id string) (*models.Cluster, error)
    ListClusters(ctx context.Context) ([]*models.Cluster, error)
    DeleteCluster(ctx context.Context, id string) error

    SaveTopologySnapshot(ctx context.Context, snapshot *models.TopologySnapshot) error
    GetTopologyHistory(ctx context.Context, clusterID string, limit int) ([]*models.TopologySnapshot, error)

    SaveResourceHistory(ctx context.Context, history *models.ResourceHistory) error
    GetResourceHistory(ctx context.Context, resourceType, namespace, name string) ([]*models.ResourceHistory, error)
}
```

---

## 4. Kubernetes Client Integration

### 4.1 Client Initialization

```go
// internal/k8s/client.go
package k8s

import (
    "context"
    "fmt"
    "os"
    "path/filepath"

    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/rest"
    "k8s.io/client-go/tools/clientcmd"
    "k8s.io/client-go/util/homedir"
)

type Client struct {
    Clientset       *kubernetes.Clientset
    Config          *rest.Config
    Context         string
    kubeconfigPath  string
}

// NewClient creates a Kubernetes client
func NewClient(kubeconfigPath, context string) (*Client, error) {
    var config *rest.Config
    var err error

    if kubeconfigPath == "" {
        // Try in-cluster config first
        config, err = rest.InClusterConfig()
        if err != nil {
            // Fall back to kubeconfig
            if home := homedir.HomeDir(); home != "" {
                kubeconfigPath = filepath.Join(home, ".kube", "config")
            }
        }
    }

    if config == nil {
        config, err = buildConfigFromFlags(context, kubeconfigPath)
        if err != nil {
            return nil, fmt.Errorf("failed to build config: %w", err)
        }
    }

    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        return nil, fmt.Errorf("failed to create clientset: %w", err)
    }

    return &Client{
        Clientset:      clientset,
        Config:         config,
        Context:        context,
        kubeconfigPath: kubeconfigPath,
    }, nil
}

func buildConfigFromFlags(context, kubeconfigPath string) (*rest.Config, error) {
    return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
        &clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath},
        &clientcmd.ConfigOverrides{
            CurrentContext: context,
        }).ClientConfig()
}

// GetServerVersion returns K8s server version
func (c *Client) GetServerVersion(ctx context.Context) (string, error) {
    version, err := c.Clientset.Discovery().ServerVersion()
    if err != nil {
        return "", err
    }
    return version.GitVersion, nil
}

// TestConnection verifies connectivity
func (c *Client) TestConnection(ctx context.Context) error {
    _, err := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
    return err
}
```

### 4.2 Resource Informers (Watch for Updates)

```go
// internal/k8s/informer.go
package k8s

import (
    "context"
    "time"

    v1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/informers"
    "k8s.io/client-go/tools/cache"
)

type InformerManager struct {
    client         *Client
    factory        informers.SharedInformerFactory
    stopCh         chan struct{}
    eventHandlers  map[string]cache.ResourceEventHandlerFuncs
}

func NewInformerManager(client *Client) *InformerManager {
    factory := informers.NewSharedInformerFactory(client.Clientset, 30*time.Second)

    return &InformerManager{
        client:        client,
        factory:       factory,
        stopCh:        make(chan struct{}),
        eventHandlers: make(map[string]cache.ResourceEventHandlerFuncs),
    }
}

// SetupPodInformer sets up informer for Pods
func (im *InformerManager) SetupPodInformer(onAdd, onUpdate, onDelete func(interface{})) {
    podInformer := im.factory.Core().V1().Pods().Informer()
    podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc:    onAdd,
        UpdateFunc: func(oldObj, newObj interface{}) { onUpdate(newObj) },
        DeleteFunc: onDelete,
    })
}

// SetupDeploymentInformer sets up informer for Deployments
func (im *InformerManager) SetupDeploymentInformer(onAdd, onUpdate, onDelete func(interface{})) {
    deploymentInformer := im.factory.Apps().V1().Deployments().Informer()
    deploymentInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc:    onAdd,
        UpdateFunc: func(oldObj, newObj interface{}) { onUpdate(newObj) },
        DeleteFunc: onDelete,
    })
}

// SetupServiceInformer sets up informer for Services
func (im *InformerManager) SetupServiceInformer(onAdd, onUpdate, onDelete func(interface{})) {
    serviceInformer := im.factory.Core().V1().Services().Informer()
    serviceInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc:    onAdd,
        UpdateFunc: func(oldObj, newObj interface{}) { onUpdate(newObj) },
        DeleteFunc: onDelete,
    })
}

// Start starts all informers
func (im *InformerManager) Start() {
    im.factory.Start(im.stopCh)
    im.factory.WaitForCacheSync(im.stopCh)
}

// Stop stops all informers
func (im *InformerManager) Stop() {
    close(im.stopCh)
}
```

### 4.3 Dynamic Resource Access

```go
// internal/k8s/discovery.go
package k8s

import (
    "context"
    "fmt"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/runtime/schema"
    "k8s.io/client-go/dynamic"
)

// GetDynamicResource retrieves any K8s resource dynamically
func (c *Client) GetDynamicResource(ctx context.Context, gvr schema.GroupVersionResource, namespace, name string) (map[string]interface{}, error) {
    dynamicClient, err := dynamic.NewForConfig(c.Config)
    if err != nil {
        return nil, err
    }

    var resource dynamic.ResourceInterface
    if namespace != "" {
        resource = dynamicClient.Resource(gvr).Namespace(namespace)
    } else {
        resource = dynamicClient.Resource(gvr)
    }

    obj, err := resource.Get(ctx, name, metav1.GetOptions{})
    if err != nil {
        return nil, err
    }

    return obj.UnstructuredContent(), nil
}

// ListDynamicResources lists resources of any type
func (c *Client) ListDynamicResources(ctx context.Context, gvr schema.GroupVersionResource, namespace string) ([]map[string]interface{}, error) {
    dynamicClient, err := dynamic.NewForConfig(c.Config)
    if err != nil {
        return nil, err
    }

    var resource dynamic.ResourceInterface
    if namespace != "" {
        resource = dynamicClient.Resource(gvr).Namespace(namespace)
    } else {
        resource = dynamicClient.Resource(gvr)
    }

    list, err := resource.List(ctx, metav1.ListOptions{})
    if err != nil {
        return nil, err
    }

    results := make([]map[string]interface{}, len(list.Items))
    for i, item := range list.Items {
        results[i] = item.UnstructuredContent()
    }

    return results, nil
}

// DiscoverAPIResources discovers all API resources in cluster (including CRDs)
func (c *Client) DiscoverAPIResources(ctx context.Context) ([]metav1.APIResource, error) {
    discoveryClient := c.Clientset.Discovery()

    serverGroups, err := discoveryClient.ServerGroups()
    if err != nil {
        return nil, err
    }

    var allResources []metav1.APIResource

    for _, group := range serverGroups.Groups {
        for _, version := range group.Versions {
            resourceList, err := discoveryClient.ServerResourcesForGroupVersion(version.GroupVersion)
            if err != nil {
                // Skip groups that can't be listed
                continue
            }

            allResources = append(allResources, resourceList.APIResources...)
        }
    }

    return allResources, nil
}
```

---

## 5. Database Schema & Models

### 5.1 Database Schema (SQL)

```sql
-- migrations/001_initial_schema.sql

-- Clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    server TEXT NOT NULL,
    context TEXT NOT NULL,
    kubeconfig_path TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    version TEXT,
    provider TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_connected_at TIMESTAMP
);

-- Topology snapshots table
CREATE TABLE IF NOT EXISTS topology_snapshots (
    id TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
);

CREATE INDEX idx_topology_snapshots_cluster_id ON topology_snapshots(cluster_id);
CREATE INDEX idx_topology_snapshots_created_at ON topology_snapshots(created_at);

-- Resource history table (for time machine)
CREATE TABLE IF NOT EXISTS resource_history (
    id TEXT PRIMARY KEY,
    cluster_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    namespace TEXT,
    name TEXT NOT NULL,
    yaml_content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE
);

CREATE INDEX idx_resource_history_lookup ON resource_history(cluster_id, resource_type, namespace, name);
CREATE INDEX idx_resource_history_created_at ON resource_history(created_at);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id TEXT PRIMARY KEY,
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    settings JSONB,
    achievements JSONB DEFAULT '[]',
    actions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved views table
CREATE TABLE IF NOT EXISTS saved_views (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL, -- 'topology', 'list', etc.
    filters JSONB,
    layout JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user_preferences(user_id) ON DELETE CASCADE
);
```

### 5.2 Go Models

```go
// internal/models/cluster.go
package models

import (
    "time"
)

type Cluster struct {
    ID              string    `json:"id" db:"id"`
    Name            string    `json:"name" db:"name"`
    Server          string    `json:"server" db:"server"`
    Context         string    `json:"context" db:"context"`
    KubeconfigPath  string    `json:"kubeconfig_path" db:"kubeconfig_path"`
    IsDefault       bool      `json:"is_default" db:"is_default"`
    Version         string    `json:"version" db:"version"`
    Provider        string    `json:"provider" db:"provider"` // gke, eks, aks, k3s, etc.
    CreatedAt       time.Time `json:"created_at" db:"created_at"`
    UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
    LastConnectedAt *time.Time `json:"last_connected_at" db:"last_connected_at"`
}

// internal/models/topology.go
package models

import (
    "encoding/json"
    "time"
)

type TopologySnapshot struct {
    ID        string          `json:"id" db:"id"`
    ClusterID string          `json:"cluster_id" db:"cluster_id"`
    Nodes     json.RawMessage `json:"nodes" db:"nodes"` // JSON array of TopologyNode
    Edges     json.RawMessage `json:"edges" db:"edges"` // JSON array of TopologyEdge
    Metadata  json.RawMessage `json:"metadata" db:"metadata"`
    CreatedAt time.Time       `json:"created_at" db:"created_at"`
}

type TopologyNode struct {
    ID        string                 `json:"id"`
    Type      string                 `json:"type"`
    Name      string                 `json:"name"`
    Namespace string                 `json:"namespace,omitempty"`
    Status    string                 `json:"status"`
    Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

type TopologyEdge struct {
    ID     string `json:"id"`
    Source string `json:"source"`
    Target string `json:"target"`
    Type   string `json:"type"` // owner, selector, volume, network, rbac
    Label  string `json:"label,omitempty"`
}

// internal/models/resource.go
package models

import (
    "time"
)

type ResourceHistory struct {
    ID           string    `json:"id" db:"id"`
    ClusterID    string    `json:"cluster_id" db:"cluster_id"`
    ResourceType string    `json:"resource_type" db:"resource_type"`
    Namespace    string    `json:"namespace" db:"namespace"`
    Name         string    `json:"name" db:"name"`
    YAMLContent  string    `json:"yaml_content" db:"yaml_content"`
    CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type Resource struct {
    Kind      string                 `json:"kind"`
    Namespace string                 `json:"namespace,omitempty"`
    Name      string                 `json:"name"`
    Status    string                 `json:"status"`
    Age       string                 `json:"age"`
    Metadata  map[string]interface{} `json:"metadata"`
    Spec      map[string]interface{} `json:"spec,omitempty"`
}
```

---

## 6. Core Services Architecture

### 6.1 Service Interface Pattern

All services follow this interface pattern:

```go
// internal/service/cluster_service.go
package service

import (
    "context"

    "github.com/kubilitics/kubilitics-backend/internal/k8s"
    "github.com/kubilitics/kubilitics-backend/internal/models"
    "github.com/kubilitics/kubilitics-backend/internal/repository"
)

type ClusterService interface {
    // CRUD operations
    CreateCluster(ctx context.Context, cluster *models.Cluster) error
    GetCluster(ctx context.Context, id string) (*models.Cluster, error)
    ListClusters(ctx context.Context) ([]*models.Cluster, error)
    UpdateCluster(ctx context.Context, id string, updates *models.Cluster) error
    DeleteCluster(ctx context.Context, id string) error

    // Connection management
    ConnectToCluster(ctx context.Context, id string) (*k8s.Client, error)
    TestConnection(ctx context.Context, id string) error
    GetClusterInfo(ctx context.Context, id string) (*models.ClusterInfo, error)
}

type clusterService struct {
    repo          repository.Repository
    k8sClients    map[string]*k8s.Client // Cache of connected clients
}

func NewClusterService(repo repository.Repository) ClusterService {
    return &clusterService{
        repo:       repo,
        k8sClients: make(map[string]*k8s.Client),
    }
}

func (s *clusterService) CreateCluster(ctx context.Context, cluster *models.Cluster) error {
    // Validate connection first
    client, err := k8s.NewClient(cluster.KubeconfigPath, cluster.Context)
    if err != nil {
        return fmt.Errorf("failed to connect: %w", err)
    }

    if err := client.TestConnection(ctx); err != nil {
        return fmt.Errorf("connection test failed: %w", err)
    }

    // Get cluster info
    version, err := client.GetServerVersion(ctx)
    if err != nil {
        return fmt.Errorf("failed to get version: %w", err)
    }

    cluster.Version = version
    cluster.Provider = detectProvider(cluster.Server)

    // Save to database
    return s.repo.SaveCluster(ctx, cluster)
}

func (s *clusterService) ConnectToCluster(ctx context.Context, id string) (*k8s.Client, error) {
    // Check cache first
    if client, ok := s.k8sClients[id]; ok {
        return client, nil
    }

    // Get cluster from DB
    cluster, err := s.repo.GetCluster(ctx, id)
    if err != nil {
        return nil, err
    }

    // Create new client
    client, err := k8s.NewClient(cluster.KubeconfigPath, cluster.Context)
    if err != nil {
        return nil, err
    }

    // Cache it
    s.k8sClients[id] = client

    return client, nil
}

func detectProvider(server string) string {
    if strings.Contains(server, "gke.io") {
        return "gke"
    } else if strings.Contains(server, "eks.amazonaws.com") {
        return "eks"
    } else if strings.Contains(server, "azmk8s.io") {
        return "aks"
    } else if strings.Contains(server, "127.0.0.1") || strings.Contains(server, "localhost") {
        return "local"
    }
    return "other"
}
```

### 6.2 Resource Service

```go
// internal/service/resource_service.go
package service

import (
    "context"
    "fmt"

    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/runtime/schema"

    "github.com/kubilitics/kubilitics-backend/internal/k8s"
    "github.com/kubilitics/kubilitics-backend/internal/models"
)

type ResourceService interface {
    // Generic CRUD
    GetResource(ctx context.Context, clusterID, resourceType, namespace, name string) (*models.Resource, error)
    ListResources(ctx context.Context, clusterID, resourceType, namespace string) ([]*models.Resource, error)
    CreateResource(ctx context.Context, clusterID, resourceType, namespace, yamlContent string) error
    UpdateResource(ctx context.Context, clusterID, resourceType, namespace, name, yamlContent string) error
    DeleteResource(ctx context.Context, clusterID, resourceType, namespace, name string) error

    // Resource-specific
    GetPod(ctx context.Context, clusterID, namespace, name string) (*models.Pod, error)
    GetPodLogs(ctx context.Context, clusterID, namespace, name, container string, follow bool, tailLines int64) (io.ReadCloser, error)
    ExecInPod(ctx context.Context, clusterID, namespace, name, container string, command []string) (io.ReadCloser, io.WriteCloser, error)

    GetDeployment(ctx context.Context, clusterID, namespace, name string) (*models.Deployment, error)
    ScaleDeployment(ctx context.Context, clusterID, namespace, name string, replicas int32) error
    RolloutRestartDeployment(ctx context.Context, clusterID, namespace, name string) error
}

type resourceService struct {
    clusterService ClusterService
}

func NewResourceService(clusterService ClusterService) ResourceService {
    return &resourceService{
        clusterService: clusterService,
    }
}

func (s *resourceService) GetResource(ctx context.Context, clusterID, resourceType, namespace, name string) (*models.Resource, error) {
    client, err := s.clusterService.ConnectToCluster(ctx, clusterID)
    if err != nil {
        return nil, err
    }

    gvr, err := s.getGVRForType(resourceType)
    if err != nil {
        return nil, err
    }

    obj, err := client.GetDynamicResource(ctx, gvr, namespace, name)
    if err != nil {
        return nil, err
    }

    return s.mapToResource(obj), nil
}

func (s *resourceService) GetPod(ctx context.Context, clusterID, namespace, name string) (*models.Pod, error) {
    client, err := s.clusterService.ConnectToCluster(ctx, clusterID)
    if err != nil {
        return nil, err
    }

    pod, err := client.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
    if err != nil {
        return nil, err
    }

    return &models.Pod{
        Metadata: pod.ObjectMeta,
        Spec:     pod.Spec,
        Status:   pod.Status,
    }, nil
}

func (s *resourceService) GetPodLogs(ctx context.Context, clusterID, namespace, name, container string, follow bool, tailLines int64) (io.ReadCloser, error) {
    client, err := s.clusterService.ConnectToCluster(ctx, clusterID)
    if err != nil {
        return nil, err
    }

    req := client.Clientset.CoreV1().Pods(namespace).GetLogs(name, &corev1.PodLogOptions{
        Container: container,
        Follow:    follow,
        TailLines: &tailLines,
        Timestamps: true,
    })

    return req.Stream(ctx)
}

func (s *resourceService) getGVRForType(resourceType string) (schema.GroupVersionResource, error) {
    // Map resource type to GVR
    gvrMap := map[string]schema.GroupVersionResource{
        "pods":           {Group: "", Version: "v1", Resource: "pods"},
        "deployments":    {Group: "apps", Version: "v1", Resource: "deployments"},
        "services":       {Group: "", Version: "v1", Resource: "services"},
        "configmaps":     {Group: "", Version: "v1", Resource: "configmaps"},
        "secrets":        {Group: "", Version: "v1", Resource: "secrets"},
        "namespaces":     {Group: "", Version: "v1", Resource: "namespaces"},
        // ... add all 50+ resource types
    }

    gvr, ok := gvrMap[resourceType]
    if !ok {
        return schema.GroupVersionResource{}, fmt.Errorf("unknown resource type: %s", resourceType)
    }

    return gvr, nil
}
```

---

## 7. HTTP Server & Middleware

### 7.1 Server Setup

```go
// cmd/server/main.go
package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gorilla/mux"
    "github.com/rs/cors"

    "github.com/kubilitics/kubilitics-backend/internal/api/rest"
    "github.com/kubilitics/kubilitics-backend/internal/api/websocket"
    "github.com/kubilitics/kubilitics-backend/internal/config"
    "github.com/kubilitics/kubilitics-backend/internal/repository"
    "github.com/kubilitics/kubilitics-backend/internal/service"
    "github.com/kubilitics/kubilitics-backend/internal/util"
)

func main() {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        log.Fatalf("Failed to load config: %v", err)
    }

    // Initialize logger
    logger := util.NewLogger(cfg.LogLevel)

    // Initialize database
    repo, err := repository.NewSQLiteRepository(cfg.DatabasePath)
    if err != nil {
        logger.Fatalf("Failed to initialize database: %v", err)
    }
    defer repo.Close()

    // Initialize services
    clusterService := service.NewClusterService(repo)
    resourceService := service.NewResourceService(clusterService)
    topologyService := service.NewTopologyService(clusterService, repo)
    eventsService := service.NewEventsService(clusterService)

    // Initialize WebSocket hub
    wsHub := websocket.NewHub()
    go wsHub.Run()

    // Setup HTTP router
    router := mux.NewRouter()

    // API routes
    apiRouter := router.PathPrefix("/api/v1").Subrouter()
    rest.SetupRoutes(apiRouter, clusterService, resourceService, topologyService, eventsService)

    // WebSocket routes
    wsRouter := router.PathPrefix("/ws").Subrouter()
    websocket.SetupRoutes(wsRouter, wsHub, clusterService)

    // Middleware
    router.Use(rest.LoggingMiddleware(logger))
    router.Use(rest.RecoveryMiddleware(logger))
    router.Use(rest.CORSMiddleware())

    // Setup CORS
    c := cors.New(cors.Options{
        AllowedOrigins:   cfg.AllowedOrigins,
        AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders:   []string{"Content-Type", "Authorization"},
        AllowCredentials: true,
    })
    handler := c.Handler(router)

    // Create HTTP server
    srv := &http.Server{
        Addr:         fmt.Sprintf(":%d", cfg.Port),
        Handler:      handler,
        ReadTimeout:  15 * time.Second,
        WriteTimeout: 15 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    // Start server in goroutine
    go func() {
        logger.Infof("Starting server on port %d", cfg.Port)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            logger.Fatalf("Server failed: %v", err)
        }
    }()}

    // Wait for interrupt signal
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    logger.Info("Shutting down server...")

    // Graceful shutdown
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := srv.Shutdown(ctx); err != nil {
        logger.Errorf("Server forced to shutdown: %v", err)
    }

    logger.Info("Server exited")
}
```

### 7.2 Middleware

```go
// internal/api/rest/middleware.go
package rest

import (
    "net/http"
    "time"

    "github.com/kubilitics/kubilitics-backend/internal/util"
)

func LoggingMiddleware(logger *util.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            start := time.Now()

            // Wrap response writer to capture status code
            rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

            next.ServeHTTP(rw, r)

            logger.Infof("%s %s %d %s",
                r.Method,
                r.URL.Path,
                rw.statusCode,
                time.Since(start),
            )
        })
    }
}

type responseWriter struct {
    http.ResponseWriter
    statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
    rw.statusCode = code
    rw.ResponseWriter.WriteHeader(code)
}

func RecoveryMiddleware(logger *util.Logger) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            defer func() {
                if err := recover(); err != nil {
                    logger.Errorf("Panic recovered: %v", err)
                    http.Error(w, "Internal server error", http.StatusInternalServerError)
                }
            }()

            next.ServeHTTP(w, r)
        })
    }
}

func CORSMiddleware() func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Access-Control-Allow-Origin", "*")
            w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

            if r.Method == "OPTIONS" {
                w.WriteHeader(http.StatusOK)
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Extract token from Authorization header
            token := r.Header.Get("Authorization")
            if token == "" {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }

            // Validate token (implement JWT validation)
            // ...

            next.ServeHTTP(w, r)
        })
    }
}
```

---

## 8. Configuration Management

```go
// internal/config/config.go
package config

import (
    "fmt"

    "github.com/spf13/viper"
)

type Config struct {
    Port           int      `mapstructure:"port"`
    DatabasePath   string   `mapstructure:"database_path"`
    LogLevel       string   `mapstructure:"log_level"`
    AllowedOrigins []string `mapstructure:"allowed_origins"`
    JWTSecret      string   `mapstructure:"jwt_secret"`
}

func Load() (*Config, error) {
    viper.SetConfigName("config")
    viper.SetConfigType("yaml")
    viper.AddConfigPath("/etc/kubilitics/")
    viper.AddConfigPath("$HOME/.kubilitics")
    viper.AddConfigPath(".")

    // Defaults
    viper.SetDefault("port", 8080)
    viper.SetDefault("database_path", "./kubilitics.db")
    viper.SetDefault("log_level", "info")
    viper.SetDefault("allowed_origins", []string{"*"})

    // Environment variables
    viper.SetEnvPrefix("KUBILITICS")
    viper.AutomaticEnv()

    if err := viper.ReadInConfig(); err != nil {
        if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
            return nil, fmt.Errorf("failed to read config: %w", err)
        }
        // Config file not found; using defaults
    }

    var cfg Config
    if err := viper.Unmarshal(&cfg); err != nil {
        return nil, fmt.Errorf("failed to unmarshal config: %w", err)
    }

    return &cfg, nil
}
```

---

## 9. Logging & Observability

```go
// internal/util/logger.go
package util

import (
    "go.uber.org/zap"
    "go.uber.org/zap/zapcore"
)

type Logger struct {
    *zap.SugaredLogger
}

func NewLogger(level string) *Logger {
    config := zap.NewProductionConfig()
    config.EncoderConfig.TimeKey = "timestamp"
    config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

    // Set level
    switch level {
    case "debug":
        config.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
    case "info":
        config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
    case "warn":
        config.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
    case "error":
        config.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
    default:
        config.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
    }

    logger, _ := config.Build()
    return &Logger{SugaredLogger: logger.Sugar()}
}
```

---

## 10. Error Handling Patterns

```go
// internal/util/errors.go
package util

import (
    "fmt"
)

type APIError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Status  int    `json:"-"`
}

func (e *APIError) Error() string {
    return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

var (
    ErrBadRequest          = &APIError{Code: "BAD_REQUEST", Message: "Invalid request", Status: 400}
    ErrUnauthorized        = &APIError{Code: "UNAUTHORIZED", Message: "Authentication required", Status: 401}
    ErrForbidden           = &APIError{Code: "FORBIDDEN", Message: "Access denied", Status: 403}
    ErrNotFound            = &APIError{Code: "NOT_FOUND", Message: "Resource not found", Status: 404}
    ErrConflict            = &APIError{Code: "CONFLICT", Message: "Resource already exists", Status: 409}
    ErrInternalServerError = &APIError{Code: "INTERNAL_SERVER_ERROR", Message: "Internal server error", Status: 500}
)

func NewAPIError(code, message string, status int) *APIError {
    return &APIError{
        Code:    code,
        Message: message,
        Status:  status,
    }
}
```

---

**(End of Backend Engineering Blueprint Part 1)**

**Next**: Part 2 will cover Topology Engine Implementation (graph building, relationships, layout algorithms, validation)
