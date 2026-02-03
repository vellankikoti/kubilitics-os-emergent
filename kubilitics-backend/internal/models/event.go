package models

import "time"

// Event represents a Kubernetes event
type Event struct {
	ID             string    `json:"id"`
	Type           string    `json:"type"`   // Normal, Warning, Error
	Reason         string    `json:"reason"`
	Message        string    `json:"message"`
	ResourceKind   string    `json:"resource_kind"`
	ResourceName   string    `json:"resource_name"`
	Namespace      string    `json:"namespace"`
	FirstTimestamp time.Time `json:"first_timestamp"`
	LastTimestamp  time.Time `json:"last_timestamp"`
	Count          int32     `json:"count"`
}

// WebSocketMessage represents a message sent via WebSocket
type WebSocketMessage struct {
	Type      string                 `json:"type"`      // resource_update, event, error
	Event     string                 `json:"event"`     // added, updated, deleted
	Resource  map[string]interface{} `json:"resource"`
	Timestamp time.Time              `json:"timestamp"`
}
