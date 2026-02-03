package repository

import (
	"context"
	"time"

	"github.com/kubilitics/kubilitics-backend/internal/models"
)

// ClusterRepository defines cluster data access methods
type ClusterRepository interface {
	Create(ctx context.Context, cluster *models.Cluster) error
	Get(ctx context.Context, id string) (*models.Cluster, error)
	List(ctx context.Context) ([]*models.Cluster, error)
	Update(ctx context.Context, cluster *models.Cluster) error
	Delete(ctx context.Context, id string) error
}

// TopologyRepository defines topology data access methods
type TopologyRepository interface {
	SaveSnapshot(ctx context.Context, snapshot *models.TopologySnapshot) error
	GetSnapshot(ctx context.Context, id string) (*models.TopologySnapshot, error)
	ListSnapshots(ctx context.Context, clusterID string, limit int) ([]*models.TopologySnapshot, error)
	GetLatestSnapshot(ctx context.Context, clusterID, namespace string) (*models.TopologySnapshot, error)
	DeleteOldSnapshots(ctx context.Context, clusterID string, olderThan time.Time) error
}

// HistoryRepository defines resource history data access methods
type HistoryRepository interface {
	Create(ctx context.Context, history *models.ResourceHistory) error
	List(ctx context.Context, clusterID, resourceType, namespace, name string, limit int) ([]*models.ResourceHistory, error)
	GetDiff(ctx context.Context, id string) (string, error)
}

// Repository aggregates all repositories
type Repository struct {
	Cluster  ClusterRepository
	Topology TopologyRepository
	History  HistoryRepository
}
