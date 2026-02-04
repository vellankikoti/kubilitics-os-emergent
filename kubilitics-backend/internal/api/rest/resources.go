package rest

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

// ListResources handles GET /clusters/{id}/resources/{kind}
func (h *Handler) ListResources(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := r.URL.Query().Get("namespace")

	// TODO: Implement actual resource listing via clusterService
	// For now, return placeholder
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"cluster_id": clusterID,
		"kind":       kind,
		"namespace":  namespace,
		"resources":  []interface{}{},
	})
}

// GetResource handles GET /clusters/{id}/resources/{kind}/{namespace}/{name}
func (h *Handler) GetResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	// TODO: Implement actual resource retrieval
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"cluster_id": clusterID,
		"kind":       kind,
		"namespace":  namespace,
		"name":       name,
		"status":     "Running",
	})
}

// DeleteResource handles DELETE /clusters/{id}/resources/{kind}/{namespace}/{name}
func (h *Handler) DeleteResource(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]
	kind := vars["kind"]
	namespace := vars["namespace"]
	name := vars["name"]

	// TODO: Implement actual resource deletion
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Resource deleted",
		"cluster_id": clusterID,
		"kind":     kind,
		"namespace": namespace,
		"name":     name,
	})
}

// ApplyManifest handles POST /clusters/{id}/apply
func (h *Handler) ApplyManifest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["id"]

	var req struct {
		YAML string `json:"yaml"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.YAML == "" {
		respondError(w, http.StatusBadRequest, "YAML content is required")
		return
	}

	// TODO: Implement actual YAML application via kubectl/client-go
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":    "Manifest applied successfully",
		"cluster_id": clusterID,
		"resources":  []string{"Pod/default/nginx"},
	})
}
