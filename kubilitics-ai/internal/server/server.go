package server

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/kubilitics/kubilitics-ai/internal/analytics"
	"github.com/kubilitics/kubilitics-ai/internal/llm/adapter"
	"github.com/kubilitics/kubilitics-ai/internal/safety"
)

// Server represents the Kubilitics AI server
type Server struct {
	config *Config

	// Core components
	llmAdapter      adapter.LLMAdapter
	safetyEngine    *safety.Engine
	analyticsEngine *analytics.Engine

	// HTTP server
	httpServer *http.Server

	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// State
	mu      sync.RWMutex
	running bool
}

// NewServer creates a new Kubilitics AI server
func NewServer(cfg *Config) (*Server, error) {
	if cfg == nil {
		return nil, fmt.Errorf("config cannot be nil")
	}

	ctx, cancel := context.WithCancel(context.Background())

	srv := &Server{
		config:  cfg,
		ctx:     ctx,
		cancel:  cancel,
		running: false,
	}

	// Initialize components
	if err := srv.initializeComponents(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to initialize components: %w", err)
	}

	return srv, nil
}

// initializeComponents initializes all server components
func (s *Server) initializeComponents() error {
	// 1. Initialize LLM Adapter
	llmConfig := &adapter.Config{
		Provider: adapter.ProviderType(s.config.LLMProvider),
		APIKey:   s.config.LLMAPIKey,
		Model:    s.config.LLMModel,
		BaseURL:  s.config.LLMBaseURL,
	}

	llmAdapter, err := adapter.NewLLMAdapter(llmConfig)
	if err != nil {
		return fmt.Errorf("failed to initialize LLM adapter: %w", err)
	}
	s.llmAdapter = llmAdapter

	// 2. Initialize Safety Engine (if enabled)
	if s.config.EnableSafetyEngine {
		safetyEngine, err := safety.NewEngine()
		if err != nil {
			return fmt.Errorf("failed to initialize safety engine: %w", err)
		}
		s.safetyEngine = safetyEngine
	}

	// 3. Initialize Analytics Engine (if enabled)
	if s.config.AnalyticsEnabled {
		s.analyticsEngine = analytics.NewEngine()
	}

	return nil
}

// Start starts the server
func (s *Server) Start() error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return fmt.Errorf("server is already running")
	}
	s.running = true
	s.mu.Unlock()

	// Setup HTTP server
	mux := http.NewServeMux()
	s.registerHandlers(mux)

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf("%s:%d", s.config.Host, s.config.HTTPPort),
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// Start HTTP server
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		fmt.Printf("Starting HTTP server on %s:%d\n", s.config.Host, s.config.HTTPPort)
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("HTTP server error: %v\n", err)
		}
	}()

	fmt.Println("Kubilitics AI Server started successfully")
	fmt.Printf("  LLM Provider: %s\n", s.config.LLMProvider)
	fmt.Printf("  Safety Engine: %v\n", s.config.EnableSafetyEngine)
	fmt.Printf("  Analytics: %v\n", s.config.AnalyticsEnabled)
	fmt.Printf("  Autonomy Level: %d\n", s.config.DefaultAutonomyLevel)

	return nil
}

// Stop gracefully stops the server
func (s *Server) Stop() error {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return fmt.Errorf("server is not running")
	}
	s.running = false
	s.mu.Unlock()

	fmt.Println("Stopping Kubilitics AI Server...")

	// Shutdown HTTP server
	if s.httpServer != nil {
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := s.httpServer.Shutdown(shutdownCtx); err != nil {
			fmt.Printf("Error shutting down HTTP server: %v\n", err)
		}
	}

	// Cancel context
	s.cancel()

	// Wait for goroutines
	s.wg.Wait()

	fmt.Println("Kubilitics AI Server stopped")
	return nil
}

// Wait blocks until the server is stopped
func (s *Server) Wait() {
	<-s.ctx.Done()
}

// IsRunning returns whether the server is running
func (s *Server) IsRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.running
}

// GetLLMAdapter returns the LLM adapter
func (s *Server) GetLLMAdapter() adapter.LLMAdapter {
	return s.llmAdapter
}

// GetSafetyEngine returns the safety engine
func (s *Server) GetSafetyEngine() *safety.Engine {
	return s.safetyEngine
}

// GetAnalyticsEngine returns the analytics engine
func (s *Server) GetAnalyticsEngine() *analytics.Engine {
	return s.analyticsEngine
}

// registerHandlers registers HTTP handlers
func (s *Server) registerHandlers(mux *http.ServeMux) {
	// Health check
	mux.HandleFunc("/health", s.handleHealth)

	// Readiness check
	mux.HandleFunc("/ready", s.handleReady)

	// Info endpoint
	mux.HandleFunc("/info", s.handleInfo)

	// LLM endpoints
	mux.HandleFunc("/api/v1/llm/complete", s.handleLLMComplete)
	mux.HandleFunc("/api/v1/llm/stream", s.handleLLMStream)

	// Safety endpoints
	if s.safetyEngine != nil {
		mux.HandleFunc("/api/v1/safety/evaluate", s.handleSafetyEvaluate)
		mux.HandleFunc("/api/v1/safety/rules", s.handleSafetyRules)
		mux.HandleFunc("/api/v1/safety/policies", s.handleSafetyPolicies)
	}

	// Analytics endpoints
	if s.analyticsEngine != nil {
		mux.HandleFunc("/api/v1/analytics/anomalies", s.handleAnalyticsAnomalies)
		mux.HandleFunc("/api/v1/analytics/trends", s.handleAnalyticsTrends)
		mux.HandleFunc("/api/v1/analytics/recommendations", s.handleAnalyticsRecommendations)
	}

	// WebSocket endpoint for AI chat
	mux.HandleFunc("/ws/chat", s.handleWebSocket)

	// Conversation endpoints
	mux.HandleFunc("/api/v1/conversations", s.handleConversationsList)
	mux.HandleFunc("/api/v1/conversations/", s.handleConversationGet)
}

// handleHealth handles health check requests
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"healthy","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`))
}

// handleReady handles readiness check requests
func (s *Server) handleReady(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.mu.RLock()
	ready := s.running && s.llmAdapter != nil
	s.mu.RUnlock()

	if !ready {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		w.Write([]byte(`{"status":"not_ready"}`))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ready","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`))
}

// handleInfo handles info requests
func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	info := fmt.Sprintf(`{
		"name":"Kubilitics AI",
		"version":"0.1.0",
		"llm_provider":"%s",
		"safety_engine_enabled":%v,
		"analytics_enabled":%v,
		"autonomy_level":%d,
		"timestamp":"%s"
	}`,
		s.config.LLMProvider,
		s.config.EnableSafetyEngine,
		s.config.AnalyticsEnabled,
		s.config.DefaultAutonomyLevel,
		time.Now().Format(time.RFC3339),
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(info))
}

// API endpoint handlers are implemented in handlers.go and websocket.go
