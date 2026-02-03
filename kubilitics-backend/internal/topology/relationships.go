package topology

import (
	"context"
	"fmt"

	"github.com/kubilitics/kubilitics-backend/internal/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// RelationshipInferencer handles all relationship inference logic
type RelationshipInferencer struct {
	engine *Engine
	graph  *Graph
}

// NewRelationshipInferencer creates a new relationship inferencer
func NewRelationshipInferencer(engine *Engine, graph *Graph) *RelationshipInferencer {
	return &RelationshipInferencer{
		engine: engine,
		graph:  graph,
	}
}

// InferAllRelationships discovers all relationships between resources
func (ri *RelationshipInferencer) InferAllRelationships(ctx context.Context) error {
	// 1. Owner reference relationships (Deployment -> ReplicaSet -> Pod, etc.)
	if err := ri.inferOwnerReferences(); err != nil {
		return fmt.Errorf("failed to infer owner references: %w", err)
	}

	// 2. Label selector relationships (Service -> Pods, NetworkPolicy -> Pods)
	if err := ri.inferLabelSelectors(); err != nil {
		return fmt.Errorf("failed to infer label selectors: %w", err)
	}

	// 3. Volume relationships (Pod -> ConfigMap/Secret/PVC)
	if err := ri.inferVolumeRelationships(ctx); err != nil {
		return fmt.Errorf("failed to infer volume relationships: %w", err)
	}

	// 4. Environment variable relationships (Pod -> ConfigMap/Secret)
	if err := ri.inferEnvironmentRelationships(ctx); err != nil {
		return fmt.Errorf("failed to infer environment relationships: %w", err)
	}

	// 5. RBAC relationships (ServiceAccount -> Role/ClusterRole)
	if err := ri.inferRBACRelationships(); err != nil {
		return fmt.Errorf("failed to infer RBAC relationships: %w", err)
	}

	// 6. Network relationships (Ingress -> Service -> Endpoints -> Pods)
	if err := ri.inferNetworkRelationships(); err != nil {
		return fmt.Errorf("failed to infer network relationships: %w", err)
	}

	// 7. Storage relationships (PVC -> PV -> StorageClass)
	if err := ri.inferStorageRelationships(ctx); err != nil {
		return fmt.Errorf("failed to infer storage relationships: %w", err)
	}

	// 8. Node relationships (Pod -> Node)
	if err := ri.inferNodeRelationships(ctx); err != nil {
		return fmt.Errorf("failed to infer node relationships: %w", err)
	}

	// 9. Autoscaling relationships (HPA -> Deployment/ReplicaSet/StatefulSet)
	if err := ri.inferAutoscalingRelationships(); err != nil {
		return fmt.Errorf("failed to infer autoscaling relationships: %w", err)
	}

	// 10. Job/CronJob relationships
	if err := ri.inferJobRelationships(); err != nil {
		return fmt.Errorf("failed to infer job relationships: %w", err)
	}

	return nil
}

// inferOwnerReferences infers relationships based on OwnerReferences
func (ri *RelationshipInferencer) inferOwnerReferences() error {
	for _, node := range ri.graph.Nodes {
		// Get actual K8s object to access OwnerReferences
		if node.Metadata == nil {
			continue
		}

		ownerRefs, ok := node.Metadata["ownerReferences"].([]interface{})
		if !ok {
			continue
		}

		for _, ownerRef := range ownerRefs {
			ref, ok := ownerRef.(map[string]interface{})
			if !ok {
				continue
			}

			ownerUID, ok := ref["uid"].(string)
			if !ok {
				continue
			}

			ownerNode := ri.graph.GetNode(ownerUID)
			if ownerNode != nil {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-owner", ownerUID, node.ID),
					Source: ownerUID,
					Target: node.ID,
					Type:   "owner",
					Label:  "owns",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	return nil
}

// inferLabelSelectors infers relationships based on label selectors
func (ri *RelationshipInferencer) inferLabelSelectors() error {
	// Service -> Pods
	services := ri.graph.GetNodesByType("Service")
	pods := ri.graph.GetNodesByType("Pod")

	for _, service := range services {
		svcLabels := service.Labels
		if svcLabels == nil || len(svcLabels) == 0 {
			continue
		}

		for _, pod := range pods {
			// Check if pod is in same namespace
			if service.Namespace != pod.Namespace {
				continue
			}

			// Check if pod labels match service selector
			if ri.matchesSelector(pod.Labels, svcLabels) {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-selector", service.ID, pod.ID),
					Source: service.ID,
					Target: pod.ID,
					Type:   "selector",
					Label:  "targets",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	// NetworkPolicy -> Pods
	networkPolicies := ri.graph.GetNodesByType("NetworkPolicy")
	for _, np := range networkPolicies {
		npLabels := np.Labels
		if npLabels == nil {
			continue
		}

		for _, pod := range pods {
			if np.Namespace != pod.Namespace {
				continue
			}

			if ri.matchesSelector(pod.Labels, npLabels) {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-netpol", np.ID, pod.ID),
					Source: np.ID,
					Target: pod.ID,
					Type:   "network-policy",
					Label:  "applies to",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	// HPA -> Deployments/StatefulSets/ReplicaSets
	hpas := ri.graph.GetNodesByType("HorizontalPodAutoscaler")
	for _, hpa := range hpas {
		// HPA targets are in metadata
		if hpa.Metadata == nil {
			continue
		}

		scaleTargetRef, ok := hpa.Metadata["scaleTargetRef"].(map[string]interface{})
		if !ok {
			continue
		}

		targetKind, _ := scaleTargetRef["kind"].(string)
		targetName, _ := scaleTargetRef["name"].(string)

		// Find target resource
		targets := ri.graph.GetNodesByType(targetKind)
		for _, target := range targets {
			if target.Namespace == hpa.Namespace && target.Name == targetName {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-hpa", hpa.ID, target.ID),
					Source: hpa.ID,
					Target: target.ID,
					Type:   "autoscale",
					Label:  "scales",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	return nil
}

// inferVolumeRelationships infers relationships from pod volumes
func (ri *RelationshipInferencer) inferVolumeRelationships(ctx context.Context) error {
	pods := ri.graph.GetNodesByType("Pod")

	for _, pod := range pods {
		// Get full pod spec from K8s
		k8sPod, err := ri.engine.client.Clientset.CoreV1().Pods(pod.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
		if err != nil {
			// Pod might have been deleted, skip
			continue
		}

		// ConfigMap volumes
		configMaps := ri.graph.GetNodesByType("ConfigMap")
		for _, volume := range k8sPod.Spec.Volumes {
			if volume.ConfigMap != nil {
				for _, cm := range configMaps {
					if cm.Namespace == pod.Namespace && cm.Name == volume.ConfigMap.Name {
						edge := models.TopologyEdge{
							ID:     fmt.Sprintf("%s-%s-vol-cm", pod.ID, cm.ID),
							Source: pod.ID,
							Target: cm.ID,
							Type:   "volume",
							Label:  fmt.Sprintf("mounts (%s)", volume.Name),
						}
						ri.graph.AddEdge(edge)
					}
				}
			}

			// Secret volumes
			if volume.Secret != nil {
				secrets := ri.graph.GetNodesByType("Secret")
				for _, secret := range secrets {
					if secret.Namespace == pod.Namespace && secret.Name == volume.Secret.SecretName {
						edge := models.TopologyEdge{
							ID:     fmt.Sprintf("%s-%s-vol-secret", pod.ID, secret.ID),
							Source: pod.ID,
							Target: secret.ID,
							Type:   "volume",
							Label:  fmt.Sprintf("mounts (%s)", volume.Name),
						}
						ri.graph.AddEdge(edge)
					}
				}
			}

			// PVC volumes
			if volume.PersistentVolumeClaim != nil {
				pvcs := ri.graph.GetNodesByType("PersistentVolumeClaim")
				for _, pvc := range pvcs {
					if pvc.Namespace == pod.Namespace && pvc.Name == volume.PersistentVolumeClaim.ClaimName {
						edge := models.TopologyEdge{
							ID:     fmt.Sprintf("%s-%s-vol-pvc", pod.ID, pvc.ID),
							Source: pod.ID,
							Target: pvc.ID,
							Type:   "volume",
							Label:  fmt.Sprintf("claims (%s)", volume.Name),
						}
						ri.graph.AddEdge(edge)
					}
				}
			}
		}
	}

	return nil
}

// inferEnvironmentRelationships infers relationships from environment variables
func (ri *RelationshipInferencer) inferEnvironmentRelationships(ctx context.Context) error {
	pods := ri.graph.GetNodesByType("Pod")

	for _, pod := range pods {
		k8sPod, err := ri.engine.client.Clientset.CoreV1().Pods(pod.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		configMaps := ri.graph.GetNodesByType("ConfigMap")
		secrets := ri.graph.GetNodesByType("Secret")

		for _, container := range k8sPod.Spec.Containers {
			// Check envFrom
			for _, envFrom := range container.EnvFrom {
				if envFrom.ConfigMapRef != nil {
					for _, cm := range configMaps {
						if cm.Namespace == pod.Namespace && cm.Name == envFrom.ConfigMapRef.Name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-env-cm", pod.ID, cm.ID),
								Source: pod.ID,
								Target: cm.ID,
								Type:   "env",
								Label:  "reads env from",
							}
							ri.graph.AddEdge(edge)
						}
					}
				}

				if envFrom.SecretRef != nil {
					for _, secret := range secrets {
						if secret.Namespace == pod.Namespace && secret.Name == envFrom.SecretRef.Name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-env-secret", pod.ID, secret.ID),
								Source: pod.ID,
								Target: secret.ID,
								Type:   "env",
								Label:  "reads env from",
							}
							ri.graph.AddEdge(edge)
						}
					}
				}
			}

			// Check individual env vars
			for _, env := range container.Env {
				if env.ValueFrom != nil {
					if env.ValueFrom.ConfigMapKeyRef != nil {
						for _, cm := range configMaps {
							if cm.Namespace == pod.Namespace && cm.Name == env.ValueFrom.ConfigMapKeyRef.Name {
								edge := models.TopologyEdge{
									ID:     fmt.Sprintf("%s-%s-env-cm-%s", pod.ID, cm.ID, env.Name),
									Source: pod.ID,
									Target: cm.ID,
									Type:   "env",
									Label:  fmt.Sprintf("reads %s", env.Name),
								}
								ri.graph.AddEdge(edge)
							}
						}
					}

					if env.ValueFrom.SecretKeyRef != nil {
						for _, secret := range secrets {
							if secret.Namespace == pod.Namespace && secret.Name == env.ValueFrom.SecretKeyRef.Name {
								edge := models.TopologyEdge{
									ID:     fmt.Sprintf("%s-%s-env-secret-%s", pod.ID, secret.ID, env.Name),
									Source: pod.ID,
									Target: secret.ID,
									Type:   "env",
									Label:  fmt.Sprintf("reads %s", env.Name),
								}
								ri.graph.AddEdge(edge)
							}
						}
					}
				}
			}
		}
	}

	return nil
}

// inferRBACRelationships infers RBAC relationships
func (ri *RelationshipInferencer) inferRBACRelationships() error {
	// ServiceAccount -> Pod
	pods := ri.graph.GetNodesByType("Pod")
	serviceAccounts := ri.graph.GetNodesByType("ServiceAccount")

	for _, pod := range pods {
		// Pod has serviceAccountName in spec
		if pod.Metadata == nil {
			continue
		}

		// Find matching ServiceAccount
		for _, sa := range serviceAccounts {
			if sa.Namespace == pod.Namespace && sa.Name == pod.Name {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-sa", pod.ID, sa.ID),
					Source: pod.ID,
					Target: sa.ID,
					Type:   "rbac",
					Label:  "uses",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	// RoleBinding -> Role + ServiceAccount
	roleBindings := ri.graph.GetNodesByType("RoleBinding")
	roles := ri.graph.GetNodesByType("Role")

	for _, rb := range roleBindings {
		if rb.Metadata == nil {
			continue
		}

		// RoleBinding -> Role
		roleRef, ok := rb.Metadata["roleRef"].(map[string]interface{})
		if ok {
			roleName, _ := roleRef["name"].(string)
			for _, role := range roles {
				if role.Namespace == rb.Namespace && role.Name == roleName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-role", rb.ID, role.ID),
						Source: rb.ID,
						Target: role.ID,
						Type:   "rbac",
						Label:  "grants",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}

		// RoleBinding -> ServiceAccounts
		subjects, ok := metadata["subjects"].([]interface{})
		if ok {
			for _, subj := range subjects {
				subject, ok := subj.(map[string]interface{})
				if !ok {
					continue
				}

				kind, _ := subject["kind"].(string)
				name, _ := subject["name"].(string)
				namespace, _ := subject["namespace"].(string)

				if kind == "ServiceAccount" {
					for _, sa := range serviceAccounts {
						if sa.Namespace == namespace && sa.Name == name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-subject", rb.ID, sa.ID),
								Source: rb.ID,
								Target: sa.ID,
								Type:   "rbac",
								Label:  "binds to",
							}
							ri.graph.AddEdge(edge)
						}
					}
				}
			}
		}
	}

	// ClusterRoleBinding -> ClusterRole + ServiceAccount (similar logic)
	clusterRoleBindings := ri.graph.GetNodesByType("ClusterRoleBinding")
	clusterRoles := ri.graph.GetNodesByType("ClusterRole")

	for _, crb := range clusterRoleBindings {
		if crb.Metadata == nil {
			continue
		}

		// ClusterRoleBinding -> ClusterRole
		roleRef, ok := crb.Metadata["roleRef"].(map[string]interface{})
		if ok {
			roleName, _ := roleRef["name"].(string)
			for _, role := range clusterRoles {
				if role.Name == roleName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-crole", crb.ID, role.ID),
						Source: crb.ID,
						Target: role.ID,
						Type:   "rbac",
						Label:  "grants",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}

		// ClusterRoleBinding -> ServiceAccounts
		subjects, ok := metadata["subjects"].([]interface{})
		if ok {
			for _, subj := range subjects {
				subject, ok := subj.(map[string]interface{})
				if !ok {
					continue
				}

				kind, _ := subject["kind"].(string)
				name, _ := subject["name"].(string)
				namespace, _ := subject["namespace"].(string)

				if kind == "ServiceAccount" {
					for _, sa := range serviceAccounts {
						if sa.Namespace == namespace && sa.Name == name {
							edge := models.TopologyEdge{
								ID:     fmt.Sprintf("%s-%s-csubject", crb.ID, sa.ID),
								Source: crb.ID,
								Target: sa.ID,
								Type:   "rbac",
								Label:  "binds to",
							}
							ri.graph.AddEdge(edge)
						}
					}
				}
			}
		}
	}

	return nil
}

// inferNetworkRelationships infers network-related relationships
func (ri *RelationshipInferencer) inferNetworkRelationships() error {
	// Ingress -> Service
	ingresses := ri.graph.GetNodesByType("Ingress")
	services := ri.graph.GetNodesByType("Service")

	for _, ingress := range ingresses {
		if ingress.Metadata == nil {
			continue
		}

		spec, ok := ingress.Metadata["spec"].(map[string]interface{})
		if !ok {
			continue
		}

		rules, ok := spec["rules"].([]interface{})
		if !ok {
			continue
		}

		for _, rule := range rules {
			ruleMap, ok := rule.(map[string]interface{})
			if !ok {
				continue
			}

			http, ok := ruleMap["http"].(map[string]interface{})
			if !ok {
				continue
			}

			paths, ok := http["paths"].([]interface{})
			if !ok {
				continue
			}

			for _, path := range paths {
				pathMap, ok := path.(map[string]interface{})
				if !ok {
					continue
				}

				backend, ok := pathMap["backend"].(map[string]interface{})
				if !ok {
					continue
				}

				service, ok := backend["service"].(map[string]interface{})
				if !ok {
					continue
				}

				serviceName, _ := service["name"].(string)

				// Find service
				for _, svc := range services {
					if svc.Namespace == ingress.Namespace && svc.Name == serviceName {
						edge := models.TopologyEdge{
							ID:     fmt.Sprintf("%s-%s-ingress", ingress.ID, svc.ID),
							Source: ingress.ID,
							Target: svc.ID,
							Type:   "network",
							Label:  "routes to",
						}
						ri.graph.AddEdge(edge)
					}
				}
			}
		}
	}

	// Service -> Endpoints
	endpoints := ri.graph.GetNodesByType("Endpoints")
	for _, svc := range services {
		for _, ep := range endpoints {
			if svc.Namespace == ep.Namespace && svc.Name == ep.Name {
				edge := models.TopologyEdge{
					ID:     fmt.Sprintf("%s-%s-endpoints", svc.ID, ep.ID),
					Source: svc.ID,
					Target: ep.ID,
					Type:   "network",
					Label:  "exposes",
				}
				ri.graph.AddEdge(edge)
			}
		}
	}

	return nil
}

// inferStorageRelationships infers storage relationships
func (ri *RelationshipInferencer) inferStorageRelationships(ctx context.Context) error {
	// PVC -> PV
	pvcs := ri.graph.GetNodesByType("PersistentVolumeClaim")
	pvs := ri.graph.GetNodesByType("PersistentVolume")

	for _, pvc := range pvcs {
		// Get actual PVC to access volumeName
		k8sPVC, err := ri.engine.client.Clientset.CoreV1().PersistentVolumeClaims(pvc.Namespace).Get(ctx, pvc.Name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		if k8sPVC.Spec.VolumeName != "" {
			for _, pv := range pvs {
				if pv.Name == k8sPVC.Spec.VolumeName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-pv", pvc.ID, pv.ID),
						Source: pvc.ID,
						Target: pv.ID,
						Type:   "storage",
						Label:  "bound to",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}

		// PVC -> StorageClass
		if k8sPVC.Spec.StorageClassName != nil {
			storageClasses := ri.graph.GetNodesByType("StorageClass")
			for _, sc := range storageClasses {
				if sc.Name == *k8sPVC.Spec.StorageClassName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-sc", pvc.ID, sc.ID),
						Source: pvc.ID,
						Target: sc.ID,
						Type:   "storage",
						Label:  "uses",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}
	}

	// PV -> StorageClass
	for _, pv := range pvs {
		k8sPV, err := ri.engine.client.Clientset.CoreV1().PersistentVolumes().Get(ctx, pv.Name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		if k8sPV.Spec.StorageClassName != "" {
			storageClasses := ri.graph.GetNodesByType("StorageClass")
			for _, sc := range storageClasses {
				if sc.Name == k8sPV.Spec.StorageClassName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-sc", pv.ID, sc.ID),
						Source: pv.ID,
						Target: sc.ID,
						Type:   "storage",
						Label:  "uses",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}
	}

	return nil
}

// inferNodeRelationships infers node-related relationships
func (ri *RelationshipInferencer) inferNodeRelationships(ctx context.Context) error {
	pods := ri.graph.GetNodesByType("Pod")
	nodes := ri.graph.GetNodesByType("Node")

	for _, pod := range pods {
		k8sPod, err := ri.engine.client.Clientset.CoreV1().Pods(pod.Namespace).Get(ctx, pod.Name, metav1.GetOptions{})
		if err != nil {
			continue
		}

		if k8sPod.Spec.NodeName != "" {
			for _, node := range nodes {
				if node.Name == k8sPod.Spec.NodeName {
					edge := models.TopologyEdge{
						ID:     fmt.Sprintf("%s-%s-node", pod.ID, node.ID),
						Source: node.ID,
						Target: pod.ID,
						Type:   "placement",
						Label:  "runs on",
					}
					ri.graph.AddEdge(edge)
				}
			}
		}
	}

	return nil
}

// inferAutoscalingRelationships infers autoscaling relationships
func (ri *RelationshipInferencer) inferAutoscalingRelationships() error {
	// Already handled in inferLabelSelectors for HPAs
	// Add VPA relationships if needed in the future
	return nil
}

// inferJobRelationships infers job and cronjob relationships
func (ri *RelationshipInferencer) inferJobRelationships() error {
	// CronJob -> Job already handled by owner references
	// Job -> Pod already handled by owner references
	return nil
}

// matchesSelector checks if labels match a selector
func (ri *RelationshipInferencer) matchesSelector(podLabels, selector map[string]string) bool {
	if len(selector) == 0 {
		return false
	}

	for key, value := range selector {
		if podLabels[key] != value {
			return false
		}
	}

	return true
}
