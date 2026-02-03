package topology

import (
	"testing"

	"github.com/kubilitics/kubilitics-backend/internal/models"
	"github.com/stretchr/testify/assert"
)

func TestNewGraph(t *testing.T) {
	graph := NewGraph()
	
	assert.NotNil(t, graph)
	assert.Equal(t, 0, len(graph.Nodes))
	assert.Equal(t, 0, len(graph.Edges))
	assert.NotNil(t, graph.NodeMap)
	assert.NotNil(t, graph.EdgeMap)
}

func TestAddNode(t *testing.T) {
	graph := NewGraph()
	
	node := models.TopologyNode{
		ID:        "pod-123",
		Type:      "Pod",
		Namespace: "default",
		Name:      "nginx",
		Status:    "Running",
	}
	
	graph.AddNode(node)
	
	assert.Equal(t, 1, len(graph.Nodes))
	assert.Equal(t, "pod-123", graph.Nodes[0].ID)
	assert.NotNil(t, graph.NodeMap["pod-123"])
}

func TestAddNodeDuplicate(t *testing.T) {
	graph := NewGraph()
	
	node := models.TopologyNode{
		ID:   "pod-123",
		Type: "Pod",
		Name: "nginx",
	}
	
	graph.AddNode(node)
	graph.AddNode(node) // Add same node again
	
	// Should only have one node
	assert.Equal(t, 1, len(graph.Nodes))
}

func TestAddEdge(t *testing.T) {
	graph := NewGraph()
	
	edge := models.TopologyEdge{
		ID:     "edge-1",
		Source: "deploy-1",
		Target: "pod-1",
		Type:   "owner",
		Label:  "owns",
	}
	
	graph.AddEdge(edge)
	
	assert.Equal(t, 1, len(graph.Edges))
	assert.Equal(t, "edge-1", graph.Edges[0].ID)
}

func TestAddEdgeDuplicate(t *testing.T) {
	graph := NewGraph()
	
	edge := models.TopologyEdge{
		ID:     "edge-1",
		Source: "deploy-1",
		Target: "pod-1",
		Type:   "owner",
	}
	
	graph.AddEdge(edge)
	graph.AddEdge(edge) // Add same edge again
	
	// Should only have one edge
	assert.Equal(t, 1, len(graph.Edges))
}

func TestGetNode(t *testing.T) {
	graph := NewGraph()
	
	node := models.TopologyNode{
		ID:   "pod-123",
		Type: "Pod",
		Name: "nginx",
	}
	
	graph.AddNode(node)
	
	foundNode := graph.GetNode("pod-123")
	assert.NotNil(t, foundNode)
	assert.Equal(t, "pod-123", foundNode.ID)
	
	notFound := graph.GetNode("nonexistent")
	assert.Nil(t, notFound)
}

func TestGetNodesByType(t *testing.T) {
	graph := NewGraph()
	
	graph.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Name: "nginx-1"})
	graph.AddNode(models.TopologyNode{ID: "pod-2", Type: "Pod", Name: "nginx-2"})
	graph.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Name: "nginx-svc"})
	
	pods := graph.GetNodesByType("Pod")
	assert.Equal(t, 2, len(pods))
	
	services := graph.GetNodesByType("Service")
	assert.Equal(t, 1, len(services))
	
	deployments := graph.GetNodesByType("Deployment")
	assert.Equal(t, 0, len(deployments))
}

func TestGenerateLayoutSeed(t *testing.T) {
	graph := NewGraph()
	
	graph.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Namespace: "default", Name: "nginx"})
	graph.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Namespace: "default", Name: "nginx-svc"})
	graph.AddEdge(models.TopologyEdge{ID: "edge-1", Source: "svc-1", Target: "pod-1", Type: "selector"})
	
	seed1 := graph.GenerateLayoutSeed()
	assert.NotEmpty(t, seed1)
	assert.Equal(t, 64, len(seed1)) // SHA256 hex string
	
	// Same graph should produce same seed (determinism)
	seed2 := graph.GenerateLayoutSeed()
	assert.Equal(t, seed1, seed2)
}

func TestGenerateLayoutSeedDeterminism(t *testing.T) {
	// Create two identical graphs
	graph1 := NewGraph()
	graph1.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Namespace: "default", Name: "nginx"})
	graph1.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Namespace: "default", Name: "nginx-svc"})
	graph1.AddEdge(models.TopologyEdge{ID: "edge-1", Source: "svc-1", Target: "pod-1", Type: "selector"})
	
	graph2 := NewGraph()
	graph2.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Namespace: "default", Name: "nginx"})
	graph2.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Namespace: "default", Name: "nginx-svc"})
	graph2.AddEdge(models.TopologyEdge{ID: "edge-1", Source: "svc-1", Target: "pod-1", Type: "selector"})
	
	seed1 := graph1.GenerateLayoutSeed()
	seed2 := graph2.GenerateLayoutSeed()
	
	// Identical graphs should produce identical seeds
	assert.Equal(t, seed1, seed2)
}

func TestValidate(t *testing.T) {
	graph := NewGraph()
	
	// Add nodes and edges
	graph.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Name: "nginx"})
	graph.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Name: "nginx-svc"})
	graph.AddEdge(models.TopologyEdge{ID: "edge-1", Source: "svc-1", Target: "pod-1", Type: "selector"})
	
	// Valid graph should pass
	err := graph.Validate()
	assert.NoError(t, err)
}

func TestValidateOrphanEdge(t *testing.T) {
	graph := NewGraph()
	
	// Add edge without nodes
	graph.AddEdge(models.TopologyEdge{
		ID:     "edge-1",
		Source: "nonexistent-1",
		Target: "nonexistent-2",
		Type:   "owner",
	})
	
	// Should fail validation
	err := graph.Validate()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "orphan")
}

func TestGetOutgoingEdges(t *testing.T) {
	graph := NewGraph()
	
	graph.AddEdge(models.TopologyEdge{ID: "e1", Source: "n1", Target: "n2", Type: "owner"})
	graph.AddEdge(models.TopologyEdge{ID: "e2", Source: "n1", Target: "n3", Type: "owner"})
	graph.AddEdge(models.TopologyEdge{ID: "e3", Source: "n2", Target: "n3", Type: "selector"})
	
	edges := graph.GetOutgoingEdges("n1")
	assert.Equal(t, 2, len(edges))
	
	edges = graph.GetOutgoingEdges("n2")
	assert.Equal(t, 1, len(edges))
	
	edges = graph.GetOutgoingEdges("n3")
	assert.Equal(t, 0, len(edges))
}

func TestGetIncomingEdges(t *testing.T) {
	graph := NewGraph()
	
	graph.AddEdge(models.TopologyEdge{ID: "e1", Source: "n1", Target: "n3", Type: "owner"})
	graph.AddEdge(models.TopologyEdge{ID: "e2", Source: "n2", Target: "n3", Type: "owner"})
	graph.AddEdge(models.TopologyEdge{ID: "e3", Source: "n1", Target: "n2", Type: "selector"})
	
	edges := graph.GetIncomingEdges("n3")
	assert.Equal(t, 2, len(edges))
	
	edges = graph.GetIncomingEdges("n2")
	assert.Equal(t, 1, len(edges))
	
	edges = graph.GetIncomingEdges("n1")
	assert.Equal(t, 0, len(edges))
}

func TestToTopologyGraph(t *testing.T) {
	graph := NewGraph()
	
	graph.AddNode(models.TopologyNode{ID: "pod-1", Type: "Pod", Name: "nginx"})
	graph.AddNode(models.TopologyNode{ID: "svc-1", Type: "Service", Name: "nginx-svc"})
	graph.AddEdge(models.TopologyEdge{ID: "edge-1", Source: "svc-1", Target: "pod-1", Type: "selector"})
	
	graph.LayoutSeed = "test-seed-123"
	
	topology := graph.ToTopologyGraph()
	
	assert.Equal(t, 2, topology.Meta.NodeCount)
	assert.Equal(t, 1, topology.Meta.EdgeCount)
	assert.Equal(t, "test-seed-123", topology.Meta.LayoutSeed)
	assert.Equal(t, "1.0", topology.Meta.Version)
	assert.Equal(t, 2, len(topology.Nodes))
	assert.Equal(t, 1, len(topology.Edges))
}
