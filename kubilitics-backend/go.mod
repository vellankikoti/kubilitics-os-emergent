module github.com/kubilitics/kubilitics-backend

go 1.24

require (
	// Kubernetes
	k8s.io/client-go v0.30.0
	k8s.io/api v0.30.0
	k8s.io/apimachinery v0.30.0
	k8s.io/apiextensions-apiserver v0.30.0
	k8s.io/metrics v0.30.0

	// HTTP & WebSocket
	github.com/gorilla/mux v1.8.1
	github.com/gorilla/websocket v1.5.1
	github.com/rs/cors v1.10.1

	// Database
	github.com/jmoiron/sqlx v1.3.5
	github.com/mattn/go-sqlite3 v1.14.19
	github.com/lib/pq v1.10.9

	// Logging
	go.uber.org/zap v1.26.0

	// Configuration
	github.com/spf13/viper v1.18.2

	// YAML
	sigs.k8s.io/yaml v1.4.0

	// Testing
	github.com/stretchr/testify v1.8.4
)
