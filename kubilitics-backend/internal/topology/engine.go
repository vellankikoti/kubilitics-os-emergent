package topology

import (
	"context"
	"fmt"

	"github.com/kubilitics/kubilitics-backend/internal/k8s"
	"github.com/kubilitics/kubilitics-backend/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Engine builds topology graphs from Kubernetes resources
type Engine struct {
	client *k8s.Client
}

// NewEngine creates a new topology engine
func NewEngine(client *k8s.Client) *Engine {
	return &Engine{
		client: client,
	}
}

// BuildGraph constructs the complete topology graph
func (e *Engine) BuildGraph(ctx context.Context, filters models.TopologyFilters) (*models.TopologyGraph, error) {
	graph := NewGraph()

	// Phase 1: Discover all resources
	if err := e.discoverResources(ctx, graph, filters); err != nil {
		return nil, fmt.Errorf("resource discovery failed: %w", err)
	}

	// Phase 2: Infer relationships
	if err := e.inferRelationships(ctx, graph); err != nil {
		return nil, fmt.Errorf("relationship inference failed: %w", err)
	}

	// Phase 3: Generate deterministic layout seed
	graph.LayoutSeed = graph.GenerateLayoutSeed()

	// Phase 4: Validate graph
	if err := graph.Validate(); err != nil {
		return nil, fmt.Errorf("graph validation failed: %w", err)
	}

	topology := graph.ToTopologyGraph()
	if filters.Namespace != "" {
		topology.Meta.Namespace = filters.Namespace
	}

	return &topology, nil
}

// discoverResources discovers all K8s resources and creates nodes
func (e *Engine) discoverResources(ctx context.Context, graph *Graph, filters models.TopologyFilters) error {
	namespace := filters.Namespace
	if namespace == "" {
		namespace = metav1.NamespaceAll
	}

	// Discover Pods
	pods, err := e.client.Clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list pods: %w", err)
	}
	for _, pod := range pods.Items {
		node := models.TopologyNode{
			ID:          string(pod.UID),
			Type:        "Pod",
			Namespace:   pod.Namespace,
			Name:        pod.Name,
			Status:      string(pod.Status.Phase),
			Labels:      pod.Labels,
			Annotations: pod.Annotations,
		}
		graph.AddNode(node)
	}

	// Discover Deployments
	deployments, err := e.client.Clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list deployments: %w", err)
	}
	for _, deploy := range deployments.Items {
		node := models.TopologyNode{
			ID:          string(deploy.UID),
			Type:        "Deployment",
			Namespace:   deploy.Namespace,
			Name:        deploy.Name,
			Status:      "Active",
			Labels:      deploy.Labels,
			Annotations: deploy.Annotations,
		}
		graph.AddNode(node)
	}

	// Discover Services
	services, err := e.client.Clientset.CoreV1().Services(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list services: %w", err)
	}
	for _, svc := range services.Items {
		node := models.TopologyNode{
			ID:          string(svc.UID),
			Type:        "Service",
			Namespace:   svc.Namespace,
			Name:        svc.Name,
			Status:      "Active",
			Labels:      svc.Labels,
			Annotations: svc.Annotations,
		}
		graph.AddNode(node)
	}

	// Discover ReplicaSets
	replicaSets, err := e.client.Clientset.AppsV1().ReplicaSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list replicasets: %w", err)
	}
	for _, rs := range replicaSets.Items {
		node := models.TopologyNode{
			ID:          string(rs.UID),
			Type:        "ReplicaSet",
			Namespace:   rs.Namespace,
			Name:        rs.Name,
			Status:      "Active",
			Labels:      rs.Labels,
			Annotations: rs.Annotations,
		}
		graph.AddNode(node)
	}

	// Discover ConfigMaps
	configMaps, err := e.client.Clientset.CoreV1().ConfigMaps(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list configmaps: %w", err)
	}
	for _, cm := range configMaps.Items {
		node := models.TopologyNode{
			ID:          string(cm.UID),
			Type:        "ConfigMap",
			Namespace:   cm.Namespace,
			Name:        cm.Name,
			Status:      "Active",
			Labels:      cm.Labels,
			Annotations: cm.Annotations,
		}
		graph.AddNode(node)
	}

	// Discover Secrets
	secrets, err := e.client.Clientset.CoreV1().Secrets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list secrets: %w", err)
	}
	for _, secret := range secrets.Items {
		node := models.TopologyNode{
			ID:          string(secret.UID),
			Type:        "Secret",
			Namespace:   secret.Namespace,
			Name:        secret.Name,
			Status:      "Active",
			Labels:      secret.Labels,
			Annotations: secret.Annotations,
		}
		graph.AddNode(node)
	}

	// TODO: Add more resource types (PVCs, Nodes, Namespaces, Ingresses, etc.)

	return nil
}

// inferRelationships discovers relationships between resources
func (e *Engine) inferRelationships(ctx context.Context, graph *Graph) error {
	// Infer Pod relationships
	for _, node := range graph.GetNodesByType("Pod") {
		if err := e.inferPodRelationships(ctx, &node, graph); err != nil {
			return err
		}
	}

	// Infer Deployment -> ReplicaSet relationships
	for _, deployment := range graph.GetNodesByType("Deployment") {
		for _, rs := range graph.GetNodesByType("ReplicaSet") {
			// Check if ReplicaSet is owned by this Deployment (via labels)
			if e.matchesSelector(rs.Labels, deployment.Labels) {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s", deployment.ID, rs.ID),
					Source: deployment.ID,
					Target: rs.ID,
					Type:   "owner",
					Label:  "owns",
				}
				graph.AddEdge(edge)
			}
		}
	}

	// Infer Service -> Pod relationships (via label selectors)
	for _, service := range graph.GetNodesByType("Service") {
		for _, pod := range graph.GetNodesByType("Pod") {
			if service.Namespace == pod.Namespace && e.matchesSelector(pod.Labels, service.Labels) {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s", service.ID, pod.ID),
					Source: service.ID,
					Target: pod.ID,
					Type:   "selector",
					Label:  "targets",
				}
				graph.AddEdge(edge)
			}
		}
	}

	return nil
}

// inferPodRelationships infers all relationships for a Pod
func (e *Engine) inferPodRelationships(ctx context.Context, pod *models.TopologyNode, graph *Graph) error {
	// Get actual Pod from K8s to access full spec
	k8sPod, err := e.client.Clientset.CoreV1().Pods(pod.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
	if err != nil {
		return err
	}

	// ReplicaSet -> Pod ownership
	for _, owner := range k8sPod.OwnerReferences {
		ownerNode := graph.GetNode(string(owner.UID))
		if ownerNode != nil {
			edge := models.TopologyEdge{
				ID:     fmt.Sprintf("%s-%s", owner.UID, pod.ID),
				Source: string(owner.UID),
				Target: pod.ID,
				Type:   "owner",
				Label:  "owns",
			}
			graph.AddEdge(edge)
		}
	}

	// Pod -> ConfigMap/Secret volume relationships
	for _, volume := range k8sPod.Spec.Volumes {
		if volume.ConfigMap != nil {
			// Find ConfigMap node
			for _, cm := range graph.GetNodesByType("ConfigMap") {
				if cm.Namespace == pod.Namespace && cm.Name == volume.ConfigMap.Name {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-vol", pod.ID, cm.ID),
						Source: pod.ID,
						Target: cm.ID,
						Type:   "volume",
						Label:  "mounts",
					}
					graph.AddEdge(edge)
				}
			}
		}

		if volume.Secret != nil {
			// Find Secret node
			for _, secret := range graph.GetNodesByType("Secret") {
				if secret.Namespace == pod.Namespace && secret.Name == volume.Secret.SecretName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-vol", pod.ID, secret.ID),
						Source: pod.ID,
						Target: secret.ID,
						Type:   "volume",
						Label:  "mounts",
					}
					graph.AddEdge(edge)
				}
			}
		}
	}

	// Pod -> ConfigMap/Secret env relationships
	for _, container := range k8sPod.Spec.Containers {
		for _, env := range container.Env {
			if env.ValueFrom != nil {
				if env.ValueFrom.ConfigMapKeyRef != nil {
					for _, cm := range graph.GetNodesByType("ConfigMap") {
						if cm.Namespace == pod.Namespace && cm.Name == env.ValueFrom.ConfigMapKeyRef.Name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-env", pod.ID, cm.ID),
								Source: pod.ID,
								Target: cm.ID,
								Type:   "env",
								Label:  "reads env from",
							}
							graph.AddEdge(edge)
						}
					}
				}

				if env.ValueFrom.SecretKeyRef != nil {
					for _, secret := range graph.GetNodesByType("Secret") {
						if secret.Namespace == pod.Namespace && secret.Name == env.ValueFrom.SecretKeyRef.Name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-env", pod.ID, secret.ID),
								Source: pod.ID,
								Target: secret.ID,
								Type:   "env",
								Label:  "reads env from",
							}
							graph.AddEdge(edge)
						}
					}
				}
			}
		}
	}

	return nil
}

// matchesSelector checks if labels match a selector
func (e *Engine) matchesSelector(labels map[string]string, selector map[string]string) bool {
	if len(selector) == 0 {
		return false
	}

	for key, value := range selector {
		if labels[key] != value {
			return false
		}
	}
	return true
}
