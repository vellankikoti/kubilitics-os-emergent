package k8s

import (
	"context"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
)

// NormalizeKindToResource converts API kind (e.g. "Pod", "Pods", "pod") to lowercase plural for GVR lookup.
func NormalizeKindToResource(kind string) string {
	s := strings.ToLower(strings.TrimSpace(kind))
	if s == "" {
		return s
	}
	// GetGVRForType expects plural lowercase: pods, services, etc.
	if _, err := GetGVRForType(s); err == nil {
		return s
	}
	if !strings.HasSuffix(s, "s") {
		return s + "s"
	}
	return s
}

// ListResources lists resources of the given kind in the cluster (optionally filtered by namespace).
// kind is normalized to resource type (e.g. "Pod" -> "pods"). Uses timeout and retry (5xx/429). Returns 404/403 from K8s as-is.
func (c *Client) ListResources(ctx context.Context, kind, namespace string, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	if err := c.waitRateLimit(ctx); err != nil {
		return nil, err
	}
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resourceType := NormalizeKindToResource(kind)
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return nil, err
	}

	return doWithRetryValue(ctx, defaultRetryAttempts, func() (*unstructured.UnstructuredList, error) {
		if namespace != "" {
			return c.Dynamic.Resource(gvr).Namespace(namespace).List(ctx, opts)
		}
		return c.Dynamic.Resource(gvr).List(ctx, opts)
	})
}

// GetResource returns a single resource by kind, namespace, and name (with timeout and retry).
func (c *Client) GetResource(ctx context.Context, kind, namespace, name string) (*unstructured.Unstructured, error) {
	if err := c.waitRateLimit(ctx); err != nil {
		return nil, err
	}
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resourceType := NormalizeKindToResource(kind)
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return nil, err
	}

	return doWithRetryValue(ctx, defaultRetryAttempts, func() (*unstructured.Unstructured, error) {
		if namespace != "" {
			return c.Dynamic.Resource(gvr).Namespace(namespace).Get(ctx, name, metav1.GetOptions{})
		}
		return c.Dynamic.Resource(gvr).Get(ctx, name, metav1.GetOptions{})
	})
}

// DeleteResource deletes a single resource by kind, namespace, and name (with timeout and retry).
func (c *Client) DeleteResource(ctx context.Context, kind, namespace, name string, opts metav1.DeleteOptions) error {
	if err := c.waitRateLimit(ctx); err != nil {
		return err
	}
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resourceType := NormalizeKindToResource(kind)
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return err
	}
	return doWithRetry(ctx, defaultRetryAttempts, func() error {
		if namespace != "" {
			return c.Dynamic.Resource(gvr).Namespace(namespace).Delete(ctx, name, opts)
		}
		return c.Dynamic.Resource(gvr).Delete(ctx, name, opts)
	})
}

// PatchResource patches a single resource by kind, namespace, and name using JSON merge patch.
func (c *Client) PatchResource(ctx context.Context, kind, namespace, name string, patch []byte) (*unstructured.Unstructured, error) {
	if err := c.waitRateLimit(ctx); err != nil {
		return nil, err
	}
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resourceType := NormalizeKindToResource(kind)
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return nil, err
	}

	return doWithRetryValue(ctx, defaultRetryAttempts, func() (*unstructured.Unstructured, error) {
		if namespace != "" {
			return c.Dynamic.Resource(gvr).Namespace(namespace).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
		}
		return c.Dynamic.Resource(gvr).Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{})
	})
}

// CreateResource creates a resource from an unstructured object. The object must have apiVersion, kind, and metadata (namespace for namespaced resources). Uses timeout and retry.
func (c *Client) CreateResource(ctx context.Context, obj *unstructured.Unstructured) (*unstructured.Unstructured, error) {
	if err := c.waitRateLimit(ctx); err != nil {
		return nil, err
	}
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	namespace := obj.GetNamespace()
	resourceType := NormalizeKindToResource(obj.GetKind())
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return nil, err
	}
	// Jobs are namespaced; ensure namespace is set
	if namespace == "" {
		namespace = "default"
	}

	return doWithRetryValue(ctx, defaultRetryAttempts, func() (*unstructured.Unstructured, error) {
		return c.Dynamic.Resource(gvr).Namespace(namespace).Create(ctx, obj, metav1.CreateOptions{})
	})
}

// IsNamespaced returns whether the given kind is typically namespaced (for validation).
func IsNamespaced(kind string) bool {
	resourceType := NormalizeKindToResource(kind)
	gvr, err := GetGVRForType(resourceType)
	if err != nil {
		return true // default to namespaced
	}
	// Cluster-scoped: nodes, namespaces, persistentvolumes, storageclasses, clusterroles, clusterrolebindings
	clusterScoped := map[string]bool{
		"nodes":                  true,
		"namespaces":             true,
		"persistentvolumes":      true,
		"storageclasses":         true,
		"clusterroles":           true,
		"clusterrolebindings":    true,
		"ingressclasses":         true,
	}
	_, ok := clusterScoped[gvr.Resource]
	return !ok
}
