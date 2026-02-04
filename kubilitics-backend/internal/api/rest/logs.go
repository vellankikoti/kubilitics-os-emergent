package rest

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

// GetPodLogs handles GET /clusters/{id}/logs/{namespace}/{pod}
func (h *Handler) GetPodLogs(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	namespace := vars["namespace"]
	pod := vars["pod"]

	// Query parameters
	container := r.URL.Query().Get("container")
	followStr := r.URL.Query().Get("follow")
	tailStr := r.URL.Query().Get("tail")
	since := r.URL.Query().Get("since")

	follow := followStr == "true"
	tailLines := int64(100)
	if tailStr != "" {
		if parsed, err := strconv.ParseInt(tailStr, 10, 64); err == nil {
			tailLines = parsed
		}
	}

	// TODO: Implement actual log streaming via logs_service
	// For now, return sample logs
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusOK)
	fmt.Fprintf(w, "Logs for cluster: %s, namespace: %s, pod: %s\n", clusterID, namespace, pod)
	fmt.Fprintf(w, "Container: %s, Follow: %v, Tail: %d, Since: %s\n", container, follow, tailLines, since)
	fmt.Fprintf(w, "2024-01-01 10:00:00 Sample log line 1\n")
	fmt.Fprintf(w, "2024-01-01 10:00:01 Sample log line 2\n")
}
