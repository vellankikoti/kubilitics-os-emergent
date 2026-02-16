package autonomy

// Package autonomy — concrete AutonomyController implementation.

import (
	"context"
	"fmt"
	"strings"
	"sync"
)

// operationRisk maps operations to their minimum required autonomy level.
// Higher level = more trusted / less approval needed.
var operationRisk = map[string]struct {
	minLevel  AutonomyLevel
	riskLevel string
}{
	"restart":       {LevelRecommend, "low"},
	"delete_pod":    {LevelRecommend, "low"},
	"scale":         {LevelPropose, "medium"},
	"rollback":      {LevelPropose, "medium"},
	"update_limits": {LevelPropose, "medium"},
	"cordon":        {LevelPropose, "medium"},
	"patch":         {LevelActWithGuard, "medium"},
	"hpa_scale":     {LevelActWithGuard, "high"},
	"drain":         {LevelActWithGuard, "high"},
	"delete":        {LevelFullAutonomous, "high"},
}

type autonomyControllerImpl struct {
	mu            sync.RWMutex
	userLevels    map[string]AutonomyLevel
	defaultLevel  AutonomyLevel
	pendingApprovals map[string]interface{}
}

// NewAutonomyController creates a new autonomy controller.
func NewAutonomyController() AutonomyController {
	return &autonomyControllerImpl{
		userLevels:       make(map[string]AutonomyLevel),
		defaultLevel:     LevelRecommend, // Default: semi-autonomous
		pendingApprovals: make(map[string]interface{}),
	}
}

func (c *autonomyControllerImpl) SetAutonomyLevel(_ context.Context, userID string, level AutonomyLevel) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.userLevels[userID] = level
	return nil
}

func (c *autonomyControllerImpl) GetAutonomyLevel(_ context.Context, userID string) (AutonomyLevel, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if level, ok := c.userLevels[userID]; ok {
		return level, nil
	}
	return c.defaultLevel, nil
}

func (c *autonomyControllerImpl) DetermineApprovalRequired(ctx context.Context, userID string, action interface{}) (bool, string, error) {
	userLevel, err := c.GetAutonomyLevel(ctx, userID)
	if err != nil {
		return true, "Could not determine user autonomy level", err
	}

	op := extractOperation(action)
	if op == "" {
		return false, "", nil
	}

	rule, ok := operationRisk[strings.ToLower(op)]
	if !ok {
		// Unknown operation — require approval to be safe
		return true, fmt.Sprintf("Unknown operation '%s' requires explicit approval", op), nil
	}

	if userLevel < rule.minLevel {
		return true, fmt.Sprintf("Operation '%s' requires autonomy level %d, current level %d — human approval needed",
			op, rule.minLevel, userLevel), nil
	}

	return false, "", nil
}

func (c *autonomyControllerImpl) ApproveAction(_ context.Context, userID string, actionID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.pendingApprovals, actionID)
	return nil
}

func (c *autonomyControllerImpl) RejectAction(_ context.Context, userID string, actionID string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.pendingApprovals, actionID)
	return nil
}

func (c *autonomyControllerImpl) CanExecuteTool(ctx context.Context, userID string, toolName string) (bool, error) {
	userLevel, err := c.GetAutonomyLevel(ctx, userID)
	if err != nil {
		return false, err
	}
	// Observation and analysis tools are always available
	// Execution tools require at least Level 2
	if strings.HasPrefix(toolName, "restart_") || strings.HasPrefix(toolName, "analyze_") || strings.HasPrefix(toolName, "list_") {
		return true, nil
	}
	return userLevel >= LevelRecommend, nil
}

func (c *autonomyControllerImpl) AssessRisk(_ context.Context, action interface{}) (string, []string, error) {
	op := extractOperation(action)
	rule, ok := operationRisk[strings.ToLower(op)]
	if !ok {
		return "unknown", []string{"unknown operation"}, nil
	}
	factors := []string{fmt.Sprintf("operation '%s' has inherent risk level: %s", op, rule.riskLevel)}
	return rule.riskLevel, factors, nil
}

func (c *autonomyControllerImpl) GetApprovalPending(_ context.Context, userID string) ([]interface{}, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	result := make([]interface{}, 0)
	for _, v := range c.pendingApprovals {
		result = append(result, v)
	}
	return result, nil
}

func (c *autonomyControllerImpl) GetAutonomyDescription(_ context.Context, level AutonomyLevel) (string, error) {
	descriptions := map[AutonomyLevel]string{
		LevelObserve:        "Observe: Observe only, no actions allowed",
		LevelRecommend:      "Recommend: Safe actions auto-executed (restarts), risky ones require approval",
		LevelPropose:        "Propose: Scale/rollback auto-executed, destructive actions need approval",
		LevelActWithGuard:   "Act with Guard: Most actions auto-executed, drain/delete need approval",
		LevelFullAutonomous: "Full Autonomous: All approved actions executed automatically (use with caution)",
	}
	desc, ok := descriptions[level]
	if !ok {
		return "", fmt.Errorf("unknown autonomy level: %d", level)
	}
	return desc, nil
}

func extractOperation(action interface{}) string {
	if m, ok := action.(map[string]interface{}); ok {
		if op, ok := m["operation"].(string); ok {
			return op
		}
	}
	return ""
}
