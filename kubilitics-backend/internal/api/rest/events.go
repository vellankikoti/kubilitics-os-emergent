package rest

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

// GetEvents handles GET /clusters/{id}/events
func (h *Handler) GetEvents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	// Query parameters
	namespace := r.URL.Query().Get("namespace")
	resourceKind := r.URL.Query().Get("resource_kind")
	resourceName := r.URL.Query().Get("resource_name")
	limitStr := r.URL.Query().Get("limit")

	limit := 100
	if limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil {
			limit = parsed
		}
	}

	// TODO: Implement actual events retrieval via events_service
	respondJSON(w, http.StatusOK, []map[string]interface{}{
		{
			"cluster_id":   clusterID,
			"namespace":    namespace,
			"name":         "event-1",
			"type":         "Normal",
			"reason":       "Started",
			"message":      "Started container",
			"involved_object": map[string]interface{}{
				"kind":      resourceKind,
				"namespace": namespace,
				"name":      resourceName,
			},
			"first_timestamp": time.Now().Add(-1 * time.Hour),
			"last_timestamp":  time.Now(),
			"count":           1,
		},
	})

	_ = limit // Use limit when implementing actual query
}
