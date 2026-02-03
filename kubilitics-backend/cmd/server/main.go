package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

	"github.com/kubilitics/kubilitics-backend/internal/api/rest"
	"github.com/kubilitics/kubilitics-backend/internal/api/websocket"
	"github.com/kubilitics/kubilitics-backend/internal/config"
	"github.com/kubilitics/kubilitics-backend/internal/k8s"
	"github.com/kubilitics/kubilitics-backend/internal/repository"
	"github.com/kubilitics/kubilitics-backend/internal/service"
)

func main() {
	log.Println("🚀 Kubilitics Backend starting...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Printf("⚠️  Warning: Failed to load config: %v. Using defaults.\", err)
		cfg = &config.Config{
			Port:           8080,
			DatabasePath:   \"./kubilitics.db\",
			LogLevel:       \"info\",
			AllowedOrigins: []string{\"*\"},
		}
	}

	log.Printf(\"📋 Configuration loaded: port=%d, db=%s\", cfg.Port, cfg.DatabasePath)

	// Initialize database
	log.Println(\"💾 Initializing database...\")
	repo, err := repository.NewSQLiteRepository(cfg.DatabasePath)
	if err != nil {
		log.Fatalf(\"❌ Failed to initialize database: %v\", err)
	}
	defer repo.Close()

	// Run migrations
	migrationSQL, err := os.ReadFile(\"migrations/001_initial_schema.sql\")
	if err != nil {
		log.Printf(\"⚠️  Warning: Could not read migration file: %v\", err)
	} else {
		if err := repo.RunMigrations(string(migrationSQL)); err != nil {
			log.Printf(\"⚠️  Warning: Failed to run migrations: %v\", err)
		} else {
			log.Println(\"✅ Database migrations completed\")
		}
	}

	// Initialize services
	log.Println(\"⚙️  Initializing services...\")
	clusterService := service.NewClusterService()
	topologyService := service.NewTopologyService(clusterService)
	logsService := service.NewLogsService(clusterService)
	metricsService := service.NewMetricsService(clusterService)
	eventsService := service.NewEventsService(clusterService)
	exportService := service.NewExportService(topologyService)

	log.Println(\"✅ Services initialized\")

	// Initialize WebSocket hub
	log.Println(\"🔌 Initializing WebSocket hub...\")
	wsHub := websocket.NewHub(ctx)
	go wsHub.Run()
	log.Println(\"✅ WebSocket hub started\")

	// Note: Kubernetes informer setup would be done when a cluster is added
	// For now, we'll initialize it when needed

	// Setup HTTP router
	router := mux.NewRouter()

	// Health check
	router.HandleFunc(\"/health\", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set(\"Content-Type\", \"application/json\")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{\"status\":\"healthy\",\"service\":\"kubilitics-backend\",\"version\":\"1.0.0\"}`))
	}).Methods(\"GET\")

	// API routes
	apiRouter := router.PathPrefix(\"/api/v1\").Subrouter()
	handler := rest.NewHandler(clusterService, topologyService)
	rest.SetupRoutes(apiRouter, handler)

	// WebSocket routes
	wsHandler := websocket.NewHandler(ctx, wsHub, nil) // informerMgr will be set per cluster
	router.HandleFunc(\"/ws/resources\", wsHandler.ServeWS).Methods(\"GET\")

	// Additional API endpoints for logs, metrics, events
	apiRouter.HandleFunc(\"/clusters/{id}/logs/{namespace}/{pod}\", func(w http.ResponseWriter, r *http.Request) {
		// Logs endpoint - implementation in handler
		w.WriteHeader(http.StatusNotImplemented)
	}).Methods(\"GET\")

	apiRouter.HandleFunc(\"/clusters/{id}/metrics/{namespace}/{pod}\", func(w http.ResponseWriter, r *http.Request) {
		// Metrics endpoint - implementation in handler
		w.WriteHeader(http.StatusNotImplemented)
	}).Methods(\"GET\")

	apiRouter.HandleFunc(\"/clusters/{id}/events\", func(w http.ResponseWriter, r *http.Request) {
		// Events endpoint - implementation in handler
		w.WriteHeader(http.StatusNotImplemented)
	}).Methods(\"GET\")

	// Middleware
	router.Use(loggingMiddleware)
	router.Use(recoveryMiddleware)

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{\"GET\", \"POST\", \"PUT\", \"DELETE\", \"OPTIONS\"},
		AllowedHeaders:   []string{\"Content-Type\", \"Authorization\"},
		AllowCredentials: true,
	})
	handlerWithCORS := c.Handler(router)

	// Create HTTP server
	srv := &http.Server{
		Addr:         fmt.Sprintf(\":%d\", cfg.Port),
		Handler:      handlerWithCORS,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Println(\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\")
		log.Printf(\"🌐 Server listening on port %d\", cfg.Port)
		log.Printf(\"📡 API available at http://localhost:%d/api/v1\", cfg.Port)
		log.Printf(\"🔌 WebSocket at ws://localhost:%d/ws/resources\", cfg.Port)
		log.Printf(\"❤️  Health check at http://localhost:%d/health\", cfg.Port)
		log.Println(\"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\")
		
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf(\"❌ Server failed: %v\", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println(\"\")
	log.Println(\"🛑 Shutting down server...\")

	// Stop WebSocket hub
	wsHub.Stop()
	log.Println(\"✅ WebSocket hub stopped\")

	// Graceful shutdown
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf(\"⚠️  Server forced to shutdown: %v\", err)
	}

	log.Println(\"✅ Server exited gracefully\")
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rw, r)
		
		// Color-coded status logging
		statusEmoji := \"✅\"
		if rw.statusCode >= 400 && rw.statusCode < 500 {
			statusEmoji = \"⚠️ \"
		} else if rw.statusCode >= 500 {
			statusEmoji = \"❌\"
		}
		
		log.Printf(\"%s %s %s %d %s\", statusEmoji, r.Method, r.URL.Path, rw.statusCode, time.Since(start))
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func recoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf(\"💥 Panic recovered: %v\", err)
				http.Error(w, \"Internal server error\", http.StatusInternalServerError)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
