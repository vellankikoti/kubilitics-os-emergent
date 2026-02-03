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
	inferencer := NewRelationshipInferencer(e, graph)
	if err := inferencer.InferAllRelationships(ctx); err != nil {
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

	// Core resources
	if err := e.discoverPods(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverServices(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverConfigMaps(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverSecrets(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverNodes(ctx, graph); err != nil {
		return err
	}
	if err := e.discoverNamespaces(ctx, graph); err != nil {
		return err
	}
	if err := e.discoverPersistentVolumes(ctx, graph); err != nil {
		return err
	}
	if err := e.discoverPersistentVolumeClaims(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverServiceAccounts(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverEndpoints(ctx, graph, namespace); err != nil {
		return err
	}

	// Apps resources
	if err := e.discoverDeployments(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverReplicaSets(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverStatefulSets(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverDaemonSets(ctx, graph, namespace); err != nil {
		return err
	}

	// Batch resources
	if err := e.discoverJobs(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverCronJobs(ctx, graph, namespace); err != nil {
		return err
	}

	// Networking resources
	if err := e.discoverIngresses(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverNetworkPolicies(ctx, graph, namespace); err != nil {
		return err
	}

	// RBAC resources
	if err := e.discoverRoles(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverRoleBindings(ctx, graph, namespace); err != nil {
		return err
	}
	if err := e.discoverClusterRoles(ctx, graph); err != nil {
		return err
	}
	if err := e.discoverClusterRoleBindings(ctx, graph); err != nil {
		return err
	}

	// Storage resources
	if err := e.discoverStorageClasses(ctx, graph); err != nil {
		return err
	}

	// Autoscaling resources
	if err := e.discoverHorizontalPodAutoscalers(ctx, graph, namespace); err != nil {
		return err
	}

	// Policy resources
	if err := e.discoverPodDisruptionBudgets(ctx, graph, namespace); err != nil {
		return err
	}

	return nil
}

func (e *Engine) discoverPods(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(pod.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverServices(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(svc.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverDeployments(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(deploy.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverReplicaSets(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(rs.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverStatefulSets(ctx context.Context, graph *Graph, namespace string) error {
	statefulSets, err := e.client.Clientset.AppsV1().StatefulSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list statefulsets: %w", err)
	}
	for _, sts := range statefulSets.Items {
		node := models.TopologyNode{
			ID:          string(sts.UID),
			Type:        "StatefulSet",
			Namespace:   sts.Namespace,
			Name:        sts.Name,
			Status:      "Active",
			Labels:      sts.Labels,
			Annotations: sts.Annotations,
			Metadata:    convertToMap(sts.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverDaemonSets(ctx context.Context, graph *Graph, namespace string) error {
	daemonSets, err := e.client.Clientset.AppsV1().DaemonSets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list daemonsets: %w", err)
	}
	for _, ds := range daemonSets.Items {
		node := models.TopologyNode{
			ID:          string(ds.UID),
			Type:        "DaemonSet",
			Namespace:   ds.Namespace,
			Name:        ds.Name,
			Status:      "Active",
			Labels:      ds.Labels,
			Annotations: ds.Annotations,
			Metadata:    convertToMap(ds.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverJobs(ctx context.Context, graph *Graph, namespace string) error {
	jobs, err := e.client.Clientset.BatchV1().Jobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list jobs: %w", err)
	}
	for _, job := range jobs.Items {
		node := models.TopologyNode{
			ID:          string(job.UID),
			Type:        "Job",
			Namespace:   job.Namespace,
			Name:        job.Name,
			Status:      "Active",
			Labels:      job.Labels,
			Annotations: job.Annotations,
			Metadata:    convertToMap(job.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverCronJobs(ctx context.Context, graph *Graph, namespace string) error {
	cronJobs, err := e.client.Clientset.BatchV1().CronJobs(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list cronjobs: %w", err)
	}
	for _, cj := range cronJobs.Items {
		node := models.TopologyNode{
			ID:          string(cj.UID),
			Type:        "CronJob",
			Namespace:   cj.Namespace,
			Name:        cj.Name,
			Status:      "Active",
			Labels:      cj.Labels,
			Annotations: cj.Annotations,
			Metadata:    convertToMap(cj.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverConfigMaps(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(cm.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverSecrets(ctx context.Context, graph *Graph, namespace string) error {
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
			Metadata:    convertToMap(secret.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverNodes(ctx context.Context, graph *Graph) error {
	nodes, err := e.client.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list nodes: %w", err)
	}
	for _, node := range nodes.Items {
		status := "Ready"
		for _, cond := range node.Status.Conditions {
			if cond.Type == "Ready" && cond.Status != "True" {
				status = "NotReady"
			}
		}
		graphNode := models.TopologyNode{
			ID:          string(node.UID),
			Type:        "Node",
			Name:        node.Name,
			Status:      status,
			Labels:      node.Labels,
			Annotations: node.Annotations,
			Metadata:    convertToMap(node.ObjectMeta),
		}
		graph.AddNode(graphNode)
	}
	return nil
}

func (e *Engine) discoverNamespaces(ctx context.Context, graph *Graph) error {
	namespaces, err := e.client.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list namespaces: %w", err)
	}
	for _, ns := range namespaces.Items {
		node := models.TopologyNode{
			ID:          string(ns.UID),
			Type:        "Namespace",
			Name:        ns.Name,
			Status:      string(ns.Status.Phase),
			Labels:      ns.Labels,
			Annotations: ns.Annotations,
			Metadata:    convertToMap(ns.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverPersistentVolumes(ctx context.Context, graph *Graph) error {
	pvs, err := e.client.Clientset.CoreV1().PersistentVolumes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list persistent volumes: %w", err)
	}
	for _, pv := range pvs.Items {
		node := models.TopologyNode{
			ID:          string(pv.UID),
			Type:        "PersistentVolume",
			Name:        pv.Name,
			Status:      string(pv.Status.Phase),
			Labels:      pv.Labels,
			Annotations: pv.Annotations,
			Metadata:    convertToMap(pv.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverPersistentVolumeClaims(ctx context.Context, graph *Graph, namespace string) error {
	pvcs, err := e.client.Clientset.CoreV1().PersistentVolumeClaims(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list persistent volume claims: %w", err)
	}
	for _, pvc := range pvcs.Items {
		node := models.TopologyNode{
			ID:          string(pvc.UID),
			Type:        "PersistentVolumeClaim",
			Namespace:   pvc.Namespace,
			Name:        pvc.Name,
			Status:      string(pvc.Status.Phase),
			Labels:      pvc.Labels,
			Annotations: pvc.Annotations,
			Metadata:    convertToMap(pvc.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverServiceAccounts(ctx context.Context, graph *Graph, namespace string) error {
	sas, err := e.client.Clientset.CoreV1().ServiceAccounts(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list service accounts: %w", err)
	}
	for _, sa := range sas.Items {
		node := models.TopologyNode{
			ID:          string(sa.UID),
			Type:        "ServiceAccount",
			Namespace:   sa.Namespace,
			Name:        sa.Name,
			Status:      "Active",
			Labels:      sa.Labels,
			Annotations: sa.Annotations,
			Metadata:    convertToMap(sa.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverEndpoints(ctx context.Context, graph *Graph, namespace string) error {
	endpoints, err := e.client.Clientset.CoreV1().Endpoints(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list endpoints: %w", err)
	}
	for _, ep := range endpoints.Items {
		node := models.TopologyNode{
			ID:          string(ep.UID),
			Type:        "Endpoints",
			Namespace:   ep.Namespace,
			Name:        ep.Name,
			Status:      "Active",
			Labels:      ep.Labels,
			Annotations: ep.Annotations,
			Metadata:    convertToMap(ep.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverIngresses(ctx context.Context, graph *Graph, namespace string) error {
	ingresses, err := e.client.Clientset.NetworkingV1().Ingresses(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list ingresses: %w", err)
	}
	for _, ing := range ingresses.Items {
		node := models.TopologyNode{
			ID:          string(ing.UID),
			Type:        "Ingress",
			Namespace:   ing.Namespace,
			Name:        ing.Name,
			Status:      "Active",
			Labels:      ing.Labels,
			Annotations: ing.Annotations,
			Metadata:    convertToMap(ing.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverNetworkPolicies(ctx context.Context, graph *Graph, namespace string) error {
	nps, err := e.client.Clientset.NetworkingV1().NetworkPolicies(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list network policies: %w", err)
	}
	for _, np := range nps.Items {
		node := models.TopologyNode{
			ID:          string(np.UID),
			Type:        "NetworkPolicy",
			Namespace:   np.Namespace,
			Name:        np.Name,
			Status:      "Active",
			Labels:      np.Labels,
			Annotations: np.Annotations,
			Metadata:    convertToMap(np.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverRoles(ctx context.Context, graph *Graph, namespace string) error {
	roles, err := e.client.Clientset.RbacV1().Roles(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list roles: %w", err)
	}
	for _, role := range roles.Items {
		node := models.TopologyNode{
			ID:          string(role.UID),
			Type:        "Role",
			Namespace:   role.Namespace,
			Name:        role.Name,
			Status:      "Active",
			Labels:      role.Labels,
			Annotations: role.Annotations,
			Metadata:    convertToMap(role.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverRoleBindings(ctx context.Context, graph *Graph, namespace string) error {
	rbs, err := e.client.Clientset.RbacV1().RoleBindings(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list role bindings: %w", err)
	}
	for _, rb := range rbs.Items {
		node := models.TopologyNode{
			ID:          string(rb.UID),
			Type:        "RoleBinding",
			Namespace:   rb.Namespace,
			Name:        rb.Name,
			Status:      "Active",
			Labels:      rb.Labels,
			Annotations: rb.Annotations,
			Metadata:    convertToMap(rb.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverClusterRoles(ctx context.Context, graph *Graph) error {
	crs, err := e.client.Clientset.RbacV1().ClusterRoles().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list cluster roles: %w", err)
	}
	for _, cr := range crs.Items {
		node := models.TopologyNode{
			ID:          string(cr.UID),
			Type:        "ClusterRole",
			Name:        cr.Name,
			Status:      "Active",
			Labels:      cr.Labels,
			Annotations: cr.Annotations,
			Metadata:    convertToMap(cr.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverClusterRoleBindings(ctx context.Context, graph *Graph) error {
	crbs, err := e.client.Clientset.RbacV1().ClusterRoleBindings().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list cluster role bindings: %w", err)
	}
	for _, crb := range crbs.Items {
		node := models.TopologyNode{
			ID:          string(crb.UID),
			Type:        "ClusterRoleBinding",
			Name:        crb.Name,
			Status:      "Active",
			Labels:      crb.Labels,
			Annotations: crb.Annotations,
			Metadata:    convertToMap(crb.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverStorageClasses(ctx context.Context, graph *Graph) error {
	scs, err := e.client.Clientset.StorageV1().StorageClasses().List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list storage classes: %w", err)
	}
	for _, sc := range scs.Items {
		node := models.TopologyNode{
			ID:          string(sc.UID),
			Type:        "StorageClass",
			Name:        sc.Name,
			Status:      "Active",
			Labels:      sc.Labels,
			Annotations: sc.Annotations,
			Metadata:    convertToMap(sc.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverHorizontalPodAutoscalers(ctx context.Context, graph *Graph, namespace string) error {
	hpas, err := e.client.Clientset.AutoscalingV2().HorizontalPodAutoscalers(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list horizontal pod autoscalers: %w", err)
	}
	for _, hpa := range hpas.Items {
		node := models.TopologyNode{
			ID:          string(hpa.UID),
			Type:        "HorizontalPodAutoscaler",
			Namespace:   hpa.Namespace,
			Name:        hpa.Name,
			Status:      "Active",
			Labels:      hpa.Labels,
			Annotations: hpa.Annotations,
			Metadata:    convertToMap(hpa.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

func (e *Engine) discoverPodDisruptionBudgets(ctx context.Context, graph *Graph, namespace string) error {
	pdbs, err := e.client.Clientset.PolicyV1().PodDisruptionBudgets(namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return fmt.Errorf("failed to list pod disruption budgets: %w", err)
	}
	for _, pdb := range pdbs.Items {
		node := models.TopologyNode{
			ID:          string(pdb.UID),
			Type:        "PodDisruptionBudget",
			Namespace:   pdb.Namespace,
			Name:        pdb.Name,
			Status:      "Active",
			Labels:      pdb.Labels,
			Annotations: pdb.Annotations,
			Metadata:    convertToMap(pdb.ObjectMeta),
		}
		graph.AddNode(node)
	}
	return nil
}

// convertToMap converts ObjectMeta to map for storage
func convertToMap(meta metav1.ObjectMeta) map[string]interface{} {
	result := make(map[string]interface{})
	
	if len(meta.OwnerReferences) > 0 {
		owners := make([]map[string]interface{}, len(meta.OwnerReferences))
		for i, owner := range meta.OwnerReferences {
			owners[i] = map[string]interface{}{
				"kind": owner.Kind,
				"name": owner.Name,
				"uid":  string(owner.UID),
			}
		}
		result["ownerReferences"] = owners
	}
	
	return result
}