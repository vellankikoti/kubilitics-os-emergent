package cli

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/kubilitics/kcli/internal/ai"
	"github.com/kubilitics/kcli/internal/runner"
	"github.com/kubilitics/kcli/internal/ui"
	"github.com/kubilitics/kcli/internal/version"
	"github.com/spf13/cobra"
)

type app struct {
	force             bool
	context           string
	namespace         string
	aiTimeout         time.Duration
	completionTimeout time.Duration
	cacheMu           sync.Mutex
	cache             map[string]cacheEntry
}

func NewRootCommand() *cobra.Command {
	a := &app{
		aiTimeout:         8 * time.Second,
		completionTimeout: 250 * time.Millisecond,
		cache:             initCache(),
	}

	cmd := &cobra.Command{
		Use:           "kcli",
		Short:         "Unified Kubernetes command interface for Kubilitics",
		Long:          "kcli brings kubectl parity, context/namespace ergonomics, observability shortcuts, incident mode, and optional AI in one CLI.",
		SilenceUsage:  true,
		SilenceErrors: true,
		Version:       version.Version,
	}

	cmd.PersistentFlags().BoolVar(&a.force, "force", false, "skip safety confirmations for mutating commands")
	cmd.PersistentFlags().StringVar(&a.context, "context", "", "override kubectl context")
	cmd.PersistentFlags().StringVarP(&a.namespace, "namespace", "n", "", "override namespace")
	cmd.PersistentFlags().DurationVar(&a.aiTimeout, "ai-timeout", 8*time.Second, "AI request timeout")
	cmd.PersistentFlags().DurationVar(&a.completionTimeout, "completion-timeout", 250*time.Millisecond, "timeout for completion lookups")

	cmd.AddCommand(
		newKubectlVerbCmd(a, "get", "Get resources", "g"),
		newKubectlVerbCmd(a, "describe", "Describe resources", "desc"),
		newKubectlVerbCmd(a, "apply", "Apply configuration to a resource", "ap"),
		newKubectlVerbCmd(a, "delete", "Delete resources", "del"),
		newKubectlVerbCmd(a, "logs", "Print container logs"),
		newKubectlVerbCmd(a, "exec", "Execute command in a container"),
		newKubectlVerbCmd(a, "port-forward", "Forward one or more local ports to a pod"),
		newKubectlVerbCmd(a, "top", "Display resource usage"),
		newKubectlVerbCmd(a, "rollout", "Manage rollout of resources"),
		newKubectlVerbCmd(a, "diff", "Diff live and local objects"),
		newKubectlVerbCmd(a, "explain", "Show documentation for resource fields"),
		newKubectlVerbCmd(a, "wait", "Wait for a specific condition"),
		newKubectlVerbCmd(a, "scale", "Set a new size for a workload"),
		newKubectlVerbCmd(a, "patch", "Update fields of a resource"),
		newKubectlVerbCmd(a, "label", "Update labels on a resource"),
		newKubectlVerbCmd(a, "annotate", "Update annotations on a resource"),
		newAuthCmd(a),
		newContextCmd(a),
		newNamespaceCmd(a),
		newSearchCmd(a),
		newPluginCmd(),
		newMetricsCmd(a),
		newRestartsCmd(a),
		newInstabilityCmd(a),
		newEventsCmd(a),
		newIncidentCmd(a),
		newUICmd(a),
		newAICmd(a),
		newWhyCmd(a),
		newSummarizeCmd(a),
		newSuggestCmd(a),
		newCompletionCmd(cmd),
	)

	cmd.SetVersionTemplate("kcli {{.Version}}\n")
	cmd.SetHelpCommandGroupID("core")

	cmd.AddGroup(
		&cobra.Group{ID: "core", Title: "Core Kubernetes:"},
		&cobra.Group{ID: "workflow", Title: "Workflow:"},
		&cobra.Group{ID: "observability", Title: "Observability:"},
		&cobra.Group{ID: "incident", Title: "Incident Response:"},
		&cobra.Group{ID: "ai", Title: "AI:"},
	)

	cmd.PersistentPreRunE = func(cmd *cobra.Command, _ []string) error {
		if strings.TrimSpace(a.context) == "-" {
			return fmt.Errorf("--context '-' is not valid; use 'kcli ctx -' to switch to previous context")
		}
		return nil
	}

	cmd.SetErrPrefix("kcli: ")
	cmd.SetOut(os.Stdout)
	cmd.SetErr(os.Stderr)
	return cmd
}

func IsBuiltinFirstArg(name string) bool {
	switch strings.TrimSpace(name) {
	case "":
		return true
	case "get", "g", "describe", "desc", "apply", "ap", "delete", "del", "logs", "exec", "port-forward", "top",
		"rollout", "diff", "explain", "wait", "scale", "patch", "label", "annotate", "auth",
		"ctx", "ns", "search", "plugin", "metrics", "restarts", "instability", "events", "incident", "ui",
		"ai", "why", "summarize", "suggest", "help", "completion", "version":
		return true
	default:
		return false
	}
}

func (a *app) uiOptions() ui.Options {
	opts := ui.Options{
		Context:   a.context,
		Namespace: a.namespace,
		AIEnabled: a.aiClient().Enabled(),
	}
	if a.aiClient().Enabled() {
		opts.AIFunc = func(target string) (string, error) {
			return a.aiClient().Analyze(context.Background(), "why", target)
		}
	}
	return opts
}

func (a *app) scopedArgs() []string {
	args := make([]string, 0, 4)
	if a.context != "" {
		args = append(args, "--context", a.context)
	}
	if a.namespace != "" {
		args = append(args, "-n", a.namespace)
	}
	return args
}

func (a *app) runKubectl(args []string) error {
	full := a.scopeArgsFor(args)
	return runner.RunKubectl(full, runner.ExecOptions{Force: a.force})
}

func (a *app) captureKubectl(args []string) (string, error) {
	full := a.scopeArgsFor(args)
	return runner.CaptureKubectl(full)
}

func (a *app) captureKubectlWithTimeout(args []string, timeout time.Duration) (string, error) {
	full := a.scopeArgsFor(args)
	return runner.CaptureKubectlWithTimeout(full, timeout)
}

func (a *app) scopeArgsFor(args []string) []string {
	out := make([]string, 0, len(args)+4)
	if a.context != "" && !hasContextFlag(args) {
		out = append(out, "--context", a.context)
	}
	if a.namespace != "" && !hasNamespaceFlag(args) && !hasAllNamespacesFlag(args) {
		out = append(out, "-n", a.namespace)
	}
	out = append(out, args...)
	return out
}

func (a *app) aiClient() *ai.Client {
	return ai.NewFromEnv(a.aiTimeout)
}

func hasContextFlag(args []string) bool {
	for i := 0; i < len(args); i++ {
		a := strings.TrimSpace(args[i])
		if a == "--context" {
			return true
		}
		if strings.HasPrefix(a, "--context=") {
			return true
		}
	}
	return false
}

func hasAllNamespacesFlag(args []string) bool {
	for i := 0; i < len(args); i++ {
		a := strings.TrimSpace(args[i])
		if a == "-A" || a == "--all-namespaces" {
			return true
		}
	}
	return false
}
