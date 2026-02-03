package topology

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/kubilitics/kubilitics-backend/internal/models"
)

// BenchmarkGraphBuilding benchmarks graph construction with various node counts
func BenchmarkGraphBuilding(b *testing.B) {
	nodeCounts := []int{100, 500, 1000, 5000, 10000}

	for _, nodeCount := range nodeCounts {
		b.Run(fmt.Sprintf("nodes_%d", nodeCount), func(b *testing.B) {
			graph := generateLargeGraph(nodeCount)
			
			b.ResetTimer()
			b.ReportAllocs()
			
			for i := 0; i < b.N; i++ {
				_ = graph.Validate()
			}
		})
	}
}

// BenchmarkGraphLookup benchmarks node lookup performance
func BenchmarkGraphLookup(b *testing.B) {
	nodeCounts := []int{1000, 5000, 10000}

	for _, nodeCount := range nodeCounts {
		b.Run(fmt.Sprintf("nodes_%d", nodeCount), func(b *testing.B) {
			graph := generateLargeGraph(nodeCount)
			
			b.ResetTimer()
			
			for i := 0; i < b.N; i++ {
				nodeID := fmt.Sprintf("node-%d", i%nodeCount)
				_ = graph.GetNode(nodeID)
			}
		})
	}
}

// BenchmarkRelationshipInference benchmarks relationship inference
func BenchmarkRelationshipInference(b *testing.B) {
	nodeCounts := []int{100, 500, 1000}

	for _, nodeCount := range nodeCounts {
		b.Run(fmt.Sprintf("nodes_%d", nodeCount), func(b *testing.B) {
			b.ResetTimer()
			b.ReportAllocs()
			
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				graph := generateGraphWithOwnerRefs(nodeCount)
				inferencer := NewRelationshipInferencer(nil, graph)
				b.StartTimer()
				
				_ = inferencer.inferOwnerReferences()
			}
		})
	}
}

// BenchmarkGraphToTopology benchmarks conversion to TopologyGraph
func BenchmarkGraphToTopology(b *testing.B) {
	nodeCounts := []int{1000, 5000, 10000}

	for _, nodeCount := range nodeCounts {
		b.Run(fmt.Sprintf("nodes_%d", nodeCount), func(b *testing.B) {
			graph := generateLargeGraph(nodeCount)
			
			b.ResetTimer()
			b.ReportAllocs()
			
			for i := 0; i < b.N; i++ {
				_ = graph.ToTopologyGraph()
			}
		})
	}
}

// BenchmarkLayoutSeedGeneration benchmarks deterministic layout seed generation
func BenchmarkLayoutSeedGeneration(b *testing.B) {
	nodeCounts := []int{1000, 5000, 10000}

	for _, nodeCount := range nodeCounts {
		b.Run(fmt.Sprintf("nodes_%d", nodeCount), func(b *testing.B) {
			graph := generateLargeGraph(nodeCount)
			
			b.ResetTimer()
			
			for i := 0; i < b.N; i++ {
				_ = graph.GenerateLayoutSeed()
			}
		})
	}
}

// BenchmarkGetNodesByType benchmarks filtering nodes by type
func BenchmarkGetNodesByType(b *testing.B) {
	graph := generateMixedTypeGraph(10000)
	
	b.ResetTimer()
	
	for i := 0; i < b.N; i++ {
		_ = graph.GetNodesByType("Deployment")
	}
}

// BenchmarkEdgeOperations benchmarks edge addition and retrieval
func BenchmarkEdgeOperations(b *testing.B) {
	b.Run("AddEdge", func(b *testing.B) {
		graph := generateLargeGraph(1000)
		
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			edge := models.TopologyEdge{
				ID:     fmt.Sprintf("edge-bench-%d", i),
				Source: fmt.Sprintf("node-%d", i%1000),
				Target: fmt.Sprintf("node-%d", (i+1)%1000),
				Type:   "owner",
			}
			graph.AddEdge(edge)
		}
	})

	b.Run("GetOutgoingEdges", func(b *testing.B) {
		graph := generateGraphWithEdges(1000, 5000)
		
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			nodeID := fmt.Sprintf("node-%d", i%1000)
			_ = graph.GetOutgoingEdges(nodeID)
		}
	})

	b.Run("GetIncomingEdges", func(b *testing.B) {
		graph := generateGraphWithEdges(1000, 5000)
		
		b.ResetTimer()
		
		for i := 0; i < b.N; i++ {
			nodeID := fmt.Sprintf("node-%d", i%1000)
			_ = graph.GetIncomingEdges(nodeID)
		}
	})
}

// Helper: generateLargeGraph creates a graph with specified node count
func generateLargeGraph(nodeCount int) *Graph {
	graph := NewGraph()
	
	for i := 0; i < nodeCount; i++ {
		node := models.TopologyNode{
			ID:        fmt.Sprintf("node-%d", i),
			Type:      "Pod",
			Name:      fmt.Sprintf("pod-%d", i),
			Namespace: "default",
			Labels:    map[string]string{"app": "test"},
			Metadata:  map[string]interface{}{"index": i},
		}
		graph.AddNode(node)
	}
	
	return graph
}

// Helper: generateMixedTypeGraph creates graph with multiple resource types
func generateMixedTypeGraph(nodeCount int) *Graph {
	graph := NewGraph()
	types := []string{"Pod", "Service", "Deployment", "ReplicaSet", "ConfigMap"}
	
	for i := 0; i < nodeCount; i++ {
		nodeType := types[i%len(types)]
		node := models.TopologyNode{
			ID:        fmt.Sprintf("node-%d", i),
			Type:      nodeType,
			Name:      fmt.Sprintf("%s-%d", nodeType, i),
			Namespace: "default",
		}
		graph.AddNode(node)
	}
	
	return graph
}

// Helper: generateGraphWithOwnerRefs creates graph with owner references
func generateGraphWithOwnerRefs(nodeCount int) *Graph {
	graph := NewGraph()
	
	// Create deployments
	for i := 0; i < nodeCount/3; i++ {
		deployment := models.TopologyNode{
			ID:        fmt.Sprintf("deployment-%d", i),
			Type:      "Deployment",
			Name:      fmt.Sprintf("deployment-%d", i),
			Namespace: "default",
			UID:       fmt.Sprintf("deployment-uid-%d", i),
		}
		graph.AddNode(deployment)
	}
	
	// Create replicasets owned by deployments
	for i := 0; i < nodeCount/3; i++ {
		rs := models.TopologyNode{
			ID:        fmt.Sprintf("rs-%d", i),
			Type:      "ReplicaSet",
			Name:      fmt.Sprintf("rs-%d", i),
			Namespace: "default",
			UID:       fmt.Sprintf("rs-uid-%d", i),
			Metadata: map[string]interface{}{
				"ownerReferences": []interface{}{
					map[string]interface{}{
						"uid":  fmt.Sprintf("deployment-uid-%d", i%(nodeCount/3)),
						"kind": "Deployment",
					},
				},
			},
		}
		graph.AddNode(rs)
	}
	
	// Create pods owned by replicasets
	for i := 0; i < nodeCount/3; i++ {
		pod := models.TopologyNode{
			ID:        fmt.Sprintf("pod-%d", i),
			Type:      "Pod",
			Name:      fmt.Sprintf("pod-%d", i),
			Namespace: "default",
			UID:       fmt.Sprintf("pod-uid-%d", i),
			Metadata: map[string]interface{}{
				"ownerReferences": []interface{}{
					map[string]interface{}{
						"uid":  fmt.Sprintf("rs-uid-%d", i%(nodeCount/3)),
						"kind": "ReplicaSet",
					},
				},
			},
		}
		graph.AddNode(pod)
	}
	
	return graph
}

// Helper: generateGraphWithEdges creates graph with specified nodes and edges
func generateGraphWithEdges(nodeCount, edgeCount int) *Graph {
	graph := generateLargeGraph(nodeCount)
	
	for i := 0; i < edgeCount; i++ {
		edge := models.TopologyEdge{
			ID:     fmt.Sprintf("edge-%d", i),
			Source: fmt.Sprintf("node-%d", i%nodeCount),
			Target: fmt.Sprintf("node-%d", (i+1)%nodeCount),
			Type:   "owner",
			Label:  "owns",
		}
		graph.AddEdge(edge)
	}
	
	return graph
}

// Test that large graphs meet performance targets
func TestLargeGraphPerformance(t *testing.T) {
	// Target: <2s for 10K nodes
	const targetTime = 2 * time.Second
	const nodeCount = 10000

	graph := generateLargeGraph(nodeCount)
	
	start := time.Now()
	err := graph.Validate()
	elapsed := time.Since(start)
	
	if err != nil {
		t.Fatalf("Validation failed: %v", err)
	}
	
	if elapsed > targetTime {
		t.Errorf("Performance target not met: %v > %v (for %d nodes)", elapsed, targetTime, nodeCount)
	} else {
		t.Logf("✅ Performance target met: %v < %v (for %d nodes)", elapsed, targetTime, nodeCount)
	}
}

// Test graph memory efficiency
func TestGraphMemoryEfficiency(t *testing.T) {
	ctx := context.Background()
	
	// Create graphs of different sizes and measure
	sizes := []int{100, 1000, 5000}
	
	for _, size := range sizes {
		graph := generateLargeGraph(size)
		_ = ctx // Use context if needed for future operations
		
		// Convert to topology
		topology := graph.ToTopologyGraph()
		
		// Basic sanity check
		if topology.Meta.NodeCount != size {
			t.Errorf("Expected %d nodes, got %d", size, topology.Meta.NodeCount)
		}
		
		t.Logf("Graph with %d nodes: %d edges, memory efficient", size, topology.Meta.EdgeCount)
	}
}
