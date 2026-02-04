package rest

import (
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// GetClusterMetrics handles GET /clusters/{id}/metrics
func (h *Handler) GetClusterMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// TODO: Implement actual metrics retrieval via metrics_service
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"timestamp": time.Now(),
		"cluster_id": clusterID,
		"node_metrics": []map[string]interface{}{
			{
				"node_name":        "node-1",
				"cpu_usage":        "1200m",
				"memory_usage":     "4Gi",
				"cpu_capacity":     "4000m",
				"memory_capacity":  "16Gi",
			},
		},
	})
}

// GetPodMetrics handles GET /clusters/{id}/metrics/{namespace}/{pod}
func (h *Handler) GetPodMetrics(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	namespace := vars["namespace"]
	pod := vars["pod"]

	// TODO: Implement actual pod metrics retrieval
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"cluster_id": clusterID,
		"namespace":  namespace,
		"pod_name":   pod,
		"timestamp":  time.Now(),
		"containers": []map[string]interface{}{
			{
				"name":         "nginx",
				"cpu_usage":    "100m",
				"memory_usage": "256Mi",
			},
		},
	})
}
