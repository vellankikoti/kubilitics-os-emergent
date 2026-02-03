package models

import "time"

// TopologyNode represents a node in the topology graph
type TopologyNode struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`        // Pod, Deployment, Service, etc.
	Namespace   string                 `json:"namespace"`
	Name        string                 `json:"name"`
	Status      string                 `json:"status"`      // Running, Pending, Failed, etc.
	Labels      map[string]string      `json:"labels"`
	Annotations map[string]string      `json:"annotations"`
	Metadata    map[string]interface{} `json:"metadata"`
	Position    *Position              `json:"position"` // For deterministic layout
}

// TopologyEdge represents a relationship between nodes
type TopologyEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"` // Source node ID
	Target string `json:"target"` // Target node ID
	Type   string `json:"type"`   // owner, selector, volume, env, rbac, network
	Label  string `json:"label"`  // Human-readable label
}

// Position represents node coordinates
type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// TopologyGraph represents the complete topology
type TopologyGraph struct {
	Nodes []TopologyNode `json:"nodes"`
	Edges []TopologyEdge `json:"edges"`
	Meta  TopologyMeta   `json:"meta"`
}

// TopologyMeta contains metadata about the topology
type TopologyMeta struct {
	NodeCount   int       `json:"node_count"`
	EdgeCount   int       `json:"edge_count"`
	LayoutSeed  string    `json:"layout_seed"` // For deterministic layout
	GeneratedAt time.Time `json:"generated_at"`
	Namespace   string    `json:"namespace"`   // Empty for cluster-wide
	Version     string    `json:"version"`     // Topology schema version
}

// TopologySnapshot stores topology state for history
type TopologySnapshot struct {
	ID        string    `json:"id" db:"id"`
	ClusterID string    `json:"cluster_id" db:"cluster_id"`
	Namespace string    `json:"namespace" db:"namespace"`
	Data      string    `json:"data" db:"data"` // JSON serialized TopologyGraph
	Timestamp time.Time `json:"timestamp" db:"timestamp"`
}

// TopologyFilters defines filters for topology generation
type TopologyFilters struct {
	Namespace     string   `json:"namespace"`
	ResourceTypes []string `json:"resource_types"`
	Labels        map[string]string `json:"labels"`
}
