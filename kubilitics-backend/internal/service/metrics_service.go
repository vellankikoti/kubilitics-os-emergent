package service

import (
	"context"
	"fmt"

	"github.com/kubilitics/kubilitics-backend/internal/models"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	"k8s.io/metrics/pkg/client/clientset/versioned"
)

// MetricsService provides access to cluster metrics
type MetricsService interface {
	GetPodMetrics(ctx context.Context, clusterID, namespace, podName string) (*PodMetrics, error)
	GetNodeMetrics(ctx context.Context, clusterID, nodeName string) (*NodeMetrics, error)
	GetNamespaceMetrics(ctx context.Context, clusterID, namespace string) (*NamespaceMetrics, error)
}

type metricsService struct {
	clusterService *clusterService
}

type PodMetrics struct {
	Name      string
	Namespace string
	CPU       string
	Memory    string
}

type NodeMetrics struct {
	Name   string
	CPU    string
	Memory string
}

type NamespaceMetrics struct {
	Namespace string
	PodCount  int
	TotalCPU  string
	TotalMemory string
}

// NewMetricsService creates a new metrics service
func NewMetricsService(cs ClusterService) MetricsService {
	return &metricsService{
		clusterService: cs.(*clusterService),
	}
}

func (s *metricsService) GetPodMetrics(ctx context.Context, clusterID, namespace, podName string) (*PodMetrics, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	metricsClient, err := versioned.NewForConfig(client.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %w", err)
	}

	podMetrics, err := metricsClient.MetricsV1beta1().PodMetricses(namespace).Get(ctx, podName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get pod metrics: %w", err)
	}

	var totalCPU, totalMemory int64
	for _, container := range podMetrics.Containers {
		totalCPU += container.Usage.Cpu().MilliValue()
		totalMemory += container.Usage.Memory().Value()
	}

	return &PodMetrics{
		Name:      podName,
		Namespace: namespace,
		CPU:       fmt.Sprintf("%dm", totalCPU),
		Memory:    fmt.Sprintf("%dMi", totalMemory/(1024*1024)),
	}, nil
}

func (s *metricsService) GetNodeMetrics(ctx context.Context, clusterID, nodeName string) (*NodeMetrics, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	metricsClient, err := versioned.NewForConfig(client.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %w", err)
	}

	nodeMetrics, err := metricsClient.MetricsV1beta1().NodeMetricses().Get(ctx, nodeName, metav1.GetOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get node metrics: %w", err)
	}

	return &NodeMetrics{
		Name:   nodeName,
		CPU:    fmt.Sprintf("%dm", nodeMetrics.Usage.Cpu().MilliValue()),
		Memory: fmt.Sprintf("%dMi", nodeMetrics.Usage.Memory().Value()/(1024*1024)),
	}, nil
}

func (s *metricsService) GetNamespaceMetrics(ctx context.Context, clusterID, namespace string) (*NamespaceMetrics, error) {
	client, err := s.clusterService.GetClient(clusterID)
	if err != nil {
		return nil, err
	}

	metricsClient, err := versioned.NewForConfig(client.Config)
	if err != nil {
		return nil, fmt.Errorf("failed to create metrics client: %w", err)
	}

	podMetricsList, err := metricsClient.MetricsV1beta1().PodMetricses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list pod metrics: %w", err)
	}

	var totalCPU, totalMemory int64
	for _, podMetrics := range podMetricsList.Items {
		for _, container := range podMetrics.Containers {
			totalCPU += container.Usage.Cpu().MilliValue()
			totalMemory += container.Usage.Memory().Value()
		}
	}

	return &NamespaceMetrics{
		Namespace:   namespace,
		PodCount:    len(podMetricsList.Items),
		TotalCPU:    fmt.Sprintf("%dm", totalCPU),
		TotalMemory: fmt.Sprintf("%dMi", totalMemory/(1024*1024)),
	}, nil
}
