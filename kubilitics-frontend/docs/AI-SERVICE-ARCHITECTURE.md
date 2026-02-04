# Kubilitics AI Service Architecture

## Natural Language Kubernetes Interactions with LangChain & MCP

**Version**: 1.0  
**Last Updated**: 2026-01-06  
**Status**: Architecture Specification

---

## 1. Executive Summary

The Kubilitics AI Service is a Python-based natural language processing layer that enables users to interact with Kubernetes clusters using conversational commands. Built on LangChain with Model Context Protocol (MCP) integration, it provides intelligent cluster management through voice, text, and contextual understanding.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        KUBILITICS AI ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    ┌─────────────┐      ┌─────────────┐      ┌─────────────────────┐   │
│    │   React     │──────│   Go API    │──────│   Python AI         │   │
│    │   Frontend  │      │   Gateway   │      │   Service           │   │
│    └─────────────┘      └─────────────┘      └──────────┬──────────┘   │
│                                                          │              │
│                                            ┌─────────────┴─────────────┐│
│                                            │                           ││
│                                    ┌───────▼───────┐  ┌───────────────┐││
│                                    │   LangChain   │  │  MCP Server   │││
│                                    │   Agents      │  │  Integration  │││
│                                    └───────┬───────┘  └───────┬───────┘││
│                                            │                   │       ││
│                                    ┌───────▼───────────────────▼───────┐│
│                                    │         K8s Tools Layer           ││
│                                    │   (client-go integration)         ││
│                                    └───────────────────────────────────┘│
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| **AI Framework** | LangChain 0.2+ | Agent orchestration, chain composition, memory |
| **LLM Provider** | OpenAI GPT-4 / Claude 3.5 | Natural language understanding |
| **MCP Integration** | Model Context Protocol | Standardized tool interface |
| **HTTP Server** | FastAPI | REST/WebSocket API |
| **Task Queue** | Celery + Redis | Async long-running operations |
| **Vector Store** | Pinecone / pgvector | Semantic search, context retrieval |
| **Observability** | LangSmith / OpenTelemetry | Tracing, debugging |

### Python Dependencies

```toml
# pyproject.toml
[project]
name = "kubilitics-ai"
version = "1.0.0"
python_requires = ">=3.11"

[project.dependencies]
langchain = "^0.2.0"
langchain-openai = "^0.1.0"
langchain-community = "^0.2.0"
langgraph = "^0.1.0"
fastapi = "^0.111.0"
uvicorn = "^0.30.0"
kubernetes = "^30.0.0"
mcp = "^1.0.0"
pydantic = "^2.7.0"
redis = "^5.0.0"
celery = "^5.4.0"
pinecone-client = "^3.0.0"
structlog = "^24.0.0"
prometheus-client = "^0.20.0"
```

---

## 3. System Architecture

### 3.1 Service Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            API LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐  │
│  │  REST Endpoints │  │ WebSocket Chat  │  │  Server-Sent Events     │  │
│  │  /api/v1/*      │  │ /ws/chat        │  │  /api/v1/stream         │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                         AGENT LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     LangChain Agent Executor                    │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │  Intent     │  │  Planner    │  │  Executor               │  │    │
│  │  │  Classifier │──│  Agent      │──│  (Tool Calls)           │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                           MCP LAYER                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    MCP Server Interface                         │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │    │
│  │  │ Resources │  │  Tools    │  │  Prompts  │  │ Sampling  │    │    │
│  │  │ Provider  │  │ Provider  │  │ Provider  │  │ Handler   │    │    │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────────────┤
│                       KUBERNETES LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                   K8s Client Wrapper                            │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │    │
│  │  │  Read       │  │  Write      │  │  Watch                  │  │    │
│  │  │  Operations │  │  Operations │  │  (Real-time)            │  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow

```
User: "Scale my nginx deployment to 5 replicas in production"
        │
        ▼
┌───────────────────┐
│ 1. API Gateway    │ ── Authentication, Rate Limiting
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 2. Intent Parser  │ ── Extract: action=scale, resource=deployment,
│                   │    name=nginx, replicas=5, namespace=production
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 3. Safety Check   │ ── Verify permissions, impact analysis
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 4. Plan Generation│ ── Create execution plan with rollback
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 5. User Confirm   │ ── "This will scale nginx from 3→5 pods. Proceed?"
└───────────────────┘
        │ Yes
        ▼
┌───────────────────┐
│ 6. MCP Execution  │ ── Call k8s_scale_deployment tool
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ 7. Response       │ ── "✅ nginx scaled to 5 replicas. 2 new pods starting."
└───────────────────┘
```

---

## 4. LangChain Agent Implementation

### 4.1 Agent Architecture

```python
# kubilitics_ai/agents/k8s_agent.py

from langchain.agents import AgentExecutor, create_openai_functions_agent
from langchain_openai import ChatOpenAI
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

from kubilitics_ai.tools import K8sToolkit
from kubilitics_ai.prompts import SYSTEM_PROMPT

class KubiliticsAgent:
    """
    Main AI agent for natural language Kubernetes interactions.
    
    Features:
    - Multi-cluster awareness
    - Conversation memory
    - Safety guardrails
    - Streaming responses
    """
    
    def __init__(
        self,
        model: str = "gpt-4-turbo-preview",
        temperature: float = 0.1,
        max_iterations: int = 10,
    ):
        self.llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            streaming=True,
        )
        
        self.memory = ConversationBufferWindowMemory(
            memory_key="chat_history",
            return_messages=True,
            k=20,  # Keep last 20 exchanges
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            MessagesPlaceholder(variable_name="chat_history"),
            ("human", "{input}"),
            MessagesPlaceholder(variable_name="agent_scratchpad"),
        ])
        
        self.toolkit = K8sToolkit()
        
        self.agent = create_openai_functions_agent(
            llm=self.llm,
            tools=self.toolkit.get_tools(),
            prompt=self.prompt,
        )
        
        self.executor = AgentExecutor(
            agent=self.agent,
            tools=self.toolkit.get_tools(),
            memory=self.memory,
            max_iterations=max_iterations,
            verbose=True,
            handle_parsing_errors=True,
            return_intermediate_steps=True,
        )
    
    async def chat(
        self,
        message: str,
        cluster_context: dict,
        user_context: dict,
    ) -> AsyncGenerator[str, None]:
        """
        Process a natural language message and stream the response.
        """
        # Inject cluster and user context
        enriched_input = self._enrich_input(message, cluster_context, user_context)
        
        async for chunk in self.executor.astream({"input": enriched_input}):
            if "output" in chunk:
                yield chunk["output"]
            elif "intermediate_step" in chunk:
                # Stream tool execution updates
                action, observation = chunk["intermediate_step"]
                yield f"🔧 {action.tool}: {observation[:100]}..."
    
    def _enrich_input(
        self,
        message: str,
        cluster_context: dict,
        user_context: dict,
    ) -> str:
        """
        Add contextual information to the user message.
        """
        context_parts = [
            f"Current cluster: {cluster_context.get('name', 'unknown')}",
            f"Namespace: {cluster_context.get('namespace', 'default')}",
            f"User role: {user_context.get('role', 'viewer')}",
            f"Permissions: {', '.join(user_context.get('permissions', []))}",
        ]
        
        return f"""
Context:
{chr(10).join(context_parts)}

User request: {message}
"""
```

### 4.2 K8s Tools Implementation

```python
# kubilitics_ai/tools/k8s_toolkit.py

from typing import List, Optional
from langchain.tools import BaseTool, StructuredTool
from pydantic import BaseModel, Field
from kubernetes import client, config

class ScaleDeploymentInput(BaseModel):
    """Input schema for scaling deployments."""
    name: str = Field(description="Name of the deployment to scale")
    namespace: str = Field(description="Kubernetes namespace")
    replicas: int = Field(description="Target number of replicas", ge=0, le=1000)

class GetPodsInput(BaseModel):
    """Input schema for listing pods."""
    namespace: Optional[str] = Field(default="default", description="Namespace to list pods from")
    label_selector: Optional[str] = Field(default=None, description="Label selector to filter pods")
    status_filter: Optional[str] = Field(default=None, description="Filter by pod status")

class K8sToolkit:
    """
    Comprehensive toolkit for Kubernetes operations.
    
    Provides LangChain-compatible tools for all common K8s operations
    with built-in safety checks and error handling.
    """
    
    def __init__(self, kubeconfig_path: Optional[str] = None):
        if kubeconfig_path:
            config.load_kube_config(config_file=kubeconfig_path)
        else:
            config.load_incluster_config()
        
        self.core_v1 = client.CoreV1Api()
        self.apps_v1 = client.AppsV1Api()
        self.autoscaling_v1 = client.AutoscalingV1Api()
        self.networking_v1 = client.NetworkingV1Api()
    
    def get_tools(self) -> List[BaseTool]:
        """Return all available K8s tools."""
        return [
            self._create_list_pods_tool(),
            self._create_get_pod_details_tool(),
            self._create_get_pod_logs_tool(),
            self._create_scale_deployment_tool(),
            self._create_list_deployments_tool(),
            self._create_get_deployment_status_tool(),
            self._create_list_services_tool(),
            self._create_describe_resource_tool(),
            self._create_get_events_tool(),
            self._create_get_cluster_health_tool(),
            self._create_rollout_restart_tool(),
            self._create_create_configmap_tool(),
            self._create_delete_pod_tool(),
        ]
    
    def _create_list_pods_tool(self) -> StructuredTool:
        return StructuredTool.from_function(
            func=self._list_pods,
            name="list_pods",
            description="""
            List all pods in a namespace with their status.
            Use this to check what pods are running, their health, and resource usage.
            Returns: pod names, status, restarts, age, and node placement.
            """,
            args_schema=GetPodsInput,
        )
    
    def _list_pods(
        self,
        namespace: str = "default",
        label_selector: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> str:
        """List pods with filtering and formatting."""
        try:
            pods = self.core_v1.list_namespaced_pod(
                namespace=namespace,
                label_selector=label_selector,
            )
            
            results = []
            for pod in pods.items:
                status = pod.status.phase
                if status_filter and status.lower() != status_filter.lower():
                    continue
                
                restarts = sum(
                    cs.restart_count for cs in (pod.status.container_statuses or [])
                )
                
                results.append({
                    "name": pod.metadata.name,
                    "status": status,
                    "restarts": restarts,
                    "node": pod.spec.node_name,
                    "ip": pod.status.pod_ip,
                })
            
            if not results:
                return f"No pods found in namespace '{namespace}'"
            
            # Format as readable table
            output = f"Found {len(results)} pods in '{namespace}':\n\n"
            output += "| Name | Status | Restarts | Node |\n"
            output += "|------|--------|----------|------|\n"
            for pod in results:
                output += f"| {pod['name'][:30]} | {pod['status']} | {pod['restarts']} | {pod['node'] or 'Pending'} |\n"
            
            return output
            
        except Exception as e:
            return f"Error listing pods: {str(e)}"
    
    def _create_scale_deployment_tool(self) -> StructuredTool:
        return StructuredTool.from_function(
            func=self._scale_deployment,
            name="scale_deployment",
            description="""
            Scale a deployment to a specific number of replicas.
            ⚠️ DESTRUCTIVE: This modifies the cluster state.
            Always confirm with the user before scaling to 0.
            """,
            args_schema=ScaleDeploymentInput,
        )
    
    def _scale_deployment(
        self,
        name: str,
        namespace: str,
        replicas: int,
    ) -> str:
        """Scale a deployment to the specified replica count."""
        try:
            # Get current state
            deployment = self.apps_v1.read_namespaced_deployment(
                name=name,
                namespace=namespace,
            )
            current_replicas = deployment.spec.replicas
            
            # Perform scaling
            deployment.spec.replicas = replicas
            self.apps_v1.patch_namespaced_deployment_scale(
                name=name,
                namespace=namespace,
                body={"spec": {"replicas": replicas}},
            )
            
            return f"""
✅ Successfully scaled deployment '{name}' in namespace '{namespace}'
   Previous replicas: {current_replicas}
   New replicas: {replicas}
   
The scaling operation has been initiated. New pods will be created/terminated shortly.
"""
        except client.ApiException as e:
            if e.status == 404:
                return f"❌ Deployment '{name}' not found in namespace '{namespace}'"
            return f"❌ Error scaling deployment: {e.reason}"
        except Exception as e:
            return f"❌ Unexpected error: {str(e)}"
    
    # ... Additional tool implementations ...
```

### 4.3 System Prompt

```python
# kubilitics_ai/prompts/system_prompt.py

SYSTEM_PROMPT = """
You are Kubilitics AI, an expert Kubernetes assistant that helps users manage their clusters through natural language.

## Your Capabilities
- List, describe, and monitor all Kubernetes resources
- Scale deployments and statefulsets
- View and analyze logs
- Check cluster health and resource usage
- Create, update, and delete resources (with confirmation)
- Explain Kubernetes concepts simply
- Troubleshoot common issues

## Personality
- Friendly and helpful, like a senior DevOps engineer mentoring a colleague
- Concise but thorough - explain the "why" when helpful
- Proactive about suggesting related actions
- Safety-conscious - always warn about destructive operations

## Safety Rules (CRITICAL)
1. NEVER delete resources without explicit user confirmation
2. NEVER scale to 0 replicas without warning about service disruption
3. ALWAYS show the current state before making changes
4. ALWAYS provide rollback instructions for destructive changes
5. Refuse to modify resources in kube-system namespace unless explicitly confirmed
6. Log all destructive operations with before/after state

## Response Format
- Use emojis sparingly for status indicators: ✅ success, ❌ error, ⚠️ warning, 🔄 in-progress
- Format data as markdown tables when showing multiple items
- Include resource counts and summaries
- Suggest relevant follow-up actions

## Context Awareness
You have access to:
- Current cluster name and context
- User's namespace preference
- User's RBAC permissions
- Recent conversation history

Always respect the user's current context unless they explicitly specify a different namespace/cluster.

## Example Interactions

User: "How are my pods doing?"
You: Let me check the pods in your current namespace 'production'.

[Uses list_pods tool]

📊 **Pod Status in 'production'**

| Name | Status | Restarts | Age |
|------|--------|----------|-----|
| api-abc123 | ✅ Running | 0 | 2d |
| api-def456 | ✅ Running | 0 | 2d |
| worker-ghi789 | ⚠️ Running | 3 | 1h |

All pods are running, but `worker-ghi789` has restarted 3 times in the last hour.
Would you like me to check its logs to investigate?

---

User: "Delete the api-abc123 pod"
You: ⚠️ **Confirmation Required**

You're about to delete pod `api-abc123` in namespace `production`.

**What will happen:**
- The pod will be terminated immediately
- If managed by a Deployment, a new pod will be created
- Active connections will be dropped

Type "confirm" to proceed, or "cancel" to abort.
"""
```

---

## 5. MCP Server Integration

### 5.1 MCP Server Implementation

```python
# kubilitics_ai/mcp/server.py

from mcp.server import Server
from mcp.types import Resource, Tool, TextContent, ImageContent
from mcp.server.stdio import stdio_server

from kubilitics_ai.tools import K8sToolkit

class KubiliticsMCPServer:
    """
    MCP server that exposes Kubernetes operations as standardized tools.
    
    Enables integration with any MCP-compatible client including
    Claude Desktop, Continue, and other AI development tools.
    """
    
    def __init__(self, kubeconfig_path: str = None):
        self.server = Server("kubilitics-k8s")
        self.toolkit = K8sToolkit(kubeconfig_path)
        
        self._register_resources()
        self._register_tools()
        self._register_prompts()
    
    def _register_resources(self):
        """Register dynamic K8s resources."""
        
        @self.server.list_resources()
        async def list_resources() -> list[Resource]:
            """List available K8s cluster resources."""
            resources = []
            
            # Add namespaces as resources
            namespaces = self.toolkit.core_v1.list_namespace()
            for ns in namespaces.items:
                resources.append(Resource(
                    uri=f"k8s://namespace/{ns.metadata.name}",
                    name=f"Namespace: {ns.metadata.name}",
                    description=f"Kubernetes namespace with {self._count_pods(ns.metadata.name)} pods",
                    mimeType="application/json",
                ))
            
            return resources
        
        @self.server.read_resource()
        async def read_resource(uri: str) -> str:
            """Read a specific K8s resource."""
            parts = uri.replace("k8s://", "").split("/")
            resource_type = parts[0]
            resource_name = parts[1] if len(parts) > 1 else None
            
            if resource_type == "namespace" and resource_name:
                return self._get_namespace_summary(resource_name)
            
            return "Resource not found"
    
    def _register_tools(self):
        """Register K8s tools for MCP clients."""
        
        @self.server.list_tools()
        async def list_tools() -> list[Tool]:
            """List all available K8s tools."""
            return [
                Tool(
                    name="k8s_list_pods",
                    description="List all pods in a namespace with their status, restarts, and resource usage",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "namespace": {
                                "type": "string",
                                "description": "Kubernetes namespace (default: 'default')",
                            },
                            "label_selector": {
                                "type": "string",
                                "description": "Label selector to filter pods (e.g., 'app=nginx')",
                            },
                        },
                    },
                ),
                Tool(
                    name="k8s_scale_deployment",
                    description="Scale a deployment to a specific number of replicas. ⚠️ Modifies cluster state.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Name of the deployment",
                            },
                            "namespace": {
                                "type": "string",
                                "description": "Kubernetes namespace",
                            },
                            "replicas": {
                                "type": "integer",
                                "description": "Target replica count",
                                "minimum": 0,
                                "maximum": 1000,
                            },
                        },
                        "required": ["name", "namespace", "replicas"],
                    },
                ),
                Tool(
                    name="k8s_get_logs",
                    description="Retrieve logs from a pod. Supports tail lines and container selection.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "pod_name": {"type": "string", "description": "Name of the pod"},
                            "namespace": {"type": "string", "description": "Kubernetes namespace"},
                            "container": {"type": "string", "description": "Container name (optional)"},
                            "tail_lines": {"type": "integer", "description": "Number of lines to return", "default": 100},
                            "since_seconds": {"type": "integer", "description": "Return logs from last N seconds"},
                        },
                        "required": ["pod_name", "namespace"],
                    },
                ),
                Tool(
                    name="k8s_describe_resource",
                    description="Get detailed information about any Kubernetes resource",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "kind": {"type": "string", "description": "Resource kind (pod, deployment, service, etc.)"},
                            "name": {"type": "string", "description": "Resource name"},
                            "namespace": {"type": "string", "description": "Kubernetes namespace"},
                        },
                        "required": ["kind", "name"],
                    },
                ),
                Tool(
                    name="k8s_cluster_health",
                    description="Get overall cluster health including node status, resource usage, and alerts",
                    inputSchema={
                        "type": "object",
                        "properties": {},
                    },
                ),
                Tool(
                    name="k8s_rollout_restart",
                    description="Trigger a rolling restart of a deployment. ⚠️ Causes brief service disruption.",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "name": {"type": "string", "description": "Deployment name"},
                            "namespace": {"type": "string", "description": "Kubernetes namespace"},
                        },
                        "required": ["name", "namespace"],
                    },
                ),
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: dict) -> list[TextContent]:
            """Execute a K8s tool and return results."""
            
            if name == "k8s_list_pods":
                result = self.toolkit._list_pods(**arguments)
            elif name == "k8s_scale_deployment":
                result = self.toolkit._scale_deployment(**arguments)
            elif name == "k8s_get_logs":
                result = self._get_pod_logs(**arguments)
            elif name == "k8s_describe_resource":
                result = self._describe_resource(**arguments)
            elif name == "k8s_cluster_health":
                result = self._get_cluster_health()
            elif name == "k8s_rollout_restart":
                result = self._rollout_restart(**arguments)
            else:
                result = f"Unknown tool: {name}"
            
            return [TextContent(type="text", text=result)]
    
    def _register_prompts(self):
        """Register prompt templates for common K8s workflows."""
        
        @self.server.list_prompts()
        async def list_prompts():
            return [
                {
                    "name": "troubleshoot_pod",
                    "description": "Systematic troubleshooting workflow for unhealthy pods",
                    "arguments": [
                        {"name": "pod_name", "description": "Name of the problematic pod", "required": True},
                        {"name": "namespace", "description": "Kubernetes namespace", "required": True},
                    ],
                },
                {
                    "name": "scale_safely",
                    "description": "Safe scaling workflow with pre/post checks",
                    "arguments": [
                        {"name": "deployment", "description": "Deployment to scale", "required": True},
                        {"name": "target_replicas", "description": "Target replica count", "required": True},
                    ],
                },
            ]
        
        @self.server.get_prompt()
        async def get_prompt(name: str, arguments: dict):
            if name == "troubleshoot_pod":
                return {
                    "messages": [
                        {
                            "role": "user",
                            "content": {
                                "type": "text",
                                "text": f"""
Troubleshoot pod '{arguments['pod_name']}' in namespace '{arguments['namespace']}':

1. First, get the pod's current status and events
2. Check container logs for errors
3. Verify resource limits aren't being hit
4. Check if the pod is being OOMKilled
5. Verify image pull is successful
6. Check network policies if applicable

Provide a summary of findings and recommended fixes.
""",
                            },
                        }
                    ]
                }
            
            return None
    
    async def run(self):
        """Start the MCP server."""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options(),
            )


# Entry point
if __name__ == "__main__":
    import asyncio
    server = KubiliticsMCPServer()
    asyncio.run(server.run())
```

### 5.2 MCP Configuration

```json
// ~/.config/claude/claude_desktop_config.json
{
  "mcpServers": {
    "kubilitics": {
      "command": "python",
      "args": ["-m", "kubilitics_ai.mcp.server"],
      "env": {
        "KUBECONFIG": "/path/to/kubeconfig",
        "KUBILITICS_LOG_LEVEL": "INFO"
      }
    }
  }
}
```

---

## 6. FastAPI Server

### 6.1 Main Application

```python
# kubilitics_ai/api/main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import asyncio

from kubilitics_ai.agents import KubiliticsAgent
from kubilitics_ai.auth import get_current_user, User
from kubilitics_ai.rate_limit import RateLimiter

app = FastAPI(
    title="Kubilitics AI API",
    description="Natural language interface for Kubernetes cluster management",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
agent = KubiliticsAgent()
rate_limiter = RateLimiter(requests_per_minute=60)


class ChatRequest(BaseModel):
    message: str
    cluster_id: str
    namespace: Optional[str] = "default"


class ChatResponse(BaseModel):
    response: str
    actions_taken: list[dict]
    suggestions: list[str]


@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
):
    """
    Send a natural language message and receive a response.
    Non-streaming endpoint for simple integrations.
    """
    await rate_limiter.check(user.id)
    
    cluster_context = {
        "id": request.cluster_id,
        "name": await get_cluster_name(request.cluster_id),
        "namespace": request.namespace,
    }
    
    user_context = {
        "id": user.id,
        "role": user.role,
        "permissions": user.permissions,
    }
    
    response_parts = []
    async for chunk in agent.chat(request.message, cluster_context, user_context):
        response_parts.append(chunk)
    
    full_response = "".join(response_parts)
    
    return ChatResponse(
        response=full_response,
        actions_taken=agent.get_last_actions(),
        suggestions=agent.get_suggestions(),
    )


@app.websocket("/ws/chat/{cluster_id}")
async def websocket_chat(
    websocket: WebSocket,
    cluster_id: str,
):
    """
    WebSocket endpoint for streaming chat responses.
    Provides real-time token streaming for responsive UI.
    """
    await websocket.accept()
    
    try:
        # Authenticate via first message
        auth_message = await websocket.receive_json()
        user = await authenticate_ws(auth_message.get("token"))
        
        cluster_context = {
            "id": cluster_id,
            "name": await get_cluster_name(cluster_id),
            "namespace": "default",
        }
        
        user_context = {
            "id": user.id,
            "role": user.role,
            "permissions": user.permissions,
        }
        
        await websocket.send_json({"type": "connected", "cluster": cluster_context["name"]})
        
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "message":
                message = data.get("content", "")
                namespace = data.get("namespace", "default")
                cluster_context["namespace"] = namespace
                
                # Stream response tokens
                await websocket.send_json({"type": "start"})
                
                async for chunk in agent.chat(message, cluster_context, user_context):
                    await websocket.send_json({
                        "type": "token",
                        "content": chunk,
                    })
                
                await websocket.send_json({
                    "type": "complete",
                    "actions": agent.get_last_actions(),
                    "suggestions": agent.get_suggestions(),
                })
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        await websocket.send_json({"type": "error", "message": str(e)})
        await websocket.close()


@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint for load balancers."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/api/v1/clusters/{cluster_id}/summary")
async def cluster_summary(
    cluster_id: str,
    user: User = Depends(get_current_user),
):
    """
    Get an AI-generated summary of cluster status.
    Useful for dashboards and quick status checks.
    """
    summary = await agent.generate_cluster_summary(cluster_id)
    return {"summary": summary}
```

---

## 7. Deployment Architecture

### 7.1 Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kubilitics-ai
  namespace: kubilitics
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kubilitics-ai
  template:
    metadata:
      labels:
        app: kubilitics-ai
    spec:
      serviceAccountName: kubilitics-ai
      containers:
        - name: ai-service
          image: kubilitics/ai-service:1.0.0
          ports:
            - containerPort: 8000
          env:
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: kubilitics-secrets
                  key: openai-api-key
            - name: REDIS_URL
              value: redis://redis:6379
            - name: LOG_LEVEL
              value: INFO
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: kubilitics-ai
  namespace: kubilitics
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kubilitics-ai-role
rules:
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "secrets", "namespaces", "events", "nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch", "patch", "update"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kubilitics-ai-binding
subjects:
  - kind: ServiceAccount
    name: kubilitics-ai
    namespace: kubilitics
roleRef:
  kind: ClusterRole
  name: kubilitics-ai-role
  apiGroup: rbac.authorization.k8s.io
```

### 7.2 Docker Configuration

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry config virtualenvs.create false && poetry install --no-dev

# Copy application code
COPY kubilitics_ai ./kubilitics_ai

# Create non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "kubilitics_ai.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 8. Security Considerations

### 8.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐       │
│  │  React   │────▶│  Go API  │────▶│ AI Svc   │────▶│  K8s API │       │
│  │  Client  │     │  Gateway │     │ (Python) │     │          │       │
│  └──────────┘     └──────────┘     └──────────┘     └──────────┘       │
│       │                │                │                 │             │
│       │   JWT Token    │   JWT Token    │  ServiceAccount │             │
│       │   (User Auth)  │   (Validated)  │  (RBAC)         │             │
│       │                │                │                 │             │
│  ┌────▼────────────────▼────────────────▼─────────────────▼────────┐   │
│  │                    SECURITY LAYERS                               │   │
│  │  • TLS encryption in transit                                    │   │
│  │  • JWT validation at each hop                                   │   │
│  │  • K8s RBAC enforcement                                         │   │
│  │  • Audit logging of all actions                                 │   │
│  │  • Rate limiting per user                                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Safety Guardrails

```python
# kubilitics_ai/safety/guardrails.py

from typing import Tuple
from pydantic import BaseModel

class SafetyCheck(BaseModel):
    allowed: bool
    reason: str
    requires_confirmation: bool
    warning_message: str | None


class SafetyGuardrails:
    """
    Safety checks for AI-initiated Kubernetes operations.
    
    Implements multiple layers of protection:
    1. Blocklist for dangerous operations
    2. Confirmation requirements for destructive actions
    3. Namespace protection rules
    4. Rate limiting for modifications
    """
    
    PROTECTED_NAMESPACES = {"kube-system", "kube-public", "kube-node-lease"}
    
    DANGEROUS_OPERATIONS = {
        ("delete", "namespace"),
        ("delete", "node"),
        ("delete", "clusterrole"),
        ("delete", "clusterrolebinding"),
    }
    
    REQUIRES_CONFIRMATION = {
        ("delete", "pod"),
        ("delete", "deployment"),
        ("delete", "service"),
        ("scale", "deployment", 0),  # Scale to 0
        ("rollout", "restart"),
    }
    
    def check_operation(
        self,
        operation: str,
        resource_type: str,
        namespace: str | None,
        details: dict,
    ) -> SafetyCheck:
        """
        Evaluate if an operation should be allowed.
        """
        # Check for completely blocked operations
        if (operation, resource_type) in self.DANGEROUS_OPERATIONS:
            return SafetyCheck(
                allowed=False,
                reason=f"Operation '{operation}' on '{resource_type}' is not allowed via AI interface",
                requires_confirmation=False,
                warning_message=None,
            )
        
        # Check protected namespaces
        if namespace in self.PROTECTED_NAMESPACES:
            return SafetyCheck(
                allowed=False,
                reason=f"Namespace '{namespace}' is protected and cannot be modified via AI",
                requires_confirmation=False,
                warning_message=None,
            )
        
        # Check if confirmation required
        if self._requires_confirmation(operation, resource_type, details):
            return SafetyCheck(
                allowed=True,
                reason="Operation allowed with user confirmation",
                requires_confirmation=True,
                warning_message=self._get_warning_message(operation, resource_type, details),
            )
        
        # Operation allowed
        return SafetyCheck(
            allowed=True,
            reason="Operation allowed",
            requires_confirmation=False,
            warning_message=None,
        )
    
    def _requires_confirmation(
        self,
        operation: str,
        resource_type: str,
        details: dict,
    ) -> bool:
        """Check if operation requires user confirmation."""
        # Scaling to 0 requires confirmation
        if operation == "scale" and details.get("replicas") == 0:
            return True
        
        return (operation, resource_type) in {
            (op, rt) for op, rt, *_ in self.REQUIRES_CONFIRMATION
        }
    
    def _get_warning_message(
        self,
        operation: str,
        resource_type: str,
        details: dict,
    ) -> str:
        """Generate appropriate warning message."""
        if operation == "delete":
            return f"⚠️ You are about to delete a {resource_type}. This action cannot be undone."
        
        if operation == "scale" and details.get("replicas") == 0:
            return "⚠️ Scaling to 0 replicas will stop all instances of this workload."
        
        if operation == "rollout":
            return "⚠️ Rolling restart will temporarily reduce available capacity."
        
        return "⚠️ This operation will modify your cluster."
```

---

## 9. Observability

### 9.1 Metrics & Tracing

```python
# kubilitics_ai/observability/metrics.py

from prometheus_client import Counter, Histogram, Gauge

# Request metrics
ai_requests_total = Counter(
    "kubilitics_ai_requests_total",
    "Total AI requests",
    ["operation_type", "status"],
)

ai_request_duration = Histogram(
    "kubilitics_ai_request_duration_seconds",
    "AI request duration",
    ["operation_type"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

# LLM metrics
llm_tokens_used = Counter(
    "kubilitics_llm_tokens_total",
    "Total LLM tokens used",
    ["model", "direction"],  # direction: input/output
)

llm_latency = Histogram(
    "kubilitics_llm_latency_seconds",
    "LLM API latency",
    ["model"],
)

# Tool execution metrics
tool_executions = Counter(
    "kubilitics_tool_executions_total",
    "Total tool executions",
    ["tool_name", "status"],
)

# Active sessions
active_websocket_connections = Gauge(
    "kubilitics_websocket_connections",
    "Active WebSocket connections",
)
```

### 9.2 LangSmith Integration

```python
# kubilitics_ai/observability/tracing.py

import os
from langsmith import Client
from langchain.callbacks.tracers import LangChainTracer

def setup_tracing():
    """Configure LangSmith tracing for debugging and monitoring."""
    if os.getenv("LANGSMITH_API_KEY"):
        return LangChainTracer(
            project_name="kubilitics-ai",
            client=Client(),
        )
    return None
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```python
# tests/test_tools.py

import pytest
from unittest.mock import Mock, patch
from kubilitics_ai.tools import K8sToolkit

@pytest.fixture
def mock_k8s_client():
    with patch("kubilitics_ai.tools.k8s_toolkit.config") as mock_config:
        with patch("kubilitics_ai.tools.k8s_toolkit.client") as mock_client:
            yield mock_client

def test_list_pods_returns_formatted_output(mock_k8s_client):
    """Test that list_pods returns properly formatted output."""
    toolkit = K8sToolkit()
    
    # Mock pod response
    mock_pod = Mock()
    mock_pod.metadata.name = "test-pod"
    mock_pod.status.phase = "Running"
    mock_pod.status.container_statuses = []
    mock_pod.spec.node_name = "node-1"
    mock_pod.status.pod_ip = "10.0.0.1"
    
    mock_k8s_client.CoreV1Api().list_namespaced_pod.return_value.items = [mock_pod]
    
    result = toolkit._list_pods(namespace="default")
    
    assert "test-pod" in result
    assert "Running" in result

def test_scale_deployment_validates_replicas():
    """Test that scale_deployment validates replica count."""
    toolkit = K8sToolkit()
    
    # Should reject negative replicas
    result = toolkit._scale_deployment(
        name="test",
        namespace="default",
        replicas=-1,
    )
    
    assert "Error" in result or "Invalid" in result
```

### 10.2 Integration Tests

```python
# tests/integration/test_agent.py

import pytest
from kubilitics_ai.agents import KubiliticsAgent

@pytest.mark.integration
async def test_agent_handles_simple_query():
    """Test agent can handle basic cluster queries."""
    agent = KubiliticsAgent()
    
    cluster_context = {"name": "test-cluster", "namespace": "default"}
    user_context = {"id": "test-user", "role": "admin", "permissions": ["*"]}
    
    response_chunks = []
    async for chunk in agent.chat("List all pods", cluster_context, user_context):
        response_chunks.append(chunk)
    
    response = "".join(response_chunks)
    
    assert len(response) > 0
    assert "pod" in response.lower()
```

---

## 11. Future Enhancements

### 11.1 Roadmap

| Phase | Feature | Timeline |
|-------|---------|----------|
| **2.0** | Voice input/output | Q2 2026 |
| **2.0** | Multi-cluster context switching | Q2 2026 |
| **2.1** | Predictive scaling recommendations | Q3 2026 |
| **2.1** | Anomaly detection and alerting | Q3 2026 |
| **2.2** | Custom runbook integration | Q4 2026 |
| **2.2** | Incident auto-remediation | Q4 2026 |
| **3.0** | Multi-modal (logs + metrics + traces) | Q1 2027 |

### 11.2 Advanced Features

- **Semantic Search**: Search across all cluster resources using natural language
- **Runbook Automation**: Execute complex multi-step procedures from plain English descriptions
- **Proactive Insights**: AI-generated recommendations based on cluster patterns
- **Collaborative Workflows**: Share and review AI-suggested changes before applying

---

## 12. References

- [LangChain Documentation](https://python.langchain.com/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Kubernetes Python Client](https://github.com/kubernetes-client/python)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

**© 2026 Kubilitics. Confidential.**

*This document contains confidential architecture specifications.*
