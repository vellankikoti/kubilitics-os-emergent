package k8s

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Client wraps Kubernetes client-go
type Client struct {
	Clientset      *kubernetes.Clientset
	Config         *rest.Config
	Context        string
	kubeconfigPath string
}

// NewClient creates a new Kubernetes client
func NewClient(kubeconfigPath, context string) (*Client, error) {
	var config *rest.Config
	var err error

	if kubeconfigPath == "" {
		// Try in-cluster config first
		config, err = rest.InClusterConfig()
		if err != nil {
			// Fall back to default kubeconfig
			homeDir, _ := os.UserHomeDir()
			if homeDir != "" {
				kubeconfigPath = filepath.Join(homeDir, ".kube", "config")
			}
		}
	}

	if config == nil {
		config, err = buildConfigFromFlags(context, kubeconfigPath)
		if err != nil {
			return nil, fmt.Errorf("failed to build config: %w", err)
		}
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create clientset: %w", err)
	}

	return &Client{
		Clientset:      clientset,
		Config:         config,
		Context:        context,
		kubeconfigPath: kubeconfigPath,
	}, nil
}

func buildConfigFromFlags(context, kubeconfigPath string) (*rest.Config, error) {
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(
		&clientcmd.ClientConfigLoadingRules{ExplicitPath: kubeconfigPath},
		&clientcmd.ConfigOverrides{
			CurrentContext: context,
		}).ClientConfig()
}

// GetServerVersion returns Kubernetes server version
func (c *Client) GetServerVersion(ctx context.Context) (string, error) {
	version, err := c.Clientset.Discovery().ServerVersion()
	if err != nil {
		return "", err
	}
	return version.GitVersion, nil
}

// TestConnection verifies connectivity to the cluster
func (c *Client) TestConnection(ctx context.Context) error {
	_, err := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	return err
}

// GetClusterInfo returns basic cluster information
func (c *Client) GetClusterInfo(ctx context.Context) (map[string]interface{}, error) {
	version, err := c.GetServerVersion(ctx)
	if err != nil {
		return nil, err
	}

	nodes, err := c.Clientset.CoreV1().Nodes().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	namespaces, err := c.Clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"version":         version,
		"node_count":      len(nodes.Items),
		"namespace_count": len(namespaces.Items),
		"server_url":      c.Config.Host,
	}, nil
}
