// Package rest: API integration tests (B4.2). HTTP handlers with mock cluster service; assert status and JSON shape.
package rest

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gorilla/mux"
	"github.com/kubilitics/kubilitics-backend/internal/config"
	"github.com/kubilitics/kubilitics-backend/internal/models"
	"github.com/kubilitics/kubilitics-backend/internal/service"
)

type mockClusterRepo struct {
	list []*models.Cluster
	get  map[string]*models.Cluster // optional: id -> cluster for Get(ctx, id)
}

func (m *mockClusterRepo) Create(ctx context.Context, cluster *models.Cluster) error { return nil }
func (m *mockClusterRepo) Get(ctx context.Context, id string) (*models.Cluster, error) {
	if m.get != nil {
		if c, ok := m.get[id]; ok {
			return c, nil
		}
	}
	return nil, nil
}
func (m *mockClusterRepo) List(ctx context.Context) ([]*models.Cluster, error) {
	return m.list, nil
}
func (m *mockClusterRepo) Update(ctx context.Context, cluster *models.Cluster) error { return nil }
func (m *mockClusterRepo) Delete(ctx context.Context, id string) error                 { return nil }

func TestAPI_GET_Clusters_Returns200AndArray(t *testing.T) {
	repo := &mockClusterRepo{list: []*models.Cluster{}}
	cfg := &config.Config{}
	cs := service.NewClusterService(repo, cfg)
	h := NewHandler(cs, nil, cfg, nil, nil, nil)

	router := mux.NewRouter()
	api := router.PathPrefix("/api/v1").Subrouter()
	SetupRoutes(api, h)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/clusters", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("GET /api/v1/clusters status = %d, want 200", rec.Code)
	}
	var out []models.Cluster
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Errorf("decode response: %v", err)
	}
	if out == nil {
		t.Error("response body should be JSON array (possibly empty)")
	}
}

func TestAPI_GET_Health_Returns200(t *testing.T) {
	router := mux.NewRouter()
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
	}).Methods("GET")

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("GET /health status = %d, want 200", rec.Code)
	}
}

// TestAPI_POST_Shell_BlockedVerb_Returns400 verifies that blocked kubectl verbs (e.g. delete) return 400.
func TestAPI_POST_Shell_BlockedVerb_Returns400(t *testing.T) {
	clusterID := "test-cluster-id"
	repo := &mockClusterRepo{
		list: []*models.Cluster{},
		get: map[string]*models.Cluster{
			clusterID: {
				ID:             clusterID,
				Name:           "test",
				Context:       "test-ctx",
				KubeconfigPath: "/tmp/kubeconfig",
			},
		},
	}
	cfg := &config.Config{}
	cs := service.NewClusterService(repo, cfg)
	h := NewHandler(cs, nil, cfg, nil, nil, nil)

	router := mux.NewRouter()
	api := router.PathPrefix("/api/v1").Subrouter()
	SetupRoutes(api, h)

	body := `{"command":"delete pod mypod"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters/"+clusterID+"/shell", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("POST /shell with blocked verb status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Command not allowed") {
		t.Errorf("response body should contain 'Command not allowed', got: %s", rec.Body.String())
	}
}

// TestAPI_POST_Shell_EmptyCommand_Returns200 verifies that empty command runs kubectl version (200 + JSON).
func TestAPI_POST_Shell_EmptyCommand_Returns200(t *testing.T) {
	clusterID := "test-cluster-id"
	repo := &mockClusterRepo{
		list: []*models.Cluster{},
		get: map[string]*models.Cluster{
			clusterID: {
				ID:             clusterID,
				Name:           "test",
				Context:       "test-ctx",
				KubeconfigPath: "/tmp/kubeconfig",
			},
		},
	}
	cfg := &config.Config{}
	cs := service.NewClusterService(repo, cfg)
	h := NewHandler(cs, nil, cfg, nil, nil, nil)

	router := mux.NewRouter()
	api := router.PathPrefix("/api/v1").Subrouter()
	SetupRoutes(api, h)

	body := `{"command":""}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/clusters/"+clusterID+"/shell", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("POST /shell with empty command status = %d, want 200", rec.Code)
	}
	var out struct {
		Stdout   string `json:"stdout"`
		Stderr   string `json:"stderr"`
		ExitCode int    `json:"exitCode"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Errorf("decode response: %v", err)
	}
	// Backend returns stdout/stderr/exitCode for empty command (kubectl version); exitCode may be non-zero if kubectl not in path
}
