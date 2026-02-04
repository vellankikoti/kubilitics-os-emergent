# Kubilitics End-to-End Testing Blueprint
## Complete Test Strategy & Implementation

**Document Version:** 1.0
**Last Updated:** 2026-02-04
**Testing Stack:** Playwright (Frontend), pytest/Go test (Backend), k3s (K8s)

---

## Table of Contents

1. [Testing Strategy & Philosophy](#1-testing-strategy--philosophy)
2. [Test Environment Setup](#2-test-environment-setup)
3. [Frontend E2E Tests (Playwright)](#3-frontend-e2e-tests-playwright)
4. [Backend Integration Tests (Go)](#4-backend-integration-tests-go)
5. [Topology Truth Tests](#5-topology-truth-tests)
6. [Contract Tests](#6-contract-tests)
7. [Visual Regression Tests](#7-visual-regression-tests)
8. [Performance & Load Tests](#8-performance--load-tests)
9. [CI/CD Integration](#9-cicd-integration)
10. [Test Data Management](#10-test-data-management)

---

## 1. Testing Strategy & Philosophy

### 1.1 Testing Pyramid

```
                    ▲
                   / \
                  /   \
                 / E2E \         10% - Full user flows
                /───────\
               /         \
              / Integration\     30% - API & Service tests
             /─────────────\
            /               \
           /   Unit Tests    \   60% - Individual functions
          /___________________\
```

### 1.2 What We Test

#### Must Test:
1. **Topology Completeness**: Every relationship must be present
2. **WYSIWYG Export**: UI topology === PDF export
3. **Deterministic Layout**: Same graph → same positions
4. **Real-Time Updates**: WebSocket events update UI correctly
5. **Resource CRUD**: Create, read, update, delete all 50+ resource types
6. **Error Handling**: All error states render correctly
7. **Keyboard Navigation**: All shortcuts work
8. **Accessibility**: WCAG 2.1 AA compliance
9. **Mobile UI**: Touch gestures, responsive layouts
10. **i18n**: All 20+ languages render correctly

#### Don't Test:
- Kubernetes API behavior (that's K8s's job)
- Third-party library internals
- Browser-specific quirks (that's Playwright's job)

### 1.3 Test Coverage Goals

| Layer | Target Coverage |
|-------|----------------|
| Unit Tests | 85%+ |
| Integration Tests | 75%+ |
| E2E Tests | Critical paths 100% |

---

## 2. Test Environment Setup

### 2.1 Local K8s Cluster (k3s)

```bash
# Install k3s
curl -sfL https://get.k3s.io | sh -

# Or use kind
kind create cluster --name kubilitics-test

# Set up test resources
kubectl apply -f test/fixtures/test-cluster.yaml
```

**Test Cluster Contents**:
```yaml
# test/fixtures/test-cluster.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: test-namespace
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  namespace: test-namespace
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:latest
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
  namespace: test-namespace
spec:
  selector:
    app: nginx
  ports:
  - port: 80
    targetPort: 80
---
# Add ConfigMap, Secret, PVC, etc. to test relationships
```

### 2.2 Test Database

```bash
# Use SQLite for tests (in-memory)
export DATABASE_PATH=":memory:"

# Or use PostgreSQL test container
docker run -d --name postgres-test \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=kubilitics_test \
  -p 5432:5432 postgres:15
```

### 2.3 Backend Test Server

```bash
# Start backend in test mode
go run cmd/server/main.go --config=test/config.yaml
```

### 2.4 Frontend Test Setup

```bash
# Install Playwright
npm install -D @playwright/test

# Install browsers
npx playwright install

# Run tests
npx playwright test
```

---

## 3. Frontend E2E Tests (Playwright)

### 3.1 Test Structure

```
frontend/e2e/
├── fixtures/
│   ├── test-cluster.json
│   └── test-user.json
├── page-objects/
│   ├── DashboardPage.ts
│   ├── TopologyPage.ts
│   ├── PodListPage.ts
│   └── PodDetailPage.ts
├── specs/
│   ├── onboarding.spec.ts
│   ├── dashboard.spec.ts
│   ├── topology.spec.ts
│   ├── resources.spec.ts
│   ├── search.spec.ts
│   └── mobile.spec.ts
└── playwright.config.ts
```

### 3.2 Page Object Pattern

```typescript
// e2e/page-objects/TopologyPage.ts
import { Page, expect } from '@playwright/test';

export class TopologyPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/topology');
    await this.page.waitForLoadState('networkidle');
  }

  async getNodeCount() {
    return await this.page.locator('[data-testid="topology-node"]').count();
  }

  async getEdgeCount() {
    return await this.page.locator('[data-testid="topology-edge"]').count();
  }

  async clickNode(nodeName: string) {
    await this.page.locator(`[data-testid="topology-node"][data-name="${nodeName}"]`).click();
  }

  async expectDetailPanelVisible() {
    await expect(this.page.locator('[data-testid="detail-panel"]')).toBeVisible();
  }

  async zoomIn() {
    await this.page.keyboard.press('+');
  }

  async zoomOut() {
    await this.page.keyboard.press('-');
  }

  async selectMultipleNodes(nodeNames: string[]) {
    for (const name of nodeNames) {
      await this.page.keyboard.down('Meta'); // Cmd/Ctrl
      await this.clickNode(name);
      await this.page.keyboard.up('Meta');
    }
  }

  async exportTopology(format: 'png' | 'pdf' | 'svg') {
    await this.page.locator('[data-testid="export-button"]').click();
    await this.page.locator(`[data-testid="export-${format}"]`).click();
    // Wait for download
    const download = await this.page.waitForEvent('download');
    return download.path();
  }
}
```

### 3.3 Example Tests

```typescript
// e2e/specs/topology.spec.ts
import { test, expect } from '@playwright/test';
import { TopologyPage } from '../page-objects/TopologyPage';

test.describe('Topology View', () => {
  let topologyPage: TopologyPage;

  test.beforeEach(async ({ page }) => {
    topologyPage = new TopologyPage(page);
    await topologyPage.goto();
  });

  test('should display all nodes and edges', async () => {
    const nodeCount = await topologyPage.getNodeCount();
    const edgeCount = await topologyPage.getEdgeCount();

    expect(nodeCount).toBeGreaterThan(0);
    expect(edgeCount).toBeGreaterThan(0);
  });

  test('should show detail panel on node click', async () => {
    await topologyPage.clickNode('nginx-deployment');
    await topologyPage.expectDetailPanelVisible();
  });

  test('should support zoom controls', async () => {
    await topologyPage.zoomIn();
    await topologyPage.zoomIn();
    await topologyPage.zoomOut();
    // Verify zoom level changed (check CSS transform or similar)
  });

  test('should support multi-select', async () => {
    await topologyPage.selectMultipleNodes(['nginx-deployment', 'nginx-service']);
    // Verify selection count
  });

  test('should export topology as PNG', async () => {
    const downloadPath = await topologyPage.exportTopology('png');
    expect(downloadPath).toBeTruthy();
    // Optionally: verify file size, dimensions
  });
});

// e2e/specs/resources.spec.ts
test.describe('Pod Detail View', () => {
  test('should display all pod information', async ({ page }) => {
    await page.goto('/pods/test-namespace/nginx-abc123');

    // Header
    await expect(page.locator('h1')).toContainText('nginx-abc123');
    await expect(page.locator('[data-testid="status-badge"]')).toContainText('Running');

    // Status Cards
    await expect(page.locator('[data-testid="ready-card"]')).toContainText('2/2');
    await expect(page.locator('[data-testid="restarts-card"]')).toContainText('0');

    // Tabs
    await expect(page.locator('[data-testid="tab-overview"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-containers"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-logs"]')).toBeVisible();
  });

  test('should stream logs in real-time', async ({ page }) => {
    await page.goto('/pods/test-namespace/nginx-abc123?tab=logs');

    const logsContainer = page.locator('[data-testid="logs-container"]');
    await expect(logsContainer).toBeVisible();

    // Wait for logs to appear
    await page.waitForTimeout(1000);
    const logContent = await logsContainer.textContent();
    expect(logContent).toBeTruthy();
  });

  test('should open terminal connection', async ({ page }) => {
    await page.goto('/pods/test-namespace/nginx-abc123?tab=terminal');

    const terminal = page.locator('[data-testid="terminal"]');
    await expect(terminal).toBeVisible();

    // Type command
    await terminal.type('ls -la\n');
    await page.waitForTimeout(500);

    // Verify output
    const terminalText = await terminal.textContent();
    expect(terminalText).toContain('total');
  });
});

// e2e/specs/search.spec.ts
test.describe('Universal Search', () => {
  test('should open search with Cmd+K', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+K'); // Cmd+K on Mac, Ctrl+K on Windows

    await expect(page.locator('[data-testid="search-dialog"]')).toBeVisible();
  });

  test('should search and navigate to resource', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+K');

    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill('nginx');

    await page.waitForTimeout(300); // Debounce

    const firstResult = page.locator('[data-testid="search-result"]').first();
    await expect(firstResult).toBeVisible();

    await firstResult.click();

    // Should navigate to resource detail
    await expect(page).toHaveURL(/\/pods\/.*\/nginx/);
  });
});

// e2e/specs/mobile.spec.ts
test.describe('Mobile UI', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('should display bottom navigation', async ({ page }) => {
    await page.goto('/');

    const bottomNav = page.locator('[data-testid="mobile-bottom-nav"]');
    await expect(bottomNav).toBeVisible();

    // Check tabs
    await expect(bottomNav.locator('text=Home')).toBeVisible();
    await expect(bottomNav.locator('text=Topology')).toBeVisible();
    await expect(bottomNav.locator('text=Resources')).toBeVisible();
  });

  test('should support pinch-to-zoom on topology', async ({ page }) => {
    await page.goto('/topology');

    // Simulate pinch gesture (Playwright supports touch events)
    await page.touchscreen.tap(100, 100);
    // ... pinch simulation
  });

  test('should support swipe gestures in list', async ({ page }) => {
    await page.goto('/pods');

    const firstItem = page.locator('[data-testid="pod-list-item"]').first();

    // Swipe left to reveal actions
    await firstItem.hover();
    await page.mouse.down();
    await page.mouse.move(-100, 0);
    await page.mouse.up();

    // Check if action buttons are visible
    await expect(page.locator('[data-testid="delete-button"]')).toBeVisible();
  });
});
```

---

## 4. Backend Integration Tests (Go)

### 4.1 Test Structure

```
backend/
├── internal/
│   ├── service/
│   │   ├── cluster_service_test.go
│   │   ├── resource_service_test.go
│   │   └── topology_service_test.go
│   ├── topology/
│   │   ├── engine_test.go
│   │   ├── builder_test.go
│   │   └── validator_test.go
│   └── api/
│       └── rest/
│           ├── clusters_test.go
│           ├── resources_test.go
│           └── topology_test.go
└── test/
    ├── fixtures/
    │   └── k8s-resources.yaml
    └── integration/
        ├── k8s_client_test.go
        └── full_flow_test.go
```

### 4.2 Example Tests

```go
// internal/topology/engine_test.go
package topology

import (
    "context"
    "testing"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestTopologyEngine_BuildGraph(t *testing.T) {
    // Setup mock K8s client
    client := newMockK8sClient()

    // Add test resources
    client.AddPod(&v1.Pod{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "nginx-abc123",
            Namespace: "default",
            UID:       "pod-uid-1",
            OwnerReferences: []metav1.OwnerReference{
                {UID: "rs-uid-1", Kind: "ReplicaSet", Name: "nginx-rs"},
            },
        },
        Spec: v1.PodSpec{
            NodeName: "node-1",
            Containers: []v1.Container{
                {Name: "nginx", Image: "nginx:latest"},
            },
        },
        Status: v1.PodStatus{Phase: "Running"},
    })

    client.AddReplicaSet(&appsv1.ReplicaSet{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "nginx-rs",
            Namespace: "default",
            UID:       "rs-uid-1",
            OwnerReferences: []metav1.OwnerReference{
                {UID: "deploy-uid-1", Kind: "Deployment", Name: "nginx"},
            },
        },
    })

    client.AddDeployment(&appsv1.Deployment{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "nginx",
            Namespace: "default",
            UID:       "deploy-uid-1",
        },
    })

    // Build graph
    engine := NewTopologyEngine(client)
    graph, err := engine.BuildGraph(context.Background(), TopologyFilters{})

    require.NoError(t, err)
    assert.NotNil(t, graph)

    // Verify nodes
    assert.Equal(t, 3, len(graph.Nodes)) // Pod, ReplicaSet, Deployment

    // Verify edges
    assert.Equal(t, 2, len(graph.Edges)) // RS→Pod, Deploy→RS

    // Verify specific relationships
    podNode := graph.GetNode("pod-uid-1")
    require.NotNil(t, podNode)

    rsEdge := graph.GetEdgeBetween("rs-uid-1", "pod-uid-1")
    require.NotNil(t, rsEdge)
    assert.Equal(t, "owner", rsEdge.Type)
}

func TestTopologyEngine_ValidateGraph(t *testing.T) {
    engine := NewTopologyEngine(nil)
    graph := NewGraph()

    // Add nodes
    graph.AddNode(&TopologyNode{ID: "node-1", Type: "Pod", Name: "pod-1"})
    graph.AddNode(&TopologyNode{ID: "node-2", Type: "Service", Name: "svc-1"})

    // Add edge
    graph.AddEdge(&TopologyEdge{
        ID:     "edge-1",
        Source: "node-2",
        Target: "node-1",
        Type:   "selector",
    })

    // Validate
    err := engine.ValidateGraph(graph)
    assert.NoError(t, err)
}

func TestTopologyEngine_GraphClosure(t *testing.T) {
    // Test that transitive relationships are complete
    // Pod → PVC → PV → StorageClass
    // All must be in graph
}

// internal/api/rest/clusters_test.go
func TestClustersAPI_CreateCluster(t *testing.T) {
    // Setup test server
    router := setupTestRouter()
    server := httptest.NewServer(router)
    defer server.Close()

    // Create cluster request
    reqBody := `{
        "name": "test-cluster",
        "server": "https://127.0.0.1:6443",
        "context": "default",
        "kubeconfig_path": "/tmp/test-kubeconfig"
    }`

    resp, err := http.Post(
        server.URL+"/api/v1/clusters",
        "application/json",
        strings.NewReader(reqBody),
    )

    require.NoError(t, err)
    assert.Equal(t, http.StatusCreated, resp.StatusCode)

    // Verify response
    var cluster models.Cluster
    json.NewDecoder(resp.Body).Decode(&cluster)
    assert.Equal(t, "test-cluster", cluster.Name)
}
```

---

## 5. Topology Truth Tests

### 5.1 Completeness Tests

```typescript
// e2e/specs/topology-truth.spec.ts
test.describe('Topology Completeness', () => {
  test('should include all resource relationships', async ({ page }) => {
    await page.goto('/topology');

    // Fetch topology data from API
    const topologyData = await page.evaluate(() => {
      return fetch('/api/v1/topology')
        .then(r => r.json());
    });

    // Test Pod → ReplicaSet → Deployment chain
    const pod = topologyData.nodes.find(n => n.type === 'Pod' && n.name === 'nginx-abc123');
    const edges = topologyData.edges.filter(e => e.target === pod.id);

    // Must have edge from ReplicaSet
    const rsEdge = edges.find(e => e.type === 'owner');
    expect(rsEdge).toBeTruthy();

    // Follow to ReplicaSet
    const rs = topologyData.nodes.find(n => n.id === rsEdge.source);
    expect(rs.type).toBe('ReplicaSet');

    // Follow to Deployment
    const deployEdge = topologyData.edges.find(e => e.target === rs.id);
    expect(deployEdge).toBeTruthy();
  });

  test('should include ConfigMap/Secret relationships', async ({ page }) => {
    await page.goto('/topology');

    const topologyData = await page.evaluate(() => {
      return fetch('/api/v1/topology').then(r => r.json());
    });

    // Find pod that mounts configmap
    const pod = topologyData.nodes.find(n => n.type === 'Pod' && n.name === 'app-pod');
    const volumeEdges = topologyData.edges.filter(e =>
      e.source === pod.id && e.type === 'volume'
    );

    expect(volumeEdges.length).toBeGreaterThan(0);
  });

  test('should not have orphan nodes (except namespaces)', async ({ page }) => {
    await page.goto('/topology');

    const topologyData = await page.evaluate(() => {
      return fetch('/api/v1/topology').then(r => r.json());
    });

    for (const node of topologyData.nodes) {
      if (node.type === 'Namespace') continue; // Namespaces can be orphans

      const hasIncoming = topologyData.edges.some(e => e.target === node.id);
      const hasOutgoing = topologyData.edges.some(e => e.source === node.id);

      expect(hasIncoming || hasOutgoing).toBeTruthy();
    }
  });
});
```

### 5.2 Determinism Tests

```typescript
test.describe('Topology Determinism', () => {
  test('should generate same layout for same graph', async ({ page }) => {
    // Fetch topology twice
    const topology1 = await page.evaluate(() =>
      fetch('/api/v1/topology').then(r => r.json())
    );

    await page.reload();

    const topology2 = await page.evaluate(() =>
      fetch('/api/v1/topology').then(r => r.json())
    );

    // Verify layout seed is identical
    expect(topology1.meta.layoutSeed).toEqual(topology2.meta.layoutSeed);

    // Verify node positions are identical
    for (let i = 0; i < topology1.nodes.length; i++) {
      expect(topology1.nodes[i].position).toEqual(topology2.nodes[i].position);
    }
  });
});
```

### 5.3 WYSIWYG Export Tests

```typescript
test.describe('WYSIWYG Export', () => {
  test('should export identical topology as PDF', async ({ page }) => {
    await page.goto('/topology');

    // Take screenshot of UI
    const uiScreenshot = await page.screenshot({ path: 'ui-topology.png' });

    // Export as PDF
    const downloadPath = await exportTopology('pdf');

    // Convert PDF to image
    const pdfImage = await convertPDFToImage(downloadPath);

    // Compare images (pixel-by-pixel or structural similarity)
    const similarity = await compareImages(uiScreenshot, pdfImage);

    expect(similarity).toBeGreaterThan(0.95); // 95% similarity
  });
});
```

---

## 6. Contract Tests

### 6.1 API Contract Tests

```typescript
// test/contracts/topology-api.contract.ts
import { test, expect } from '@playwright/test';

test.describe('Topology API Contract', () => {
  test('GET /api/v1/topology should match schema', async ({ request }) => {
    const response = await request.get('/api/v1/topology');

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Verify structure
    expect(data).toHaveProperty('nodes');
    expect(data).toHaveProperty('edges');
    expect(data).toHaveProperty('meta');

    // Verify node schema
    expect(data.nodes[0]).toMatchObject({
      id: expect.any(String),
      type: expect.any(String),
      name: expect.any(String),
      status: expect.any(String),
    });

    // Verify edge schema
    expect(data.edges[0]).toMatchObject({
      id: expect.any(String),
      source: expect.any(String),
      target: expect.any(String),
      type: expect.any(String),
    });
  });
});
```

---

## 7. Visual Regression Tests

```typescript
// e2e/specs/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression', () => {
  test('should match dashboard snapshot', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveScreenshot('dashboard.png');
  });

  test('should match topology view snapshot', async ({ page }) => {
    await page.goto('/topology');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('topology.png');
  });

  test('should match pod detail snapshot', async ({ page }) => {
    await page.goto('/pods/default/nginx-abc123');
    await expect(page).toHaveScreenshot('pod-detail.png');
  });
});
```

---

## 8. Performance & Load Tests

### 8.1 Topology Performance

```go
// test/performance/topology_bench_test.go
func BenchmarkTopologyEngine_10KNodes(b *testing.B) {
    client := newMockK8sClient()

    // Generate 10,000 pods
    for i := 0; i < 10000; i++ {
        client.AddPod(generateMockPod(i))
    }

    engine := NewTopologyEngine(client)

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := engine.BuildGraph(context.Background(), TopologyFilters{})
        if err != nil {
            b.Fatal(err)
        }
    }
}

// Target: <2s for 10K nodes
```

---

## 9. CI/CD Integration

### 9.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.24'
      - name: Run unit tests
        run: go test -v -race -coverprofile=coverage.out ./...
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run frontend tests
        run: npm test
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npx playwright test
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up k3s
        run: |
          curl -sfL https://get.k3s.io | sh -
          kubectl apply -f test/fixtures/test-cluster.yaml
      - name: Start backend
        run: |
          go build -o backend cmd/server/main.go
          ./backend &
      - name: Run integration tests
        run: go test -v ./test/integration/...
```

---

## 10. Test Data Management

### 10.1 Test Fixtures

```yaml
# test/fixtures/test-cluster.yaml
# Comprehensive K8s resources for testing all relationships
apiVersion: v1
kind: Namespace
metadata:
  name: test-ns
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-deploy
  namespace: test-ns
spec:
  replicas: 3
  selector:
    matchLabels:
      app: test
  template:
    metadata:
      labels:
        app: test
    spec:
      containers:
      - name: app
        image: nginx
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secret
        volumeMounts:
        - name: config-volume
          mountPath: /config
        - name: data-volume
          mountPath: /data
      volumes:
      - name: config-volume
        configMap:
          name: app-config
      - name: data-volume
        persistentVolumeClaim:
          claimName: app-pvc
---
# Add ConfigMap, Secret, PVC, Service, etc.
```

---

**(End of E2E Testing Blueprint)**

**Summary**: This comprehensive testing strategy ensures Kubilitics meets all quality requirements, with particular focus on topology correctness, determinism, and WYSIWYG export guarantees.
