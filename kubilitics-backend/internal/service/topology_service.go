package service

import (
	"context"
	"fmt"

	"github.com/kubilitics/kubilitics-backend/internal/models"
	"github.com/kubilitics/kubilitics-backend/internal/topology"
)

// TopologyService generates topology graphs
type TopologyService interface {
	GetTopology(ctx context.Context, clusterID string, filters models.TopologyFilters) (*models.TopologyGraph, error)
	ExportTopology(ctx context.Context, clusterID string, format string) ([]byte, error)
}

type topologyService struct {
	clusterService *clusterService
}

func NewTopologyService(cs ClusterService) TopologyService {
	return &topologyService{
		clusterService: cs.(*clusterService),
	}
}

func (s *topologyService) GetTopology(ctx context.Context, clusterID string, filters models.TopologyFilters) (*models.TopologyGraph, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	engine := topology.NewEngine(client)
	graph, err := engine.BuildGraph(ctx, filters)
	if err != nil {
		return nil, fmt.Errorf("failed to build topology: %w", err)
	}

	return graph, nil
}

func (s *topologyService) ExportTopology(ctx context.Context, clusterID string, format string) ([]byte, error) {
	// TODO: Implement export functionality
	return nil, fmt.Errorf("export not yet implemented")
}
