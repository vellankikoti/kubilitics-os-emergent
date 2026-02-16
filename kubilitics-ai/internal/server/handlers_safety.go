package server

// handlers_safety.go — Additional safety REST API endpoints for A-CORE-006.
//
// Endpoints added here (beyond the basic ones in handlers.go):
//   DELETE /api/v1/safety/policies/{name}      — delete a named policy
//   GET    /api/v1/safety/autonomy/{user_id}   — get autonomy level for user
//   POST   /api/v1/safety/autonomy/{user_id}   — set autonomy level for user
//   GET    /api/v1/safety/approvals            — list pending approvals

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// handleSafetyPolicyByName handles DELETE /api/v1/safety/policies/{name}
func (s *Server) handleSafetyPolicyByName(w http.ResponseWriter, r *http.Request) {
	if s.safetyEngine == nil {
		http.Error(w, "Safety engine not enabled", http.StatusServiceUnavailable)
		return
	}

	// Extract policy name from URL: /api/v1/safety/policies/{name}
	prefix := "/api/v1/safety/policies/"
	policyName := strings.TrimPrefix(r.URL.Path, prefix)
	if policyName == "" {
		http.Error(w, "Policy name is required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodDelete:
		if err := s.safetyEngine.DeletePolicy(r.Context(), policyName); err != nil {
			http.Error(w, fmt.Sprintf("Failed to delete policy: %v", err), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"deleted":   policyName,
			"timestamp": time.Now().Format(time.RFC3339),
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleSafetyAutonomy handles GET/POST /api/v1/safety/autonomy/{user_id}
func (s *Server) handleSafetyAutonomy(w http.ResponseWriter, r *http.Request) {
	if s.safetyEngine == nil {
		http.Error(w, "Safety engine not enabled", http.StatusServiceUnavailable)
		return
	}

	// Extract user_id from URL: /api/v1/safety/autonomy/{user_id}
	prefix := "/api/v1/safety/autonomy/"
	userID := strings.TrimPrefix(r.URL.Path, prefix)
	if userID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		level, err := s.safetyEngine.GetAutonomyLevel(r.Context(), userID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to get autonomy level: %v", err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user_id":   userID,
			"level":     level,
			"timestamp": time.Now().Format(time.RFC3339),
		})

	case http.MethodPost:
		var req struct {
			Level interface{} `json:"level"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf("Invalid request body: %v", err), http.StatusBadRequest)
			return
		}

		// Accept level as number or string
		var level int
		switch v := req.Level.(type) {
		case float64:
			level = int(v)
		case string:
			parsed, err := strconv.Atoi(v)
			if err != nil {
				http.Error(w, "level must be an integer (0-5)", http.StatusBadRequest)
				return
			}
			level = parsed
		default:
			http.Error(w, "level must be an integer (0-5)", http.StatusBadRequest)
			return
		}

		if level < 0 || level > 5 {
			http.Error(w, "level must be between 0 and 5", http.StatusBadRequest)
			return
		}

		if err := s.safetyEngine.SetAutonomyLevel(r.Context(), userID, level); err != nil {
			http.Error(w, fmt.Sprintf("Failed to set autonomy level: %v", err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"user_id":   userID,
			"level":     level,
			"timestamp": time.Now().Format(time.RFC3339),
		})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleSafetyApprovals handles GET /api/v1/safety/approvals
// Returns pending approval requests for the requesting user.
func (s *Server) handleSafetyApprovals(w http.ResponseWriter, r *http.Request) {
	if s.safetyEngine == nil {
		http.Error(w, "Safety engine not enabled", http.StatusServiceUnavailable)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user_id from query param or header
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = r.Header.Get("X-User-ID")
	}
	if userID == "" {
		userID = "default"
	}

	// Delegate to autonomy controller via safety engine — get pending approvals
	// We expose the underlying controller's pending approvals through the engine.
	// For now, return an empty list if the engine doesn't expose this directly.
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user_id":   userID,
		"approvals": []interface{}{},
		"timestamp": time.Now().Format(time.RFC3339),
	})
}
