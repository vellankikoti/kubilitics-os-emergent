package service

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"
	"github.com/kubilitics/kubilitics-backend/internal/config"
	"github.com/kubilitics/kubilitics-backend/internal/k8s"
	"github.com/kubilitics/kubilitics-backend/internal/models"
	"github.com/kubilitics/kubilitics-backend/internal/repository"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const defaultMaxClusters = 100

// ClusterService manages Kubernetes clusters
type ClusterService interface {
	ListClusters(ctx context.Context) ([]*models.Cluster, error)
	GetCluster(ctx context.Context, id string) (*models.Cluster, error)
	AddCluster(ctx context.Context, kubeconfigPath, contextName string) (*models.Cluster, error)
	RemoveCluster(ctx context.Context, id string) error
	TestConnection(ctx context.Context, id string) error
	GetClusterSummary(ctx context.Context, id string) (*models.ClusterSummary, error)
	// LoadClustersFromRepo restores K8s clients from persisted clusters (call on startup).
	LoadClustersFromRepo(ctx context.Context) error
	// GetClient returns the K8s client for a cluster (for internal use by topology, resources, etc.).
	GetClient(id string) (*k8s.Client, error)
}

type clusterService struct {
	repo               repository.ClusterRepository
	clients            map[string]*k8s.Client // id -> live K8s client
	maxClusters        int
	k8sTimeout         time.Duration // timeout for outbound K8s API calls; 0 = use request context only
	k8sRateLimitPerSec float64
	k8sRateLimitBurst  int
}

func NewClusterService(repo repository.ClusterRepository, cfg *config.Config) ClusterService {
	maxClusters := defaultMaxClusters
	var k8sTimeout time.Duration
	var k8sRatePerSec float64
	var k8sRateBurst int
	if cfg != nil {
		if cfg.MaxClusters > 0 {
			maxClusters = cfg.MaxClusters
		}
		if cfg.K8sTimeoutSec > 0 {
			k8sTimeout = time.Duration(cfg.K8sTimeoutSec) * time.Second
		}
		if cfg.K8sRateLimitPerSec > 0 && cfg.K8sRateLimitBurst > 0 {
			k8sRatePerSec = cfg.K8sRateLimitPerSec
			k8sRateBurst = cfg.K8sRateLimitBurst
		}
	}
	return &clusterService{
		repo:               repo,
		clients:            make(map[string]*k8s.Client),
		maxClusters:        maxClusters,
		k8sTimeout:         k8sTimeout,
		k8sRateLimitPerSec: k8sRatePerSec,
		k8sRateLimitBurst:  k8sRateBurst,
	}
}

func (s *clusterService) ListClusters(ctx context.Context) ([]*models.Cluster, error) {
	clusters, err := s.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	// Enrich with live client status where available; try reconnect when client missing
	for _, c := range clusters {
		if client, ok := s.clients[c.ID]; ok {
			info, err := client.GetClusterInfo(ctx)
			if err != nil {
				c.Status = clusterStatusFromError(err)
				_ = s.repo.Update(ctx, c)
				continue
			}
			c.ServerURL = info["server_url"].(string)
			c.Version = info["version"].(string)
			c.Status = "connected"
			c.LastConnected = time.Now()
			_ = s.repo.Update(ctx, c)
		} else {
			// No in-memory client (e.g. after restart or temp kubeconfig gone); try reconnect with stored or default kubeconfig
			if s.tryReconnectCluster(ctx, c) {
				if client, ok := s.clients[c.ID]; ok {
					info, _ := client.GetClusterInfo(ctx)
					if info != nil {
						c.ServerURL = info["server_url"].(string)
						c.Version = info["version"].(string)
					}
					c.Status = "connected"
					c.LastConnected = time.Now()
					_ = s.repo.Update(ctx, c)
				}
			} else {
				c.Status = "disconnected"
			}
		}
	}
	return clusters, nil
}

func (s *clusterService) GetCluster(ctx context.Context, id string) (*models.Cluster, error) {
	c, err := s.repo.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if client, ok := s.clients[id]; ok {
		info, err := client.GetClusterInfo(ctx)
		if err == nil {
			c.ServerURL = info["server_url"].(string)
			c.Version = info["version"].(string)
			c.Status = "connected"
			c.LastConnected = time.Now()
			_ = s.repo.Update(ctx, c)
		} else {
			c.Status = clusterStatusFromError(err)
			_ = s.repo.Update(ctx, c)
		}
	} else {
		if s.tryReconnectCluster(ctx, c) {
			if client, ok := s.clients[id]; ok {
				info, _ := client.GetClusterInfo(ctx)
				if info != nil {
					c.ServerURL = info["server_url"].(string)
					c.Version = info["version"].(string)
				}
				c.Status = "connected"
				c.LastConnected = time.Now()
				_ = s.repo.Update(ctx, c)
			}
		} else {
			c.Status = "disconnected"
		}
	}
	return c, nil
}

func (s *clusterService) AddCluster(ctx context.Context, kubeconfigPath, contextName string) (*models.Cluster, error) {
	list, err := s.repo.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list clusters: %w", err)
	}
	if len(list) >= s.maxClusters {
		return nil, fmt.Errorf("cluster limit reached (max %d); cannot add more clusters", s.maxClusters)
	}

	client, err := k8s.NewClient(kubeconfigPath, contextName)
	if err != nil {
		return nil, fmt.Errorf("failed to create client: %w", err)
	}
	if s.k8sTimeout > 0 {
		client.SetTimeout(s.k8sTimeout)
	}
	if s.k8sRateLimitPerSec > 0 && s.k8sRateLimitBurst > 0 {
		client.SetLimiter(rate.NewLimiter(rate.Limit(s.k8sRateLimitPerSec), s.k8sRateLimitBurst))
	}

	if err := client.TestConnection(ctx); err != nil {
		return nil, fmt.Errorf("connection test failed: %w", err)
	}

	info, err := client.GetClusterInfo(ctx)
	if err != nil {
		return nil, err
	}

	cluster := &models.Cluster{
		ID:             uuid.New().String(),
		Name:           contextName,
		Context:        contextName,
		KubeconfigPath: kubeconfigPath,
		ServerURL:      info["server_url"].(string),
		Version:        info["version"].(string),
		Status:         "connected",
		LastConnected:  time.Now(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if err := s.repo.Create(ctx, cluster); err != nil {
		return nil, fmt.Errorf("failed to persist cluster: %w", err)
	}
	s.clients[cluster.ID] = client
	return cluster, nil
}

func (s *clusterService) RemoveCluster(ctx context.Context, id string) error {
	if _, err := s.repo.Get(ctx, id); err != nil {
		return fmt.Errorf("cluster not found: %s", id)
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	delete(s.clients, id)
	return nil
}

func (s *clusterService) TestConnection(ctx context.Context, id string) error {
	client, exists := s.clients[id]
	if !exists {
		return fmt.Errorf("cluster not found: %s", id)
	}
	return client.TestConnection(ctx)
}

func (s *clusterService) GetClusterSummary(ctx context.Context, id string) (*models.ClusterSummary, error) {
	client, exists := s.clients[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}

	info, err := client.GetClusterInfo(ctx)
	if err != nil {
		return nil, err
	}

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
	client, exists := s.clients[id]
	if !exists {
		return nil, fmt.Errorf("cluster not found: %s", id)
	}
	return client, nil
}

// LoadClustersFromRepo restores K8s clients from persisted clusters (call on startup).
// Per-cluster failures do not abort the process; each cluster gets status disconnected/error.
func (s *clusterService) LoadClustersFromRepo(ctx context.Context) error {
	clusters, err := s.repo.List(ctx)
	if err != nil {
		return err
	}
	for _, c := range clusters {
		if c.KubeconfigPath == "" {
			c.Status = "disconnected"
			_ = s.repo.Update(ctx, c)
			continue
		}
		client, err := k8s.NewClient(c.KubeconfigPath, c.Context)
		if err != nil {
			c.Status = "error"
			_ = s.repo.Update(ctx, c)
			continue
		}
		if s.k8sTimeout > 0 {
			client.SetTimeout(s.k8sTimeout)
		}
		if s.k8sRateLimitPerSec > 0 && s.k8sRateLimitBurst > 0 {
			client.SetLimiter(rate.NewLimiter(rate.Limit(s.k8sRateLimitPerSec), s.k8sRateLimitBurst))
		}
		if err := client.TestConnection(ctx); err != nil {
			c.Status = clusterStatusFromError(err)
			_ = s.repo.Update(ctx, c)
			continue
		}
		s.clients[c.ID] = client
		c.Status = "connected"
		c.LastConnected = time.Now()
		_ = s.repo.Update(ctx, c)
	}
	return nil
}

// tryReconnectCluster builds a K8s client for a cluster when none is in memory (e.g. after restart).
// Uses stored KubeconfigPath if the file exists; otherwise falls back to default kubeconfig (~/.kube/config)
// so clusters like docker-desktop work when kubectl works on the same machine.
// Returns true if a client was created and stored.
func (s *clusterService) tryReconnectCluster(ctx context.Context, c *models.Cluster) bool {
	path := c.KubeconfigPath
	if path != "" {
		if _, err := os.Stat(path); err != nil {
			path = "" // stored path missing (e.g. temp upload file gone); try default
		}
	}
	if path == "" {
		home, _ := os.UserHomeDir()
		if home != "" {
			path = filepath.Join(home, ".kube", "config")
		}
		if path == "" {
			return false
		}
	}
	client, err := k8s.NewClient(path, c.Context)
	if err != nil {
		return false
	}
	if s.k8sTimeout > 0 {
		client.SetTimeout(s.k8sTimeout)
	}
	if s.k8sRateLimitPerSec > 0 && s.k8sRateLimitBurst > 0 {
		client.SetLimiter(rate.NewLimiter(rate.Limit(s.k8sRateLimitPerSec), s.k8sRateLimitBurst))
	}
	if err := client.TestConnection(ctx); err != nil {
		return false
	}
	s.clients[c.ID] = client
	return true
}

// clusterStatusFromError maps K8s/context errors to status: "disconnected" for connection/context errors, "error" for 403/5xx etc.
func clusterStatusFromError(err error) string {
	if err == nil {
		return "connected"
	}
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return "disconnected"
	}
	return "error"
}
