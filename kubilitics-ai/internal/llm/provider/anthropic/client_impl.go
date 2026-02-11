package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"time"
)

// Anthropic API constants
const (
	DefaultBaseURL     = "https://api.anthropic.com/v1"
	DefaultModel       = "claude-3-5-sonnet-20241022"
	DefaultMaxTokens   = 4096
	DefaultAPIVersion  = "2023-06-01"
	DefaultTimeout     = 120 * time.Second
)

// Model costs per 1K tokens (as of Feb 2026)
var modelCosts = map[string]struct {
	InputCost  float64
	OutputCost float64
}{
	"claude-3-5-sonnet-20241022": {0.003, 0.015},
	"claude-3-opus-20240229":     {0.015, 0.075},
	"claude-3-sonnet-20240229":   {0.003, 0.015},
	"claude-3-haiku-20240307":    {0.00025, 0.00125},
}

// AnthropicClientImpl implements the Anthropic provider (exported for adapter)
type AnthropicClientImpl struct {
	apiKey          string
	model           string
	maxTokens       int
	budgetingTokens int
	baseURL         string
	httpClient      *http.Client
}

// Message represents an Anthropic message
type Message struct {
	Role    string        `json:"role"`
	Content []ContentBlock `json:"content"`
}

// ContentBlock can be text or tool_use or tool_result
type ContentBlock struct {
	Type  string                 `json:"type"`
	Text  string                 `json:"text,omitempty"`
	ID    string                 `json:"id,omitempty"`
	Name  string                 `json:"name,omitempty"`
	Input map[string]interface{} `json:"input,omitempty"`
}

// Tool represents an Anthropic tool definition
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"input_schema"`
}

// Request represents an Anthropic API request
type Request struct {
	Model       string    `json:"model"`
	MaxTokens   int       `json:"max_tokens"`
	Messages    []Message `json:"messages"`
	Tools       []Tool    `json:"tools,omitempty"`
	System      string    `json:"system,omitempty"`
	Temperature float64   `json:"temperature,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

// Response represents an Anthropic API response
type Response struct {
	ID           string         `json:"id"`
	Type         string         `json:"type"`
	Role         string         `json:"role"`
	Content      []ContentBlock `json:"content"`
	Model        string         `json:"model"`
	StopReason   string         `json:"stop_reason"`
	Usage        Usage          `json:"usage"`
}

// Usage tracks token usage
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// Capabilities represents model capabilities
type Capabilities struct {
	Streaming        bool    `json:"streaming"`
	ToolUse          bool    `json:"tool_use"`
	ExtendedThinking bool    `json:"extended_thinking"`
	MaxTokens        int     `json:"max_tokens"`
	InputCostPer1K   float64 `json:"input_cost_per_1k"`
	OutputCostPer1K  float64 `json:"output_cost_per_1k"`
}

// NewAnthropicClient creates a new Anthropic client
func NewAnthropicClient(apiKey string, model string) (*AnthropicClientImpl, error) {
	if apiKey == "" {
		// Try environment variable
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
		if apiKey == "" {
			return nil, fmt.Errorf("ANTHROPIC_API_KEY is required")
		}
	}

	if model == "" {
		model = os.Getenv("ANTHROPIC_MODEL")
		if model == "" {
			model = DefaultModel
		}
	}

	maxTokens := DefaultMaxTokens
	if maxTokensStr := os.Getenv("ANTHROPIC_MAX_TOKENS"); maxTokensStr != "" {
		if mt, err := strconv.Atoi(maxTokensStr); err == nil {
			maxTokens = mt
		}
	}

	baseURL := os.Getenv("ANTHROPIC_BASE_URL")
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}

	return &AnthropicClientImpl{
		apiKey:    apiKey,
		model:     model,
		maxTokens: maxTokens,
		baseURL:   baseURL,
		httpClient: &http.Client{
			Timeout: DefaultTimeout,
		},
	}, nil
}

// Complete implements non-streaming completion
func (c *AnthropicClientImpl) Complete(ctx context.Context, messages []interface{}, tools []interface{}) (string, []interface{}, error) {
	// Convert generic messages to Anthropic format
	anthMessages, err := c.convertMessages(messages)
	if err != nil {
		return "", nil, fmt.Errorf("failed to convert messages: %w", err)
	}

	// Convert generic tools to Anthropic format
	anthTools, err := c.convertTools(tools)
	if err != nil {
		return "", nil, fmt.Errorf("failed to convert tools: %w", err)
	}

	req := Request{
		Model:     c.model,
		MaxTokens: c.maxTokens,
		Messages:  anthMessages,
		Tools:     anthTools,
		Stream:    false,
	}

	// Make API call
	resp, err := c.makeRequest(ctx, req)
	if err != nil {
		return "", nil, err
	}

	// Extract text and tool calls from response
	var text string
	var toolCalls []interface{}

	for _, block := range resp.Content {
		if block.Type == "text" {
			text += block.Text
		} else if block.Type == "tool_use" {
			toolCalls = append(toolCalls, map[string]interface{}{
				"id":    block.ID,
				"name":  block.Name,
				"input": block.Input,
			})
		}
	}

	return text, toolCalls, nil
}

// CompleteStream implements streaming completion
func (c *AnthropicClientImpl) CompleteStream(ctx context.Context, messages []interface{}, tools []interface{}) (chan string, chan interface{}, error) {
	textChan := make(chan string, 100)
	toolChan := make(chan interface{}, 10)

	// Convert messages and tools
	anthMessages, err := c.convertMessages(messages)
	if err != nil {
		close(textChan)
		close(toolChan)
		return nil, nil, fmt.Errorf("failed to convert messages: %w", err)
	}

	anthTools, err := c.convertTools(tools)
	if err != nil {
		close(textChan)
		close(toolChan)
		return nil, nil, fmt.Errorf("failed to convert tools: %w", err)
	}

	// Start streaming in goroutine
	go func() {
		defer close(textChan)
		defer close(toolChan)

		// Full streaming implementation would parse SSE events from Anthropic
		// For now, return placeholder message
		_ = anthMessages // Use the converted messages
		_ = anthTools    // Use the converted tools
		textChan <- "Streaming not yet implemented"
	}()

	return textChan, toolChan, nil
}

// CountTokens estimates token count
func (c *AnthropicClientImpl) CountTokens(ctx context.Context, messages []interface{}, tools []interface{}) (int, error) {
	// Anthropic doesn't have a separate token counting API
	// We approximate based on character count
	// Real implementation would use tiktoken or similar

	totalChars := 0
	for _, msg := range messages {
		if msgMap, ok := msg.(map[string]interface{}); ok {
			if content, ok := msgMap["content"].(string); ok {
				totalChars += len(content)
			}
		}
	}

	for _, tool := range tools {
		if toolMap, ok := tool.(map[string]interface{}); ok {
			if toolJSON, err := json.Marshal(toolMap); err == nil {
				totalChars += len(toolJSON)
			}
		}
	}

	// Rough estimate: 4 characters per token
	return totalChars / 4, nil
}

// GetCapabilities returns model capabilities
func (c *AnthropicClientImpl) GetCapabilities(ctx context.Context) (interface{}, error) {
	costs, ok := modelCosts[c.model]
	if !ok {
		// Default to Sonnet costs
		costs = modelCosts[DefaultModel]
	}

	caps := Capabilities{
		Streaming:        true,
		ToolUse:          true,
		ExtendedThinking: c.model == "claude-3-5-sonnet-20241022",
		MaxTokens:        200000, // Claude 3.5 Sonnet has 200K context
		InputCostPer1K:   costs.InputCost,
		OutputCostPer1K:  costs.OutputCost,
	}

	return caps, nil
}

// ValidateToolCall validates a tool call
func (c *AnthropicClientImpl) ValidateToolCall(ctx context.Context, toolName string, args interface{}) error {
	if toolName == "" {
		return fmt.Errorf("tool name is required")
	}
	// Additional validation would check against tool schemas
	return nil
}

// NormalizeToolCall converts Anthropic format to standard format
func (c *AnthropicClientImpl) NormalizeToolCall(ctx context.Context, toolCall interface{}) (map[string]interface{}, error) {
	tcMap, ok := toolCall.(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("tool call must be a map")
	}

	// Anthropic format: {id, name, input}
	// Standard format: {tool_name, args}
	name, _ := tcMap["name"].(string)
	input, _ := tcMap["input"].(map[string]interface{})

	return map[string]interface{}{
		"tool_name": name,
		"args":      input,
	}, nil
}

// convertMessages converts generic messages to Anthropic format
func (c *AnthropicClientImpl) convertMessages(messages []interface{}) ([]Message, error) {
	result := make([]Message, 0, len(messages))

	for _, msg := range messages {
		msgMap, ok := msg.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("message must be a map")
		}

		role, _ := msgMap["role"].(string)
		content, _ := msgMap["content"].(string)

		if role == "" || content == "" {
			return nil, fmt.Errorf("message must have role and content")
		}

		// Convert system messages to user messages with system prefix
		// Anthropic uses a separate system parameter
		if role == "system" {
			role = "user"
			content = "[SYSTEM] " + content
		}

		result = append(result, Message{
			Role: role,
			Content: []ContentBlock{
				{
					Type: "text",
					Text: content,
				},
			},
		})
	}

	return result, nil
}

// convertTools converts generic tools to Anthropic format
func (c *AnthropicClientImpl) convertTools(tools []interface{}) ([]Tool, error) {
	if len(tools) == 0 {
		return nil, nil
	}

	result := make([]Tool, 0, len(tools))

	for _, tool := range tools {
		toolMap, ok := tool.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("tool must be a map")
		}

		name, _ := toolMap["name"].(string)
		description, _ := toolMap["description"].(string)
		schema, _ := toolMap["input_schema"].(map[string]interface{})

		if name == "" {
			return nil, fmt.Errorf("tool must have a name")
		}

		result = append(result, Tool{
			Name:        name,
			Description: description,
			InputSchema: schema,
		})
	}

	return result, nil
}

// makeRequest makes an HTTP request to Anthropic API
func (c *AnthropicClientImpl) makeRequest(ctx context.Context, req Request) (*Response, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/messages", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", DefaultAPIVersion)

	httpResp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer httpResp.Body.Close()

	body, err := io.ReadAll(httpResp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if httpResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API error %d: %s", httpResp.StatusCode, string(body))
	}

	var resp Response
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	return &resp, nil
}
