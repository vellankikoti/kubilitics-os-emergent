package k8s

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// DiscoveredResource represents a discovered K8s resource type
type DiscoveredResource struct {
	GVR       schema.GroupVersionResource
	Kind      string
	Namespace bool // Is namespaced
}

// DiscoverAllResources discovers all available resource types in the cluster
func (c *Client) DiscoverAllResources(ctx context.Context) ([]DiscoveredResource, error) {
	apiResourceLists, err := c.Clientset.Discovery().ServerPreferredResources()
	if err != nil {
		// Partial discovery is OK, some APIs might be unavailable
		fmt.Printf("Warning: partial discovery: %v\n", err)
	}

	var resources []DiscoveredResource

	for _, apiResourceList := range apiResourceLists {
		gv, err := schema.ParseGroupVersion(apiResourceList.GroupVersion)
		if err != nil {
			continue
		}

		for _, apiResource := range apiResourceList.APIResources {
			// Skip subresources
			if len(apiResource.Name) == 0 || apiResource.Name[0] == '/' {
				continue
			}

			gvr := schema.GroupVersionResource{
				Group:    gv.Group,
				Version:  gv.Version,
				Resource: apiResource.Name,
			}

			resources = append(resources, DiscoveredResource{
				GVR:       gvr,
				Kind:      apiResource.Kind,
				Namespace: apiResource.Namespaced,
			})
		}
	}

	return resources, nil
}

// GetGVRForType returns the GroupVersionResource for a resource type
func GetGVRForType(resourceType string) (schema.GroupVersionResource, error) {
	// Core resources (no group)
	coreResources := map[string]schema.GroupVersionResource{
		"pods":                   {Group: "", Version: "v1", Resource: "pods"},
		"services":               {Group: "", Version: "v1", Resource: "services"},
		"configmaps":             {Group: "", Version: "v1", Resource: "configmaps"},
		"secrets":                {Group: "", Version: "v1", Resource: "secrets"},
		"namespaces":             {Group: "", Version: "v1", Resource: "namespaces"},
		"nodes":                  {Group: "", Version: "v1", Resource: "nodes"},
		"persistentvolumes":      {Group: "", Version: "v1", Resource: "persistentvolumes"},
		"persistentvolumeclaims": {Group: "", Version: "v1", Resource: "persistentvolumeclaims"},
		"serviceaccounts":        {Group: "", Version: "v1", Resource: "serviceaccounts"},
		"endpoints":              {Group: "", Version: "v1", Resource: "endpoints"},
	}

	// Apps resources
	appsResources := map[string]schema.GroupVersionResource{
		"deployments":  {Group: "apps", Version: "v1", Resource: "deployments"},
		"replicasets":  {Group: "apps", Version: "v1", Resource: "replicasets"},
		"statefulsets": {Group: "apps", Version: "v1", Resource: "statefulsets"},
		"daemonsets":   {Group: "apps", Version: "v1", Resource: "daemonsets"},
	}

	// Batch resources
	batchResources := map[string]schema.GroupVersionResource{
		"jobs":     {Group: "batch", Version: "v1", Resource: "jobs"},
		"cronjobs": {Group: "batch", Version: "v1", Resource: "cronjobs"},
	}

	// Networking resources
	networkResources := map[string]schema.GroupVersionResource{
		"ingresses":        {Group: "networking.k8s.io", Version: "v1", Resource: "ingresses"},
		"networkpolicies":  {Group: "networking.k8s.io", Version: "v1", Resource: "networkpolicies"},
		"ingressclasses":   {Group: "networking.k8s.io", Version: "v1", Resource: "ingressclasses"},
	}

	// RBAC resources
	rbacResources := map[string]schema.GroupVersionResource{
		"roles":               {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "roles"},
		"rolebindings":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "rolebindings"},
		"clusterroles":        {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterroles"},
		"clusterrolebindings": {Group: "rbac.authorization.k8s.io", Version: "v1", Resource: "clusterrolebindings"},
	}

	// Check all maps
	if gvr, ok := coreResources[resourceType]; ok {
		return gvr, nil
	}
	if gvr, ok := appsResources[resourceType]; ok {
		return gvr, nil
	}
	if gvr, ok := batchResources[resourceType]; ok {
		return gvr, nil
	}
	if gvr, ok := networkResources[resourceType]; ok {
		return gvr, nil
	}
	if gvr, ok := rbacResources[resourceType]; ok {
		return gvr, nil
	}

	return schema.GroupVersionResource{}, fmt.Errorf("unknown resource type: %s", resourceType)
}
