# Kubilitics AI System – Architecture & Engineering Execution Plan

**Version**: 1.0  
**Status**: Authoritative Design Specification  
**Scope**: `kubilitics-ai` Subsystem  

---

## Section 1 — Role of `kubilitics-ai` in the Kubilitics Ecosystem

The `kubilitics-ai` subsystem is not a feature; it is a **co-processor for human intelligence**. In the same way a GPU offloads parallel computation from the CPU, `kubilitics-ai` offloads **contextual reasoning** and **causal analysis** from the human operator.

Architecture must follow purpose. The purpose of `kubilitics-ai` is to transform the operator from a "searcher" (looking for metrics, logs, docs) into a "verifier" (reviewing diagnosis, approving remediation). To achieve this, `kubilitics-ai` must be architecturally distinct, cognitively integrated, and operationally safe.

### 1.1 The "Sidecar Brain" Architecture

We deliberately reject the "monolithic AI" approach where intelligence is scattered throughout the backend. Instead, we architect `kubilitics-ai` as a **dedicated subsystem** that sits alongside the deterministic core.

**Why this separation is a Billion-Dollar Decision:**
1.  **determinism vs. Probabilism**: The core `kubilitics-backend` must be 100% deterministic—when you list pods, you must get the exact list from etcd. The `kubilitics-ai` layer deals in probabilities—"this pod is *likely* crashing due to OOM". Mixing these codebases leads to "flaky" infrastructure where truthful state is polluted by hallucinations. Isolation preserves the sanctity of the control plane.
2.  **Failure Domain Isolation**: AI models hang. They timeout. They get rate-limited. If `kubilitics-ai` is integrated synchronously into the dashboard load path, a slow LLM brings down the entire management UI. By isolating it as a subsystem, the "Brain" can crash, restart, or stall, and the "Body" (Cluster Management) keeps functioning perfectly.
3.  **The "Auditor" Pattern**: An AI that is part of the system cannot effectively audit the system. By placing `kubilitics-ai` as an external observer with read-only access by default, we create an independent auditor that "watches the watchers," detecting misconfigurations even in the core platform itself.

### 1.2 The Responsibility Contract

The boundary between distinct subsystems must be drawn with razor-sharp precision. Ambiguity here breeds technical debt.

| **Domain** | **kubilitics-ai (The Brain)** | **kubilitics-backend (The Body)** | **kubilitics-frontend (The Interface)** |
| :--- | :--- | :--- | :--- |
| **State** | **Contextual State**: "This spike correlates with the deployment 5m ago." | **Ground Truth**: "CPU is at 80%." | **Visual State**: Rendering graphs and tables. |
| **Action** | **Proposal**: "I recommend scaling to 5 replicas." | **Execution**: `kubectl scale replicas=5` | **Intent**: User clicks "Approve". |
| **Safety** | **Simulation**: "Scaling might fail due to quota." | **Enforcement**: "Quota exceeded error from API." | **Confirmation**: "Are you sure?" dialogs. |
| **Events** | **Inference**: "This event sequence matches a known outage pattern." | **Ingestion**: Storing raw K8s events. | **Display**: Showing the event log. |
| **Tools** | **Orchestration**: Deciding *which* tool to call. | **Implementation**: The actual tool logic (e.g., `get_logs`). | **Presentation**: UI for tool results. |

### 1.3 Integration Physics

We model the integration not as API calls, but as **neuronal pathways**:

1.  **The Ventral Stream (What is it?)**:
    *   `kubilitics-backend` pushes a high-fidelity **State Stream** (Resources + Metrics + Events) to `kubilitics-ai`.
    *   The AI maintains a **"World Model"**—a temporal graph of the cluster. It doesn't query K8s for every thought; it thinks about its internal model of the cluster, which is synchronized milliseconds behind reality.

2.  **The Dorsal Stream (Where is it going?)**:
    *   `kubilitics-ai` pushes **Intelligence Overlays** back to the UI.
    *   When a user looks at a Pod in the frontend, the AI layer asynchronously delivers: "This pod is healthy, but behaves anomalously compared to its peers."
    *   This is non-blocking. If the AI is slow, the overlay just pops in later. The user never waits.

3.  **The Motor Cortex (Action)**:
    *   Actions are **proposals**, not commands. The AI types a "Draft PR" for the cluster state.
    *   "I want to patch Deployment X." -> This is a PR.
    *   The User (or Autonomy Policy) "Merges" the PR.
    *   The Backend executes the merge.

---

## Section 2 — Complete `kubilitics-ai` Architecture

The architecture is designed as a **pipelined cognitive engine**. It moves data from raw sensation (events) to perception (graphs), to cognition (reasoning), to action (MCP).

### 2.1 High-Level Component Diagram

```mermaid
graph TD
    subgraph K8s["Kubernetes Cluster"]
        API[API Server]
        Metrics[Metrics Server]
    end

    subgraph Backend["kubilitics-backend"]
        Ingest[Event & State Ingest]
        Exec[Command Executor]
    end

    subgraph AI["kubilitics-ai Subsystem"]
        direction TB
        
        %% Layer 1: Perception
        Sense[State & Event Graph]
        Obs[Observability & Analytics]
        
        %% Layer 2: Interface
        MCP[MCP Server (The Gateway)]
        
        %% Layer 3: Cognition
        Reason[Reasoning Orchestrator]
        Mem[Vector & Temporal Memory]
        
        %% Layer 4: Control
        Safety[Safety & Policy Engine]
        LLM[LLM Adapter Layer]
    end

    %% Data Flow
    API --> Ingest
    Ingest --"State Stream (gRPC)"--> Sense
    Sense --> Obs
    
    %% Cognition Flow
    MCP --"Tools"--> Sense
    Reason --"Uses"--> MCP
    Reason --"Context"--> LLM
    Reason --"Retrieves"--> Mem
    
    %% Action Flow
    Reason --"Proposal"--> Safety
    Safety --"Approved Tool Call"--> MCP
    MCP --"Execute"--> Exec
    Exec --> API
```

### 2.2 Component Deep Dive

#### 1. Intelligence Engine (The Core Loop)
*   **Purpose**: The runtime that drives the OODA loop (Observe, Orient, Decide, Act). It wakes up on triggers (user query, alert, timer) and manages the lifecycle of a "thought".
*   **Key Innovation**: **Interruptible Reasoning**. The engine can pause a thought process (e.g., waiting for a long query), serialize the state, and resume when data arrives. This allows massive concurrency on single-threaded runtimes (like Node.js or Python asyncio) without blocking.

#### 2. Kubernetes State & Event Graph
*   **Purpose**: A specialized in-memory graph database (optimized for graph topology, not general SQL).
*   **Structure**: Nodes are Resources. Edges are relationships (`OwnerRef`, `ServiceSelector`, `VolumeMount`, `NodeAffinity`).
*   **Why Superior**: standard K8s clients are list-based. "Give me all pods." The Graph allows **traversal**: "Give me all Pods *affected by* this Secret change." This is essential for blast-radius calculation.
*   **Temporal Capability**: It stores a sliding window of state changes (e.g., last 1 hour of diffs) to answer "what changed *just before* the crash?"

#### 3. Analytics & Temporal Storage
*   **Purpose**: "Small Data" analytics. We don't need a petabyte data lake. We need high-fidelity, high-frequency data for the *active* context.
*   **Mechanism**: Uses an embedded columnar store (like DuckDB or a specialized ring buffer) to hold distinct metrics for active views.
*   **Responsibility**: calculating distinct statistical baselines locally. "Is CPU usage > 3 stddev from the mean for *this specific hour of the week*?"

#### 4. MCP Server (The Tool Layer)
*   **Role**: The **Sole Interface** for the LLM. The LLM *never* calls internal functions directly. It *only* speaks MCP.
*   **Why**:
    *   **Portability**: We can point *any* MCP client (Claude Desktop, specialized agents) at our engine.
    *   **Strict Contracts**: MCP enforces types. The LLM cannot hallucinate accurate parameters if the rigid schema rejects them.
    *   **Middleware**: We can inject safety checks *into the protocol*. Every tool call passes through a vital middleware layer for permission checking.

#### 5. Reasoning Orchestrator
*   **Purpose**: Manages the "Stream of Thought". It constructs the prompt, manages the context window (trimming old messages, summarizing history), and parses the LLM's response.
*   **Strategy**: Implements **Chain-of-Thought (CoT)** enforcement. It forces the LLM to output `<thinking>` blocks before `<tool_use>` blocks, dramatically increasing reliability.

#### 6. LLM Adapter Layer
*   **Purpose**: The "BYO-LLM" normalization layer.
*   **Function**: Standardizes the wildest differences between APIs (OpenAI vs Anthropic vs Local Llama).
*   **Key Feature**: **Token Budgeting**. It tracks token usage *per session* and *per user*, preventing a "runaway" agent from draining a user's API credit. It implores user-defined limits.

#### 7. Autonomy Controller
*   **Purpose**: The "Robot Hand". It executes the actions approved by the reasoning engine.
*   **Modes**:
    *   **Passive**: Only suggests.
    *   **Active-Gated**: Validates, then asks human.
    *   **Autonomous**: Validates against policy, then executes (if policy allows).
*   **Safety**: Implements the **Dead Man's Switch**. If the controller loses contact with the backend or logic engine, it defaults to "Safe Mode" (read-only).

#### 8. Safety & Policy Engine
*   **Purpose**: The "Super-Ego". It judges every proposed action against undeniable rules.
*   **Input**: A proposed Tool Call (e.g., `deletePod(namespace='prod')`).
*   **Logic**: Checks against `ImmutablePolicies` (code) and `UserPolicies` (config).
*   **Example**: "Policy: Never delete >10% of pods in a ReplicaSet at once." The Engine simulates the effect; if it violates, it blocks the tool call *before* execution.

#### 9. Audit & Explainability Store
*   **Purpose**: The "Black Box Recorder".
*   **Data**: Stores the full conversation trace: User Query -> Retrieved Context -> LLM "Thought" -> Tool Call -> Tool Result -> Final Answer.
*   **Why**: When the AI makes a mistake, we must be able to "replay" the tape to see *why*. Was the context missing? Did the LLM reason poorly? Was the tool output confusing?

#### 10. Observability for AI
*   **Purpose**: To monitor the brain itself.
*   **Metrics**: `hallucination_rate` (detected by re-verification), `context_saturation` (how full are windows), `tool_error_rate`, `latency_p99`.

---

## Section 3 — MCP Server Design (MANDATORY & DEEP)

The **Model Context Protocol (MCP)** is the only way the AI interacts with the world. We do not use proprietary function calling or ad-hoc API wrappers. If it's not in MCP, the AI cannot see or touch it.

### 3.1 Why MCP is Foundational
1.  **Hallucination firewall**: The rigid MCP schema prevents the LLM from inventing parameters. If the AI tries to call `scale(replicas="huge")`, the MCP validator rejects it before it touches the cluster.
2.  **Future-Proofing**: We can swap the backend (e.g., from generic K8s to a specialized distro) without retraining the AI, as long as the MCP contract remains stable.
3.  **Human-in-the-Loop**: MCP tools can be inspected. A human can authorize a specific tool call (`deletePod`) while blocking others, with zero code changes in the AI agent.

### 3.2 Tool Taxonomy

#### Tier 1: Observation Tools (Read-Only, High Frequency)
*   `list_resources(kind, namespace, label_selector)`: The eyes of the system.
*   `get_resource_yaml(kind, name, namespace)`: Deep inspection.
*   `get_events(related_resource)`: The memory of the system.
*   `get_metrics(query, time_window)`: The vital signs. **Crucial**: Takes abstracted queries ("cpu_usage"), not raw PromQL, to prevent AI from struggling with metric syntax.

#### Tier 2: Analysis Tools (Computed Insights)
*   `diff_resources(version_a, version_b)`: "What changed between yesterday and today?"
*   `simulate_impact(action, resource)`: "If I delete this Service, what breaks?" (Uses the Graph to traverse dependencies).
*   `check_policy(resource_yaml)`: "Does this config violate our security standards?"

#### Tier 3: Recommendation Tools (The output of thinking)
*   `draft_recommendation(title, severity, reasoning, proposed_actions)`: The AI doesn't "do" things; it calls this tool to formally log its advice. This tool persists a `Recommendation` object in the backend.

#### Tier 4: Execution Tools (The "Red Button")
*   **Strictly Gated**. Only available if `autonomy_level >= ACTIVE`.
*   `patch_resource(kind, name, patch_json)`: Strategic surgical updates.
*   `restart_rollout(kind, name)`: The generic "turn it off and on again".
*   `rollback_rollout(kind, name, revision)`: The safety valve.

### 3.3 The "Context-Aware" Tool Contract
Standard tools are stateless. **Kubilitics MCP Tools are Context-Aware.**
*   The `get_logs` tool doesn't just return text. It performs **semantic filtering** on the backend before returning, ensuring the LLM's context window isn't flooded with "Info" logs when it asked for "Errors".
*   *Mechanism*: The tool accepts a `natural_language_hint` parameter.
    *   `get_logs(pod='api', hint='look for database connection timeouts')`
    *   The backend runs a fast heuristic search (grep/regex) using the hint and returns *only* the relevant lines.

---

## Section 4 — Reasoning Model (NO HAND-WAVING)

We do not "chat" with the cluster. We **reason** about it. This requires a structured cognitive lifecycle.

### 4.1 The Reasoning Lifecycle

1.  **Intent Detection (The Trigger)**
    *   Input: "Why is the cart service slow?"
    *   Classification: The Router classifies this as a `DIAGNOSTIC` task (vs. `INFORMATIONAL` or `ACTION`).

2.  **Context Construction (The Assembler)**
    *   The system builds a **Dynamic Context Packet**.
    *   It fetches: The specific Service, its Pods, recent Events (1h), and error rate metrics.
    *   *Critical*: It does *not* dump the whole cluster state. It follows the Graph edges 1 hop out (e.g., the Node it runs on).

3.  **Hypothesis Generation (The Scientist)**
    *   The AI generates 3 plausible hypotheses:
        *   H1: Application Code Issue (Logs)
        *   H2: Resource Starvation (CPU/Mem limits)
        *   H3: Upstream Dependency Failure (Database)

4.  **Evidence Gathering (The Investigator)**
    *   The AI executes MCP calls to validate each hypothesis.
    *   *Check H2*: `get_metrics(pod='cart', metric='cpu_saturation')` -> Result: 40% (Low). H2 Rejected.
    *   *Check H3*: `get_events(pod='cart')` -> Result: "Connection Refused to Redis". H3 Confirmed.

5.  **Causal Validation (The Judge)**
    *   The AI double-checks the confirmed hypothesis against the timeline.
    *   "Did the Redis error start *before* the latency spike?" Yes. Causality validated.

6.  **Recommendation Synthesis**
    *   The AI drafts a structured solution: "Check Redis Network Policy or Redis Pod status."

### 4.2 Handling Hallucination & Low Confidence
*   **The "I Don't Know" Valve**: If all hypotheses are rejected, the AI is explicitly prompted to output: "Status: INCONCLUSIVE. Recommend Human Investigation." It does *not* guess.
*   **Fact Checking Loop**: The Reasoning Orchestrator parses the final answer. If the answer claims "Pod is OOM", the Orchestrator runs a silent verification tool `verify_oom(pod)`. If false, the answer is rejected and the AI is forced to retry.

---

## Section 5 — Analytics Without Expensive ML

We do not need a GPU cluster to predict that a disk filling up at 1GB/minute will typically be full in 10 minutes. We use **Deterministic Heuristics** and **Statistical Projection**, not "AI Magic".

### 5.1 The "Physics" of Analytics

1.  **Linear Regression (Capacity Forecasting)**
    *   We track resource usage (CPU, RAM, Disk) over widely spaced windows (1h, 1d, 1w).
    *   Algorithm: Simple Least Squares Regression.
    *   Output: `Time_To_Exhaustion`. If T < 24h, generate a Warning. No neural net required.

2.  **State Transition Analysis (Anomaly Detection)**
    *   We model the cluster as a finite state machine.
    *   Normal: `Pending -> ContainerCreating -> Running`.
    *   Abnormal: `Running -> CrashLoopBackOff -> Running -> CrashLoopBackOff`.
    *   Mechanism: We track the *frequency* of state transitions. If `CrashLoop` frequency > Threshold, it's an anomaly.

3.  **Topological Pattern Recognition**
    *   "The N+1 Problem": If we see 1 Database Pod and 50 App Pods, and the App Pods are crashing on connection limits.
    *   Mechanism: Graph Queries. `MATCH (app)-[:CONNECTS_TO]->(db) WHERE count(app) > 20`. This is a deterministic query, not an ML guess.

4.  **Event Correlation (Root Cause Hinting)**
    *   Problem: 50 microservices crash at once.
    *   Solution: Find the **Common Ancestor** in the dependency graph.
    *   Algorithm: Lowest Common Ancestor (LCA) search on the graph node failures.
    *   Result: "Node X-15 failed, causing all 50 pods to die."

### 5.2 Why this beats "AI Ops"
*   **Explainable**: "I predict disk full because usage grew 5GB in 5 minutes" is indisputable. "Model says 98% risk" is opaque.
*   **Cheap**: Runs on a single CPU core. No GPUs.
*   **Instant**: No training phase. It works the second you install it.

---

## Section 6 — BYO-LLM Implementation Strategy

We refuse to be a reseller of API tokens. The user owns the intelligence. The user pays the provider directly. Kubilitics is the **Agentic Runtime**, not the model provider.

### 6.1 Configuration & Secrets
*   **The Key Vault**:
    *   On Desktop: Stored in OS Keychain (Mac/Windows).
    *   On Server: Stored in a Kubernetes Secret (`kubilitics-ai-secrets`), mounted as volume.
*   **Provider Agnosticism**:
    *   Primary Support: OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet).
    *   Local Support: Ollama (Llama 3, Mistral). *Crucial for air-gapped defense/finance users.*

### 6.2 The "LLM Adapter" Interface
Abstraction allows us to hot-swap brains.
```typescript
interface LLMAdapter {
  stream(prompt: string, context: Context): Observable<Token>;
  callTool(name: string, args: object): Promise<Result>;
  estimateCost(promptCounts: number): number;
}
```
*   **Context Window Management**:
    *   We implement **Rolling Summarization**. If the context exceeds 128k tokens, the explicit memory module summarizes the oldest 50% of the conversation into a bulleted "Long Term Memory" block and discards the raw text.

### 6.3 Cost Control Engineering
*   **The Budget Circuit Breaker**: Users set a hard limit (e.g., "$5.00/month").
*   **Pre-Flight check**: Before running a complex reasoning loop, the AI estimates: "This analysis involves ~50k tokens ($0.75). Proceed?"
*   **Local Caching**: We hash input prompts. If you ask the exact same question twice, we serve the cached answer (0 cost).

### 6.4 Failure Modes
*   **API Down**: The UI shows a "Brain Offline" indicator, but the *Dashboard still works*.
*   **Rate Limited**: We implement exponential backoff with a user-visible countdown.

---

## Section 7 — Autonomy & Self-Healing Engineering Model

We do not build "Self-Driving Kubernetes". We build **"Lane Assist for Kubernetes"**. The human hand is always on the wheel, until they explicitly let go.

### 7.1 The 4 Levels of Autonomy

1.  **Level 1: The Advisor (Default)**
    *   Behavior: Analyzes, Detects, Explains.
    *   Output: "I recommend scaling Deployment X."
    *   Action: Zero side effects. Read-only.

2.  **Level 2: The Copilot (Interactive)**
    *   Behavior: Prepares the fix.
    *   Output: "I have prepared the patch. Click 'Apply' to execute."
    *   Action: User click triggers execution.

3.  **Level 3: The Guardian (Policy-Gated)**
    *   Behavior: Auto-remediates *known safe* issues.
    *   Config: `allow_auto_fix: ["restart_pod_on_oom", "delete_evicted_pods"]`
    *   Action: Executes specific standard operating procedures without asking.

4.  **Level 4: The Agent (Fully Autonomous)**
    *   *Experimental / Advanced Only*.
    *   Behavior: "Goal: Maintain 99.9% uptime." The Agent scales, migrates, and patches proactively.
    *   Safety: Hard limits on blast radius (e.g., "Max 5% of budget/pods changed per hour").

### 7.2 Safety Engineering: The "Simulate-First" Block
Before *any* mutation (Level 2+), the system runs a **Dry Run**:
1.  **Dependency traversal**: check what depends on the target.
2.  **Quota check**: "Will this scale-up hit the namespace quota?"
3.  **PDB check**: "Will this restart violate the PodDisruptionBudget?"

If simulation fails, the action is **Aborted** with a "Blocked by Safety" error.

---

## Section 8 — Integration Contracts (CRITICAL)

Separation of concerns requires rigorous interfaces.

### 8.1 kubilitics-ai ↔ kubilitics-backend
*   **Transport**: gRPC (High throughput state streaming).
*   **Contract 1: State Ingestion**:
    *   `StreamClusterUpdates(Stream<WatchEvent>) -> void`
    *   Backend simply pipes etcd watch events. AI updates its efficient Graph view.
*   **Contract 2: Action Request**:
    *   `RequestAction(ActionProposal) -> ActionID`
    *   AI submits a proposal. Backend responds with ID. Backend handles the "User Approval" workflow state machine.

### 8.2 kubilitics-ai ↔ Frontend
*   **Transport**: WebSocket / Server-Sent Events (SSE).
*   **Contract: Intelligence Stream**:
    *   Topic: `analysis.pod.<pod_id>`
    *   Payload: `{ health_score: 85, anomalies: ["high_latency"], summary: "..." }`
    *   *Constraint*: Payloads must be small (< 5KB). No transferring distinct metric samples.

### 8.3 The "Explanation" Contract
Every AI output must include an `explanation_trace`:
```json
{
  "recommendation": "Scale up",
  "reasoning_trace": [
    { "step": "observation", "detail": "CPU > 90%" },
    { "step": "correlation", "detail": "Latency spiked concurrently" },
    { "step": "conclusion", "detail": "Resource Starvation" }
  ]
}
```
This allows the UI to render a "Show Thinking" dropdown.

---

## Section 9 — Engineering Task Breakdown (MANDATORY)

This is a **Phase 0-3 Execution Plan**. We do not plan past Phase 3 until Phase 2 is shipping.

### Phase 0: Foundations (Weeks 1-2)
*   [ ] **Scaffold `kubilitics-ai` Service**: Rust or Go service with gRPC server.
*   [ ] **Graph Engine Prototype**: Implement in-memory graph structure for Pod/Service/Node.
*   [ ] **State Ingestion Loop**: Connect to K8s Informers -> Update Graph.
*   [ ] **MCP Server Shell**: Implement basic MCP protocol response (no tools yet).

### Phase 1: The "Observer" (Weeks 3-6)
*   [ ] **Tier 1 Tools**: Implement `list_resources`, `get_logs` (with semantic grep).
*   [ ] **LLM Adapter**: Implement OpenAI/Anthropic client with streaming.
*   [ ] **Chat Interface**: Connect UI "Ask AI" box to the Reasoning Engine.
*   [ ] **Context Builder**: Implement logic to fetch context for a basic "Why is X broken?" query.

### Phase 2: The "Reasoning Engine" (Weeks 7-10)
*   [ ] **Analytics Module**: Implement regression forecasting on CPU/Mem.
*   [ ] **Tier 2 Tools**: Implement `diff_resources` and `simulate_impact`.
*   [ ] **Hypothesis Loop**: Implement the loop: *Generate Hypothesis -> Call Tools -> Validate*.
*   [ ] **Fact Checker**: Implement the post-generation verification step.

### Phase 3: Autonomy & Safety (Weeks 11-14)
*   [ ] **Safety Policy Engine**: Implement "Dry Run" logic for mutations.
*   [ ] **Tier 4 Tools**: Implement `draft_recommendation` and `patch_resource`.
*   [ ] **Approval Workflow**: Implement the "User Approval" UI state machine.
*   [ ] **Autonomy Configuration**: Build the Settings page for "Autonomy Levels".

---

## Section 10 — Why Kubilitics AI Becomes the Kubernetes Brain

We are not building another "K8s Dashboard". We are building the **first Operating System that understands its own substrate**.

1.  **Competitors are bound by legacy**: Datadog and NewRelic are metrics pipelines. They cannot "reason" because they do not have the *graph*. They only have the *chart*.
2.  **Open Source Trust**: Enterprises will not send their infrastructure topology to a SaaS black box. By running locally (BYO-LLM), we win the "Security & Trust" battle by default.
3.  **The "100x" Multiplier**:
    *   A junior engineer with Kubilitics AI = A senior engineer with kubectl.
    *   A senior engineer with Kubilitics AI = An entire SRE team.

This architecture definition is **final**. It is the blueprint. Execution begins now.


