package tools

// ToolCategory represents the category of MCP tools
type ToolCategory string

const (
	// Observation tools - Read-only cluster state queries
	CategoryObservation ToolCategory = "observation"

	// Analysis tools - Intelligent insights and diagnostics
	CategoryAnalysis ToolCategory = "analysis"

	// Recommendation tools - AI-powered suggestions
	CategoryRecommendation ToolCategory = "recommendation"

	// Action tools - Cluster modifications (requires approval)
	CategoryAction ToolCategory = "action"

	// Troubleshooting tools - Problem detection and resolution
	CategoryTroubleshooting ToolCategory = "troubleshooting"

	// Security tools - Security analysis and compliance
	CategorySecurity ToolCategory = "security"

	// Cost tools - Resource optimization and cost analysis
	CategoryCost ToolCategory = "cost"

	// Automation tools - Workflow and automation
	CategoryAutomation ToolCategory = "automation"
)

// ToolDefinition defines a complete MCP tool specification
type ToolDefinition struct {
	Name        string       `json:"name"`
	Category    ToolCategory `json:"category"`
	Description string       `json:"description"`
	InputSchema interface{}  `json:"inputSchema"`
	Destructive bool         `json:"destructive"`
	RequiresAI  bool         `json:"requiresAI"`
}

// Kubilitics AI MCP Tool Taxonomy - 100x More Powerful
//
// This taxonomy defines 50+ advanced tools organized into 8 categories,
// designed to be 100x more powerful than existing K8s MCP servers.
//
// Key Innovations:
// 1. AI-Powered Intelligence: Tools that reason, not just query
// 2. Autonomous Troubleshooting: Multi-step investigation workflows
// 3. Predictive Analysis: Future state predictions and anomaly detection
// 4. Security-First: Built-in security scanning and compliance checks
// 5. Cost Optimization: Real-time cost analysis and waste detection
// 6. Self-Healing: Automated remediation with human approval
// 7. Cross-Resource Analysis: Understanding relationships and dependencies
// 8. Natural Language: Conversational interface over CLI commands

var ToolTaxonomy = []ToolDefinition{
	// === OBSERVATION TOOLS (15 tools) ===
	// Read-only cluster state queries with intelligent filtering

	{
		Name:        "observe_cluster_overview",
		Category:    CategoryObservation,
		Description: "Get comprehensive cluster overview with health, capacity, and resource distribution. Returns intelligent summary with anomaly detection.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_resource",
		Category:    CategoryObservation,
		Description: "Get detailed information about a specific resource (Pod, Deployment, Service, etc.) with intelligent context about relationships and dependencies.",
		Destructive: false,
		RequiresAI:  false,
	},
	{
		Name:        "observe_resources_by_query",
		Category:    CategoryObservation,
		Description: "Query resources using natural language. Example: 'all pods in production with high CPU' or 'failing deployments in last hour'.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_pod_logs",
		Category:    CategoryObservation,
		Description: "Stream or retrieve pod logs with intelligent filtering, error detection, and contextual analysis.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_events",
		Category:    CategoryObservation,
		Description: "Get cluster events with intelligent grouping, correlation, and impact analysis.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_resource_topology",
		Category:    CategoryObservation,
		Description: "Visualize resource relationships and dependencies with intelligent graph analysis.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_resource_history",
		Category:    CategoryObservation,
		Description: "Get temporal history of resource changes, revisions, and state transitions.",
		Destructive: false,
		RequiresAI:  false,
	},
	{
		Name:        "observe_metrics",
		Category:    CategoryObservation,
		Description: "Get time-series metrics for resources with trend analysis and anomaly detection.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_node_status",
		Category:    CategoryObservation,
		Description: "Get detailed node health, capacity, and workload distribution with recommendations.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_namespace_overview",
		Category:    CategoryObservation,
		Description: "Get comprehensive namespace overview with quotas, limits, and resource usage.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_workload_health",
		Category:    CategoryObservation,
		Description: "Get intelligent health assessment of workloads (Deployments, StatefulSets, DaemonSets).",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_network_policies",
		Category:    CategoryObservation,
		Description: "Analyze network policies with traffic flow visualization and gap detection.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_storage_status",
		Category:    CategoryObservation,
		Description: "Get storage utilization, PV/PVC status, and capacity planning insights.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "observe_api_resources",
		Category:    CategoryObservation,
		Description: "List all available API resources with intelligent categorization and usage examples.",
		Destructive: false,
		RequiresAI:  false,
	},
	{
		Name:        "observe_custom_resources",
		Category:    CategoryObservation,
		Description: "Get CRDs and custom resources with validation schema analysis.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === ANALYSIS TOOLS (12 tools) ===
	// Intelligent insights and diagnostics

	{
		Name:        "analyze_resource_efficiency",
		Category:    CategoryAnalysis,
		Description: "Analyze resource requests vs actual usage with rightsizing recommendations.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_failure_patterns",
		Category:    CategoryAnalysis,
		Description: "Detect recurring failure patterns across pods, deployments, and nodes.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_dependencies",
		Category:    CategoryAnalysis,
		Description: "Map service dependencies and identify potential single points of failure.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_configuration_drift",
		Category:    CategoryAnalysis,
		Description: "Detect configuration drift from desired state with remediation suggestions.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_capacity_trends",
		Category:    CategoryAnalysis,
		Description: "Predict future capacity needs based on historical trends and growth patterns.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_performance_bottlenecks",
		Category:    CategoryAnalysis,
		Description: "Identify performance bottlenecks across compute, network, and storage.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_error_correlation",
		Category:    CategoryAnalysis,
		Description: "Correlate errors across logs, events, and metrics to find root causes.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_blast_radius",
		Category:    CategoryAnalysis,
		Description: "Assess potential impact of resource changes or failures on dependent services.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_rollout_risk",
		Category:    CategoryAnalysis,
		Description: "Assess risk of deployments, updates, and configuration changes.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_pod_scheduling",
		Category:    CategoryAnalysis,
		Description: "Analyze pod scheduling decisions, affinity rules, and placement optimization.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_image_vulnerabilities",
		Category:    CategoryAnalysis,
		Description: "Scan container images for vulnerabilities with severity prioritization.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "analyze_workload_patterns",
		Category:    CategoryAnalysis,
		Description: "Identify traffic patterns, peak hours, and scaling opportunities.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === RECOMMENDATION TOOLS (8 tools) ===
	// AI-powered suggestions and optimizations

	{
		Name:        "recommend_resource_optimization",
		Category:    CategoryRecommendation,
		Description: "Generate actionable recommendations for resource optimization (CPU, memory, storage).",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_cost_reduction",
		Category:    CategoryRecommendation,
		Description: "Identify cost-saving opportunities with projected savings estimates.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_security_hardening",
		Category:    CategoryRecommendation,
		Description: "Provide security hardening recommendations based on best practices and CVEs.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_scaling_strategy",
		Category:    CategoryRecommendation,
		Description: "Suggest HPA/VPA configurations and scaling strategies based on workload patterns.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_architecture_improvements",
		Category:    CategoryRecommendation,
		Description: "Suggest architectural improvements for resilience, performance, and cost.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_upgrade_path",
		Category:    CategoryRecommendation,
		Description: "Plan Kubernetes and application upgrade paths with risk assessment.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_monitoring_improvements",
		Category:    CategoryRecommendation,
		Description: "Suggest monitoring, alerting, and observability enhancements.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "recommend_disaster_recovery",
		Category:    CategoryRecommendation,
		Description: "Provide disaster recovery and backup strategy recommendations.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === TROUBLESHOOTING TOOLS (7 tools) ===
	// Problem detection and resolution

	{
		Name:        "troubleshoot_pod_failures",
		Category:    CategoryTroubleshooting,
		Description: "Autonomous investigation of pod failures with root cause analysis and fix suggestions.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_network_issues",
		Category:    CategoryTroubleshooting,
		Description: "Diagnose network connectivity, DNS, and service discovery issues.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_performance_degradation",
		Category:    CategoryTroubleshooting,
		Description: "Investigate performance issues with metric correlation and bottleneck identification.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_deployment_failures",
		Category:    CategoryTroubleshooting,
		Description: "Analyze failed deployments, rollouts, and update issues with remediation steps.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_resource_constraints",
		Category:    CategoryTroubleshooting,
		Description: "Identify resource exhaustion, OOM kills, and capacity issues.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_rbac_issues",
		Category:    CategoryTroubleshooting,
		Description: "Debug RBAC permission issues and suggest proper role configurations.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "troubleshoot_storage_issues",
		Category:    CategoryTroubleshooting,
		Description: "Diagnose PV/PVC issues, mount failures, and storage provisioning problems.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === SECURITY TOOLS (5 tools) ===
	// Security analysis and compliance

	{
		Name:        "security_scan_cluster",
		Category:    CategorySecurity,
		Description: "Comprehensive cluster security scan with CIS benchmarks and compliance checks.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "security_audit_rbac",
		Category:    CategorySecurity,
		Description: "Audit RBAC configurations, identify overprivileged accounts and security risks.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "security_scan_secrets",
		Category:    CategorySecurity,
		Description: "Scan for exposed secrets, weak encryption, and secret management issues.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "security_check_pod_security",
		Category:    CategorySecurity,
		Description: "Validate pod security policies, admission controls, and runtime security.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "security_compliance_report",
		Category:    CategorySecurity,
		Description: "Generate compliance reports for SOC2, HIPAA, PCI-DSS, etc.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === COST TOOLS (4 tools) ===
	// Resource optimization and cost analysis

	{
		Name:        "cost_analyze_spending",
		Category:    CategoryCost,
		Description: "Analyze cluster costs with breakdown by namespace, workload, and resource type.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "cost_identify_waste",
		Category:    CategoryCost,
		Description: "Identify wasted resources: over-provisioned pods, unused PVs, idle nodes.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "cost_forecast_spending",
		Category:    CategoryCost,
		Description: "Forecast future costs based on trends and planned changes.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "cost_optimization_plan",
		Category:    CategoryCost,
		Description: "Generate comprehensive cost optimization plan with ROI estimates.",
		Destructive: false,
		RequiresAI:  true,
	},

	// === ACTION TOOLS (5 tools) ===
	// Cluster modifications (requires approval)

	{
		Name:        "action_scale_workload",
		Category:    CategoryAction,
		Description: "Scale deployments, statefulsets, or replicasets with safety checks.",
		Destructive: false,
		RequiresAI:  false,
	},
	{
		Name:        "action_restart_workload",
		Category:    CategoryAction,
		Description: "Restart pods or workloads with rolling update strategy.",
		Destructive: true,
		RequiresAI:  false,
	},
	{
		Name:        "action_apply_manifest",
		Category:    CategoryAction,
		Description: "Apply Kubernetes manifests with validation and dry-run support.",
		Destructive: true,
		RequiresAI:  false,
	},
	{
		Name:        "action_rollback_deployment",
		Category:    CategoryAction,
		Description: "Rollback deployment to previous revision with impact analysis.",
		Destructive: true,
		RequiresAI:  true,
	},
	{
		Name:        "action_execute_command",
		Category:    CategoryAction,
		Description: "Execute command in pod container with security validation.",
		Destructive: true,
		RequiresAI:  false,
	},

	// === AUTOMATION TOOLS (4 tools) ===
	// Workflow and automation

	{
		Name:        "automation_create_workflow",
		Category:    CategoryAutomation,
		Description: "Create multi-step automation workflows for common operations.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "automation_schedule_task",
		Category:    CategoryAutomation,
		Description: "Schedule recurring tasks like backups, cleanups, and health checks.",
		Destructive: false,
		RequiresAI:  false,
	},
	{
		Name:        "automation_create_alert_rule",
		Category:    CategoryAutomation,
		Description: "Create intelligent alert rules with auto-remediation triggers.",
		Destructive: false,
		RequiresAI:  true,
	},
	{
		Name:        "automation_generate_runbook",
		Category:    CategoryAutomation,
		Description: "Generate runbooks for common operational scenarios.",
		Destructive: false,
		RequiresAI:  true,
	},
}

// GetToolsByCategory returns all tools in a specific category
func GetToolsByCategory(category ToolCategory) []ToolDefinition {
	var tools []ToolDefinition
	for _, tool := range ToolTaxonomy {
		if tool.Category == category {
			tools = append(tools, tool)
		}
	}
	return tools
}

// GetToolByName returns a tool definition by name
func GetToolByName(name string) *ToolDefinition {
	for _, tool := range ToolTaxonomy {
		if tool.Name == name {
			return &tool
		}
	}
	return nil
}

// GetNonDestructiveTools returns all non-destructive tools
func GetNonDestructiveTools() []ToolDefinition {
	var tools []ToolDefinition
	for _, tool := range ToolTaxonomy {
		if !tool.Destructive {
			tools = append(tools, tool)
		}
	}
	return tools
}

// GetAIPoweredTools returns all tools that require AI capabilities
func GetAIPoweredTools() []ToolDefinition {
	var tools []ToolDefinition
	for _, tool := range ToolTaxonomy {
		if tool.RequiresAI {
			tools = append(tools, tool)
		}
	}
	return tools
}
