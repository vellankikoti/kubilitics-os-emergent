package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/kubilitics/kubilitics-ai/internal/llm/types"
)

// WebSocket message types
const (
	MessageTypeText      = "text"
	MessageTypeTool      = "tool"
	MessageTypeError     = "error"
	MessageTypeComplete  = "complete"
	MessageTypeHeartbeat = "heartbeat"
)

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type      string                 `json:"type"`
	Content   string                 `json:"content,omitempty"`
	Tool      interface{}            `json:"tool,omitempty"`
	Error     string                 `json:"error,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// WSRequest represents an incoming WebSocket request
type WSRequest struct {
	Messages []types.Message `json:"messages"`
	Tools    []types.Tool    `json:"tools,omitempty"`
	Stream   bool            `json:"stream"`
	Context  map[string]interface{} `json:"context,omitempty"` // Current screen, resource, namespace
}

// WebSocket upgrader
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO: Implement proper origin checking in production
		return true
	},
}

// WSConnection represents an active WebSocket connection
type WSConnection struct {
	conn      *websocket.Conn
	server    *Server
	mu        sync.Mutex
	ctx       context.Context
	cancel    context.CancelFunc
	sessionID string
}

// handleWebSocket handles WebSocket connections for AI chat
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create connection context
	ctx, cancel := context.WithCancel(s.ctx)

	// Create WebSocket connection
	wsConn := &WSConnection{
		conn:      conn,
		server:    s,
		ctx:       ctx,
		cancel:    cancel,
		sessionID: fmt.Sprintf("ws-%d", time.Now().UnixNano()),
	}

	log.Printf("WebSocket connection established: %s", wsConn.sessionID)

	// Handle connection
	wsConn.handle()
}

// handle manages the WebSocket connection lifecycle
func (wsc *WSConnection) handle() {
	defer func() {
		wsc.cancel()
		wsc.conn.Close()
		log.Printf("WebSocket connection closed: %s", wsc.sessionID)
	}()

	// Start heartbeat
	go wsc.heartbeat()

	// Read messages
	for {
		select {
		case <-wsc.ctx.Done():
			return
		default:
			// Read message from client
			var req WSRequest
			err := wsc.conn.ReadJSON(&req)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}

			// Process request
			if req.Stream {
				wsc.handleStreamRequest(&req)
			} else {
				wsc.handleCompleteRequest(&req)
			}
		}
	}
}

// handleStreamRequest handles streaming LLM requests
func (wsc *WSConnection) handleStreamRequest(req *WSRequest) {
	// Get LLM adapter
	llmAdapter := wsc.server.GetLLMAdapter()
	if llmAdapter == nil {
		wsc.sendError("LLM adapter not initialized")
		return
	}

	// Start streaming
	textChan, toolChan, err := llmAdapter.CompleteStream(wsc.ctx, req.Messages, req.Tools)
	if err != nil {
		wsc.sendError(fmt.Sprintf("Failed to start streaming: %v", err))
		return
	}

	// Stream tokens back to client
	for {
		select {
		case <-wsc.ctx.Done():
			return

		case token, ok := <-textChan:
			if !ok {
				// Stream complete
				wsc.send(&WSMessage{
					Type:      MessageTypeComplete,
					Timestamp: time.Now(),
				})
				return
			}
			wsc.send(&WSMessage{
				Type:      MessageTypeText,
				Content:   token,
				Timestamp: time.Now(),
			})

		case tool, ok := <-toolChan:
			if !ok {
				continue
			}
			wsc.send(&WSMessage{
				Type:      MessageTypeTool,
				Tool:      tool,
				Timestamp: time.Now(),
			})
		}
	}
}

// handleCompleteRequest handles non-streaming LLM requests
func (wsc *WSConnection) handleCompleteRequest(req *WSRequest) {
	// Get LLM adapter
	llmAdapter := wsc.server.GetLLMAdapter()
	if llmAdapter == nil {
		wsc.sendError("LLM adapter not initialized")
		return
	}

	// Call LLM
	response, tools, err := llmAdapter.Complete(wsc.ctx, req.Messages, req.Tools)
	if err != nil {
		wsc.sendError(fmt.Sprintf("LLM error: %v", err))
		return
	}

	// Send response
	wsc.send(&WSMessage{
		Type:      MessageTypeText,
		Content:   response,
		Timestamp: time.Now(),
	})

	// Send tools if any
	for _, tool := range tools {
		wsc.send(&WSMessage{
			Type:      MessageTypeTool,
			Tool:      tool,
			Timestamp: time.Now(),
		})
	}

	// Send complete
	wsc.send(&WSMessage{
		Type:      MessageTypeComplete,
		Timestamp: time.Now(),
	})
}

// send sends a message to the client
func (wsc *WSConnection) send(msg *WSMessage) error {
	wsc.mu.Lock()
	defer wsc.mu.Unlock()

	wsc.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return wsc.conn.WriteJSON(msg)
}

// sendError sends an error message to the client
func (wsc *WSConnection) sendError(errMsg string) {
	wsc.send(&WSMessage{
		Type:      MessageTypeError,
		Error:     errMsg,
		Timestamp: time.Now(),
	})
}

// heartbeat sends periodic heartbeat messages
func (wsc *WSConnection) heartbeat() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wsc.ctx.Done():
			return
		case <-ticker.C:
			wsc.send(&WSMessage{
				Type:      MessageTypeHeartbeat,
				Timestamp: time.Now(),
			})
		}
	}
}

// ConversationMessage represents a message in conversation history
type ConversationMessage struct {
	Role      string                 `json:"role"`
	Content   string                 `json:"content"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// Conversation represents a conversation session
type Conversation struct {
	ID        string                `json:"id"`
	Messages  []ConversationMessage `json:"messages"`
	Context   map[string]interface{} `json:"context,omitempty"`
	CreatedAt time.Time             `json:"created_at"`
	UpdatedAt time.Time             `json:"updated_at"`
}

// ConversationStore stores conversation history (in-memory for now)
type ConversationStore struct {
	mu            sync.RWMutex
	conversations map[string]*Conversation
}

// NewConversationStore creates a new conversation store
func NewConversationStore() *ConversationStore {
	return &ConversationStore{
		conversations: make(map[string]*Conversation),
	}
}

// CreateConversation creates a new conversation
func (cs *ConversationStore) CreateConversation(context map[string]interface{}) *Conversation {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	conv := &Conversation{
		ID:        fmt.Sprintf("conv-%d", time.Now().UnixNano()),
		Messages:  make([]ConversationMessage, 0),
		Context:   context,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	cs.conversations[conv.ID] = conv
	return conv
}

// GetConversation retrieves a conversation by ID
func (cs *ConversationStore) GetConversation(id string) (*Conversation, error) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	conv, ok := cs.conversations[id]
	if !ok {
		return nil, fmt.Errorf("conversation not found: %s", id)
	}

	return conv, nil
}

// AddMessage adds a message to a conversation
func (cs *ConversationStore) AddMessage(convID string, role, content string, metadata map[string]interface{}) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	conv, ok := cs.conversations[convID]
	if !ok {
		return fmt.Errorf("conversation not found: %s", convID)
	}

	msg := ConversationMessage{
		Role:      role,
		Content:   content,
		Timestamp: time.Now(),
		Metadata:  metadata,
	}

	conv.Messages = append(conv.Messages, msg)
	conv.UpdatedAt = time.Now()

	return nil
}

// ListConversations returns all conversations
func (cs *ConversationStore) ListConversations() []*Conversation {
	cs.mu.RLock()
	defer cs.mu.RUnlock()

	convs := make([]*Conversation, 0, len(cs.conversations))
	for _, conv := range cs.conversations {
		convs = append(convs, conv)
	}

	return convs
}

// DeleteConversation deletes a conversation
func (cs *ConversationStore) DeleteConversation(id string) error {
	cs.mu.Lock()
	defer cs.mu.Unlock()

	if _, ok := cs.conversations[id]; !ok {
		return fmt.Errorf("conversation not found: %s", id)
	}

	delete(cs.conversations, id)
	return nil
}

// handleConversationsList handles listing conversations
func (s *Server) handleConversationsList(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Get from conversation store when integrated
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"conversations": []interface{}{},
		"count":         0,
	})
}

// handleConversationGet handles getting a specific conversation
func (s *Server) handleConversationGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// TODO: Implement when conversation store is integrated
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "not_implemented",
		"message": "Conversation retrieval coming soon",
	})
}
