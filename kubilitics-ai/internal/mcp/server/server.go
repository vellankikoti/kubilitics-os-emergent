package server

import "context"

// Package server implements the Model Context Protocol (MCP) server.
//
// CRITICAL: The MCP Server is THE SOLE INTERFACE between the LLM and the Kubernetes cluster.
//
// Responsibilities:
//   - Implement the Model Context Protocol specification (Anthropic standard)
//   - Register all available tools for the LLM to call
//   - Validate tool calls and their arguments
//   - Execute tool calls and return results to LLM
//   - Maintain MCP protocol state (session management, message ordering)
//   - Handle streaming of tool results for long-running operations
//   - Enforce tool call limits and timeouts
//   - Log all tool calls for auditability and debugging
//
// Tool Categories (Tiers):
//   1. Observation Tools (Tier 1): Read-only, high-frequency, stateless
//      - list_resources, get_resource, get_resource_yaml, get_events, get_logs, get_metrics, get_topology, search_resources
//   2. Analysis Tools (Tier 2): Computed insights, moderate frequency
//      - diff_resources, analyze_trends, simulate_impact, check_best_practices, calculate_blast_radius, correlate_events, explain_resource
//   3. Recommendation Tools (Tier 3): Generate recommendations and insights
//      - draft_recommendation, create_insight, generate_report
//   4. Execution Tools (Tier 4): Mutations to cluster, gated by Safety Engine
//      - patch_resource, scale_resource, restart_rollout, rollback_rollout, delete_resource, apply_resource
//
// Protocol Details:
//   - Tools are called by the LLM with JSON arguments
//   - MCP Server validates arguments against tool schema
//   - Results are returned as structured JSON or streaming chunks
//   - All tool calls are logged with timestamp, LLM model, args, and result
//   - Errors are returned with clear error messages for LLM to understand failure
//
// Integration Points:
//   - Observation Tools: Backend Proxy (gRPC to kubilitics-backend)
//   - Analysis Tools: Analytics Engine, Reasoning Engine
//   - Recommendation Tools: Reasoning Engine
//   - Execution Tools: Safety Engine (for policy validation), then Backend Proxy
//   - Audit Logger: Records all tool calls
//
// Tool Execution Flow:
//   1. LLM generates tool call with args
//   2. MCP Server validates args against tool schema
//   3. For execution tools: Safety Engine evaluates policy compliance
//   4. Tool execution in appropriate engine (Backend Proxy, Analytics, Reasoning, etc.)
//   5. Result returned to LLM
//   6. Audit log recorded

// MCPServer defines the interface for the Model Context Protocol server.
type MCPServer interface {
	// RegisterTool registers a new tool that the LLM can call.
	// Takes tool name, description, input schema, and execution function.
	RegisterTool(name string, description string, schema interface{}, handler interface{}) error

	// ListTools returns all registered tools with their schemas and descriptions.
	// Used by LLM to discover available tools.
	ListTools(ctx context.Context) ([]Tool, error)

	// ExecuteTool executes a tool call from the LLM.
	// Validates arguments, calls the handler, returns result.
	// For execution tools, invokes Safety Engine for policy check before execution.
	ExecuteTool(ctx context.Context, toolName string, args map[string]interface{}) (interface{}, error)

	// Start starts the MCP server (websocket or stdio transport).
	Start(ctx context.Context) error

	// Stop gracefully stops the MCP server.
	Stop(ctx context.Context) error
}

// Tool represents a single tool available to the LLM.
type Tool struct {
	// Name is the identifier for this tool (e.g., "list_resources")
	Name string

	// Description is the human-readable description for LLM understanding
	Description string

	// InputSchema is the JSON schema for tool arguments
	InputSchema interface{}

	// Tier indicates the tool's impact level (Observation, Analysis, Recommendation, Execution)
	Tier string
}

// NewMCPServer creates a new MCP server with all tool registrations.
func NewMCPServer() MCPServer {
	// Register all observation tools
	// Register all analysis tools
	// Register all recommendation tools
	// Register all execution tools
	// Initialize tool call logger
	// Connect to Safety Engine for execution tools
	return nil
}
