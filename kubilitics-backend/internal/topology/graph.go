package topology

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/kubilitics/kubilitics-backend/internal/models"
)

// Graph represents the topology graph
type Graph struct {
	Nodes      []models.TopologyNode
	Edges      []models.TopologyEdge
	NodeMap    map[string]*models.TopologyNode // For fast lookup
	EdgeMap    map[string]bool                 // For deduplication
	LayoutSeed string
}

// NewGraph creates a new empty graph
func NewGraph() *Graph {
	return &Graph{
		Nodes:   []models.TopologyNode{},
		Edges:   []models.TopologyEdge{},
		NodeMap: make(map[string]*models.TopologyNode),
		EdgeMap: make(map[string]bool),
	}
}

// AddNode adds a node to the graph
func (g *Graph) AddNode(node models.TopologyNode) {
	if _, exists := g.NodeMap[node.ID]; exists {
		return // Skip duplicates
	}

	g.Nodes = append(g.Nodes, node)
	g.NodeMap[node.ID] = &g.Nodes[len(g.Nodes)-1]
}

// AddEdge adds an edge to the graph
func (g *Graph) AddEdge(edge models.TopologyEdge) {
	edgeKey := fmt.Sprintf("%s->%s:%s", edge.Source, edge.Target, edge.Type)
	if g.EdgeMap[edgeKey] {
		return // Skip duplicates
	}

	g.Edges = append(g.Edges, edge)
	g.EdgeMap[edgeKey] = true
}

// GetNode retrieves a node by ID
func (g *Graph) GetNode(id string) *models.TopologyNode {
	return g.NodeMap[id]
}

// GenerateLayoutSeed generates a deterministic layout seed based on graph structure
func (g *Graph) GenerateLayoutSeed() string {
	// Sort nodes and edges for determinism
	sortedNodes := make([]string, len(g.Nodes))
	for i, node := range g.Nodes {
		sortedNodes[i] = fmt.Sprintf("%s:%s:%s", node.Type, node.Namespace, node.Name)
	}
	sort.Strings(sortedNodes)

	sortedEdges := make([]string, len(g.Edges))
	for i, edge := range g.Edges {
		sortedEdges[i] = fmt.Sprintf("%s->%s:%s", edge.Source, edge.Target, edge.Type)
	}
	sort.Strings(sortedEdges)

	// Create deterministic hash
	data := struct {
		Nodes []string
		Edges []string
	}{
		Nodes: sortedNodes,
		Edges: sortedEdges,
	}

	jsonData, _ := json.Marshal(data)
	hash := sha256.Sum256(jsonData)
	return fmt.Sprintf("%x", hash)
}

// ToTopologyGraph converts internal graph to API model
func (g *Graph) ToTopologyGraph() models.TopologyGraph {
	return models.TopologyGraph{
		Nodes: g.Nodes,
		Edges: g.Edges,
		Meta: models.TopologyMeta{
			NodeCount:   len(g.Nodes),
			EdgeCount:   len(g.Edges),
			LayoutSeed:  g.LayoutSeed,
			GeneratedAt: time.Now(),
			Version:     "1.0",
		},
	}
}

// Validate checks graph completeness and correctness
func (g *Graph) Validate() error {
	// Check for orphan edges (edges referencing non-existent nodes)
	for _, edge := range g.Edges {
		if g.GetNode(edge.Source) == nil {
			return fmt.Errorf("edge references non-existent source node: %s", edge.Source)
		}
		if g.GetNode(edge.Target) == nil {
			return fmt.Errorf("edge references non-existent target node: %s", edge.Target)
		}
	}

	// Check for duplicate node IDs
	if len(g.Nodes) != len(g.NodeMap) {
		return fmt.Errorf("duplicate node IDs detected")
	}

	return nil
}

// GetNodesByType returns all nodes of a given type
func (g *Graph) GetNodesByType(nodeType string) []models.TopologyNode {
	var result []models.TopologyNode
	for _, node := range g.Nodes {
		if node.Type == nodeType {
			result = append(result, node)
		}
	}
	return result
}

// GetOutgoingEdges returns all edges originating from a node
func (g *Graph) GetOutgoingEdges(nodeID string) []models.TopologyEdge {
	var result []models.TopologyEdge
	for _, edge := range g.Edges {
		if edge.Source == nodeID {
			result = append(result, edge)
		}
	}
	return result
}

// GetIncomingEdges returns all edges targeting a node
func (g *Graph) GetIncomingEdges(nodeID string) []models.TopologyEdge {
	var result []models.TopologyEdge
	for _, edge := range g.Edges {
		if edge.Target == nodeID {
			result = append(result, edge)
		}
	}
	return result
}
