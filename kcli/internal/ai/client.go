package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Client struct {
	endpoint string
	apiKey   string
	http     *http.Client
}

type Request struct {
	Action string `json:"action"`
	Target string `json:"target,omitempty"`
}

type Response struct {
	Result string `json:"result"`
}

func NewFromEnv(timeout time.Duration) *Client {
	return &Client{
		endpoint: os.Getenv("KCLI_AI_ENDPOINT"),
		apiKey:   os.Getenv("KCLI_AI_API_KEY"),
		http:     &http.Client{Timeout: timeout},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.endpoint != ""
}

func (c *Client) Analyze(ctx context.Context, action, target string) (string, error) {
	if !c.Enabled() {
		return "", fmt.Errorf("ai integration disabled (set KCLI_AI_ENDPOINT)")
	}
	payload, err := json.Marshal(Request{Action: action, Target: target})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var out Response
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.Result == "" {
		out.Result = "No AI result returned"
	}
	return out.Result, nil
}
