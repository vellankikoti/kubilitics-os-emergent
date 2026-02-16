package cli

import (
	"context"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func newAICmd(a *app) *cobra.Command {
	cmd := &cobra.Command{
		Use:     "ai",
		Short:   "AI-assisted analysis commands (optional)",
		GroupID: "ai",
	}
	cmd.AddCommand(
		newAIActionCmd(a, "explain", "Explain a Kubernetes resource", "explain"),
		newAIActionCmd(a, "why", "Explain probable cause behind current state", "why"),
		newAIActionCmd(a, "summarize-events", "Summarize recent events", "summarize-events"),
		newAIActionCmd(a, "suggest-fix", "Suggest remediation for a workload", "suggest-fix"),
	)
	return cmd
}

func newWhyCmd(a *app) *cobra.Command {
	return newAIActionCmd(a, "why", "AI why-analysis for a resource", "why")
}

func newSummarizeCmd(a *app) *cobra.Command {
	cmd := &cobra.Command{Use: "summarize", Short: "AI summarize commands", GroupID: "ai"}
	cmd.AddCommand(newAIActionCmd(a, "events [resource]", "Summarize events", "summarize-events"))
	return cmd
}

func newSuggestCmd(a *app) *cobra.Command {
	cmd := &cobra.Command{Use: "suggest", Short: "AI suggestion commands", GroupID: "ai"}
	cmd.AddCommand(newAIActionCmd(a, "fix [resource]", "Suggest fix", "suggest-fix"))
	return cmd
}

func newAIActionCmd(a *app, use, short, action string) *cobra.Command {
	return &cobra.Command{
		Use:     use,
		Short:   short,
		GroupID: "ai",
		Args:    cobra.ArbitraryArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			client := a.aiClient()
			if !client.Enabled() {
				fmt.Fprintln(cmd.OutOrStdout(), "AI disabled. Set KCLI_AI_ENDPOINT to enable.")
				return nil
			}
			target := strings.TrimSpace(strings.Join(args, " "))
			ctx, cancel := context.WithTimeout(cmd.Context(), a.aiTimeout)
			defer cancel()
			res, err := client.Analyze(ctx, action, target)
			if err != nil {
				fmt.Fprintf(cmd.ErrOrStderr(), "AI unavailable (%v). Continuing without AI output.\n", err)
				return nil
			}
			fmt.Fprintln(cmd.OutOrStdout(), res)
			return nil
		},
	}
}
