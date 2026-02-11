package observation

import "context"

// Package observation provides Tier 1 observation tools for the LLM.
//
// Tier 1: Observation Tools (Read-Only, High-Frequency, Stateless)
//
// Responsibilities:
//   - Provide read-only access to cluster state, events, logs, and metrics
//   - Support high-frequency calls without resource exhaustion
//   - Query the World Model for up-to-date cluster state
//   - Call Backend Proxy for historical data or detailed resource information
//   - Cache results appropriately to reduce backend load
//   - Return structured, easy-to-parse results for LLM reasoning
//
// Tools Provided:
//
//   1. list_resources
//      - Args: namespace (optional), kind (optional), label_selector (optional), limit (optional)
//      - Returns: List of resources matching criteria
//      - Use: Discover available resources, find targets for investigation
//
//   2. get_resource
//      - Args: namespace, kind, name
//      - Returns: Full resource spec, status, recent events
//      - Use: Inspect individual resource configuration
//
//   3. get_resource_yaml
//      - Args: namespace, kind, name
//      - Returns: Resource manifest in YAML format
//      - Use: Review exact YAML, prepare patches
//
//   4. get_events
//      - Args: namespace (optional), involved_object (optional), reason (optional), time_range (optional)
//      - Returns: List of events with timestamps and messages
//      - Use: Understand resource lifecycle, detect anomalies
//
//   5. get_logs
//      - Args: namespace, pod_name, container_name (optional), since (optional), tail_lines (optional)
//      - Returns: Container logs (streaming or paginated)
//      - Use: Debug application issues, find error patterns
//
//   6. get_metrics
//      - Args: namespace, pod_name/node_name/cluster, metric_name, time_range, step
//      - Returns: Time-series metric data
//      - Use: Analyze resource usage, detect performance degradation
//
//   7. get_topology
//      - Args: namespace (optional), depth (optional)
//      - Returns: Graph of resource dependencies and relationships
//      - Use: Understand impact of changes, plan investigations
//
//   8. search_resources
//      - Args: query (text search), namespace (optional), kind (optional)
//      - Returns: Resources matching search criteria
//      - Use: Find resources by name, label, or annotation content
//
// Integration Points:
//   - World Model: Query cluster state
//   - Backend Proxy: Query kubilitics-backend for detailed info
//   - Cache: Store results for high-frequency queries
//   - Audit Logger: Log all tool calls
//
// Performance Considerations:
//   - list_resources uses pagination for large result sets
//   - get_metrics uses analytical engine for fast aggregations
//   - Search results are cached for duplicate queries
//   - get_logs streams results to avoid large memory allocations

// ObservationTool defines the interface for observation tools.
type ObservationTool interface {
	// ListResources returns resources matching the given criteria.
	ListResources(ctx context.Context, namespace string, kind string, labelSelector string, limit int) (interface{}, error)

	// GetResource returns detailed information about a single resource.
	GetResource(ctx context.Context, namespace string, kind string, name string) (interface{}, error)

	// GetResourceYAML returns the resource manifest in YAML format.
	GetResourceYAML(ctx context.Context, namespace string, kind string, name string) (string, error)

	// GetEvents returns events related to resources in a namespace or specific object.
	GetEvents(ctx context.Context, namespace string, involvedObject string, reason string, timeRange interface{}) (interface{}, error)

	// GetLogs returns container logs for a pod.
	GetLogs(ctx context.Context, namespace string, podName string, containerName string, since string, tailLines int) (string, error)

	// GetMetrics returns time-series metrics for resources.
	GetMetrics(ctx context.Context, target string, metricName string, timeRange interface{}, step string) (interface{}, error)

	// GetTopology returns the dependency graph for resources.
	GetTopology(ctx context.Context, namespace string, depth int) (interface{}, error)

	// SearchResources searches for resources matching the query.
	SearchResources(ctx context.Context, query string, namespace string, kind string) (interface{}, error)
}

// NewObservationTool creates a new observation tool with dependencies.
func NewObservationTool() ObservationTool {
	// Inject World Model, Backend Proxy, Cache, Analytics Engine
	return nil
}
