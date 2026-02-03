package rest

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/kubilitics/kubilitics-backend/internal/service"
)

// Handler manages HTTP request handlers
type Handler struct {
	clusterService  service.ClusterService
	topologyService service.TopologyService
}

// NewHandler creates a new HTTP handler
func NewHandler(cs service.ClusterService, ts service.TopologyService) *Handler {
	return &Handler{
		clusterService:  cs,
		topologyService: ts,
	}
}

// SetupRoutes configures API routes
func SetupRoutes(router *mux.Router, h *Handler) {
	// Cluster routes
	router.HandleFunc("/clusters", h.ListClusters).Methods("GET")
	router.HandleFunc("/clusters", h.AddCluster).Methods("POST")
	router.HandleFunc("/clusters/{id}", h.GetCluster).Methods("GET")
	router.HandleFunc("/clusters/{id}", h.RemoveCluster).Methods("DELETE")
	router.HandleFunc("/clusters/{id}/summary", h.GetClusterSummary).Methods("GET")

	// Topology routes
	router.HandleFunc("/clusters/{id}/topology", h.GetTopology).Methods("GET")
	router.HandleFunc("/clusters/{id}/topology/export", h.ExportTopology).Methods("POST")

	// Health check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}).Methods("GET")
}

// ListClusters handles GET /clusters
func (h *Handler) ListClusters(w http.ResponseWriter, r *http.Request) {
	clusters, err := h.clusterService.ListClusters(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, clusters)
}

// GetCluster handles GET /clusters/{id}
func (h *Handler) GetCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	cluster, err := h.clusterService.GetCluster(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, cluster)
}

// AddCluster handles POST /clusters
func (h *Handler) AddCluster(w http.ResponseWriter, r *http.Request) {
	var req struct {
		KubeconfigPath string `json:"kubeconfig_path"`
		Context        string `json:"context"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cluster, err := h.clusterService.AddCluster(r.Context(), req.KubeconfigPath, req.Context)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, cluster)
}

// RemoveCluster handles DELETE /clusters/{id}
func (h *Handler) RemoveCluster(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	if err := h.clusterService.RemoveCluster(r.Context(), id); err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Cluster removed"})
}

// GetClusterSummary handles GET /clusters/{id}/summary
func (h *Handler) GetClusterSummary(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	summary, err := h.clusterService.GetClusterSummary(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, summary)
}

// GetTopology handles GET /clusters/{id}/topology
func (h *Handler) GetTopology(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Parse query parameters for filters
	namespace := r.URL.Query().Get("namespace")

	filters := models.TopologyFilters{
		Namespace: namespace,
	}

	topology, err := h.topologyService.GetTopology(r.Context(), id, filters)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, topology)
}

// ExportTopology handles POST /clusters/{id}/topology/export
func (h *Handler) ExportTopology(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Format string `json:"format"` // png, pdf, svg
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	data, err := h.topologyService.ExportTopology(r.Context(), id, req.Format)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(data)
}

// Helper functions
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}
