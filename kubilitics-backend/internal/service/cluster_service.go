package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/kubilitics/kubilitics-backend/internal/k8s"
	"github.com/kubilitics/kubilitics-backend/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ClusterService manages Kubernetes clusters
type ClusterService interface {
	ListClusters(ctx context.Context) ([]*models.Cluster, error)
	GetCluster(ctx context.Context, id string) (*models.Cluster, error)
	AddCluster(ctx context.Context, kubeconfigPath, context string) (*models.Cluster, error)
	RemoveCluster(ctx context.Context, id string) error
	TestConnection(ctx context.Context, id string) error
	GetClusterSummary(ctx context.Context, id string) (*models.ClusterSummary, error)
}

type clusterService struct {
	clusters map[string]*k8s.Client // In-memory for now
}

func NewClusterService() ClusterService {
	return &clusterService{
		clusters: make(map[string]*k8s.Client),
	}
}

func (s *clusterService) ListClusters(ctx context.Context) ([]*models.Cluster, error) {
	var clusters []*models.Cluster

	// Return configured clusters
	for id, client := range s.clusters {
		info, err := client.GetClusterInfo(ctx)
		if err != nil {
			continue
		}

		cluster := &models.Cluster{
			ID:            id,
			Name:          id, // Use ID as name for now
			Context:       client.Context,
			ServerURL:     info["server_url"].(string),
			Version:       info["version"].(string),
			Status:        "connected",
			LastConnected: time.Now(),
		}
		clusters = append(clusters, cluster)
	}

	return clusters, nil
}

func (s *clusterService) GetCluster(ctx context.Context, id string) (*models.Cluster, error) {
	client, exists := s.clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}

	info, err := client.GetClusterInfo(ctx)
	if err != nil {
		return nil, err
	}

	return &models.Cluster{
		ID:        id,
		Name:      id,
		Context:   client.Context,
		ServerURL: info["server_url"].(string),
		Version:   info["version"].(string),
		Status:    "connected",
	}, nil
}

func (s *clusterService) AddCluster(ctx context.Context, kubeconfigPath, contextName string) (*models.Cluster, error) {
	client, err := k8s.NewClient(kubeconfigPath, contextName)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}

	if err := client.TestConnection(ctx); err != nil {
		return nil, fmt.Errorf("connection test failed: %w", err)
	}

	id := uuid.New().String()
	s.clusters[id] = client

	info, _ := client.GetClusterInfo(ctx)

	return &models.Cluster{
		ID:        id,
		Name:      contextName,
		Context:   contextName,
		ServerURL: info["server_url"].(string),
		Version:   info["version"].(string),
		Status:    "connected",
		CreatedAt: time.Now(),
	}, nil
}

func (s *clusterService) RemoveCluster(ctx context.Context, id string) error {
	if _, exists := s.clusters[id]; !exists {
		return fmt.Errorf("cluster not found: %s", id)
	}

	delete(s.clusters, id)
	return nil
}

func (s *clusterService) TestConnection(ctx context.Context, id string) error {
	client, exists := s.clusters[id]
	if !exists {
		return fmt.Errorf("cluster not found: %s", id)
	}

	return client.TestConnection(ctx)
}

func (s *clusterService) GetClusterSummary(ctx context.Context, id string) (*models.ClusterSummary, error) {
	client, exists := s.clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}

	info, err := client.GetClusterInfo(ctx)
	if err != nil {
		return nil, err
	}

	// Get resource counts
	pods, _ := client.Clientset.CoreV1().Pods("").List(ctx, metav1.ListOptions{})
	deployments, _ := client.Clientset.AppsV1().Deployments("").List(ctx, metav1.ListOptions{})
	services, _ := client.Clientset.CoreV1().Services("").List(ctx, metav1.ListOptions{})

	return &models.ClusterSummary{
		ID:              id,
		Name:            id,
		NodeCount:       info["node_count"].(int),
		NamespaceCount:  info["namespace_count"].(int),
		PodCount:        len(pods.Items),
		DeploymentCount: len(deployments.Items),
		ServiceCount:    len(services.Items),
		HealthStatus:    "healthy",
	}, nil
}

// GetClient returns K8s client for internal use
func (s *clusterService) GetClient(id string) (*k8s.Client, error) {
	client, exists := s.clusters[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}
	return client, nil
}
