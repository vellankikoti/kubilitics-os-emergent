package websocket

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	_ "github.com/gorilla/websocket"
	"github.com/kubilitics/kubilitics-backend/internal/models"
)

// Hub maintains active WebSocket connections and broadcasts messages
type Hub struct {
	// Registered clients
	clients map[*Client]bool

	// Inbound messages from clients
	broadcast chan []byte

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	// Mutex for thread-safe operations
	mu sync.RWMutex

	// Context for cancellation
	ctx    context.Context
	cancel context.CancelFunc
}

// NewHub creates a new WebSocket hub
func NewHub(ctx context.Context) *Hub {
	hubCtx, cancel := context.WithCancel(ctx)
	return &Hub{
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
		ctx:        hubCtx,
		cancel:     cancel,
	}
}

// Run starts the hub
func (h *Hub) Run() {
	for {
		select {
		case <-h.ctx.Done():
			return

		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client buffer full, close connection
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Stop stops the hub
func (h *Hub) Stop() {
	h.cancel()
	h.mu.Lock()
	defer h.mu.Unlock()

	// Close all client connections
	for client := range h.clients {
		close(client.send)
		delete(h.clients, client)
	}
}

// BroadcastResourceEvent broadcasts a resource event to all clients
func (h *Hub) BroadcastResourceEvent(eventType string, resourceType string, obj interface{}) error {
	msg := models.WebSocketMessage{
		Type:      "resource_update",
		Event:     eventType,
		Resource:  map[string]interface{}{"type": resourceType, "data": obj},
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case h.broadcast <- data:
		return nil
	case <-h.ctx.Done():
		return h.ctx.Err()
	}
}

// BroadcastTopologyUpdate broadcasts a topology update
func (h *Hub) BroadcastTopologyUpdate(topology *models.TopologyGraph) error {
	msg := models.WebSocketMessage{
		Type:      "topology_update",
		Event:     "updated",
		Resource:  map[string]interface{}{"topology": topology},
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case h.broadcast <- data:
		return nil
	case <-h.ctx.Done():
		return h.ctx.Err()
	}
}

// GetClientCount returns the number of connected clients
func (h *Hub) GetClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
