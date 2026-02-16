package rest

import (
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/kubilitics/kubilitics-backend/internal/pkg/validate"
	"k8s.io/client-go/tools/clientcmd"
)

type shellStatusResponse struct {
	ClusterID     string `json:"clusterId"`
	ClusterName   string `json:"clusterName"`
	Context       string `json:"context"`
	Namespace     string `json:"namespace"`
	KCLIAvailable bool   `json:"kcliAvailable"`
	AIEnabled     bool   `json:"aiEnabled"`
}

// GetShellStatus handles GET /clusters/{clusterId}/shell/status.
// Returns effective shell metadata (context + default namespace) and feature availability.
func (h *Handler) GetShellStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["clusterId"]
	if !validate.ClusterID(clusterID) {
		respondError(w, http.StatusBadRequest, "Invalid clusterId")
		return
	}
	resolvedID, err := h.resolveClusterID(r.Context(), clusterID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	cluster, err := h.clusterService.GetCluster(r.Context(), resolvedID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	if cluster.KubeconfigPath == "" {
		respondError(w, http.StatusBadRequest, "Cluster has no kubeconfig path")
		return
	}

	cfg, err := clientcmd.LoadFromFile(cluster.KubeconfigPath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to read kubeconfig")
		return
	}

	contextName := strings.TrimSpace(cluster.Context)
	if contextName == "" {
		contextName = strings.TrimSpace(cfg.CurrentContext)
	}
	namespace := "default"
	if contextName != "" {
		if ctxCfg, ok := cfg.Contexts[contextName]; ok && ctxCfg != nil {
			if ns := strings.TrimSpace(ctxCfg.Namespace); ns != "" {
				namespace = ns
			}
		}
	}

	_, kcliErr := resolveKCLIBinary()
	aiEnabled := strings.TrimSpace(os.Getenv("KCLI_AI_ENDPOINT")) != ""

	respondJSON(w, http.StatusOK, shellStatusResponse{
		ClusterID:     resolvedID,
		ClusterName:   cluster.Name,
		Context:       contextName,
		Namespace:     namespace,
		KCLIAvailable: kcliErr == nil,
		AIEnabled:     aiEnabled,
	})
}

