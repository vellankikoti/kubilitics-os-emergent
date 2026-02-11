package execution

import "context"

// Package execution provides Tier 4 execution tools for the LLM.
//
// Tier 4: Execution Tools (Mutations to Cluster, Gated by Safety Engine)
//
// CRITICAL CONSTRAINT: EVERY execution tool MUST pass through the Safety Engine before executing.
//
// Responsibilities:
//   - Provide mutation capabilities to the cluster (only after safety approval)
//   - Execute resource patches, scaling, restarts, rollbacks, deletions
//   - Apply new resources from manifests
//   - Validate changes are within policy before execution
//   - Block dangerous operations per safety rules
//   - Execute with proper error handling and rollback capability
//   - Log all mutations for auditability
//
// Safety Gate Enforcement:
//   Every tool follows this pattern:
//     1. LLM calls execution tool with arguments
//     2. MCP Server invokes ExecutionTool handler
//     3. Handler calls Safety Engine's Evaluate method
//     4. If policy violation detected: return error to LLM
//     5. If approved: proceed with Backend Proxy call
//     6. Return result to LLM
//     7. Audit Logger records the mutation
//
// Tools Provided:
//
//   1. patch_resource
//      - Args: namespace, kind, name, json_patch or strategic_merge_patch
//      - Returns: Updated resource spec, change confirmation
//      - Gated By: Safety Engine - checks for dangerous field modifications
//      - Use: Apply configuration changes to resources
//
//   2. scale_resource
//      - Args: namespace, kind, name, replica_count
//      - Returns: Current vs. new replicas, scaling confirmation
//      - Gated By: Safety Engine - checks cluster capacity, scaling velocity limits
//      - Use: Adjust resource capacity
//
//   3. restart_rollout
//      - Args: namespace, kind, name
//      - Returns: Old vs. new pod hashes, restart confirmation
//      - Gated By: Safety Engine - checks if safe to restart, checks available capacity
//      - Use: Redeploy pods (trigger new rollout)
//
//   4. rollback_rollout
//      - Args: namespace, kind, name, revision_number (optional)
//      - Returns: Rolled back version info, rollback confirmation
//      - Gated By: Safety Engine - checks if rollback target is valid
//      - Use: Revert to previous deployment version
//
//   5. delete_resource
//      - Args: namespace, kind, name, grace_period_seconds (optional)
//      - Returns: Deletion confirmation, affected resources
//      - Gated By: Safety Engine - VERY restrictive, prevents accidental deletion, checks dependencies
//      - Use: Remove resources from cluster
//
//   6. apply_resource
//      - Args: namespace, manifest (YAML or JSON)
//      - Returns: Created/updated resource info, applied changes
//      - Gated By: Safety Engine - validates manifest against policies, checks for dangerous changes
//      - Use: Apply new resource or update existing resource from manifest
//
// Integration Points:
//   - Safety Engine: ALL tools must call Evaluate before execution
//   - Backend Proxy: Executes the actual mutations via gRPC
//   - Rollback Manager: Enables automatic rollback if metrics degrade
//   - Audit Logger: Records all mutations with full context
//   - World Model: Updated with new state after successful mutation
//
// Error Handling:
//   - If Safety Engine rejects: return PolicyViolation error to LLM
//   - If mutation fails: return ExecutionError with clear message
//   - If rollback needed: Rollback Manager automatically reverts
//   - LLM can catch errors and adjust strategy
//
// Autonomy Level Integration:
//   - Observe Level: All execution tools blocked
//   - Recommend Level: All execution tools blocked
//   - Propose Level: Execution tools require manual approval before executing
//   - Act-with-Guard Level: Execution tools auto-approved if low-risk, manual approval if medium/high-risk
//   - Full-Autonomous Level: Execution tools auto-approved based on policy

// ExecutionTool defines the interface for execution tools.
type ExecutionTool interface {
	// PatchResource applies a patch to a resource.
	// MUST call Safety Engine before patching.
	PatchResource(ctx context.Context, namespace string, kind string, name string, patch interface{}) (interface{}, error)

	// ScaleResource adjusts replica count for a resource.
	// MUST call Safety Engine before scaling.
	ScaleResource(ctx context.Context, namespace string, kind string, name string, replicaCount int) (interface{}, error)

	// RestartRollout restarts a deployment/statefulset by triggering new rollout.
	// MUST call Safety Engine before restarting.
	RestartRollout(ctx context.Context, namespace string, kind string, name string) (interface{}, error)

	// RollbackRollout reverts a deployment/statefulset to previous version.
	// MUST call Safety Engine before rolling back.
	RollbackRollout(ctx context.Context, namespace string, kind string, name string, revisionNumber int) (interface{}, error)

	// DeleteResource deletes a resource from the cluster.
	// MUST call Safety Engine before deleting. Safety Engine is VERY restrictive for deletions.
	DeleteResource(ctx context.Context, namespace string, kind string, name string, gracePeriodSeconds int) (interface{}, error)

	// ApplyResource applies a resource manifest to the cluster.
	// MUST call Safety Engine before applying.
	ApplyResource(ctx context.Context, namespace string, manifest string) (interface{}, error)
}

// NewExecutionTool creates a new execution tool with dependencies.
func NewExecutionTool() ExecutionTool {
	// Inject Safety Engine, Backend Proxy, Rollback Manager, Audit Logger, World Model
	return nil
}
