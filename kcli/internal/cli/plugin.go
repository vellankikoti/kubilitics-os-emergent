package cli

import (
	"fmt"

	"github.com/kubilitics/kcli/internal/plugin"
	"github.com/spf13/cobra"
)

func newPluginCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "plugin",
		Short:   "Manage and run kcli plugins",
		GroupID: "workflow",
	}
	cmd.AddCommand(
		&cobra.Command{
			Use:   "list",
			Short: "List installed plugins",
			RunE: func(cmd *cobra.Command, _ []string) error {
				plugins, err := plugin.Discover()
				if err != nil {
					return err
				}
				for _, p := range plugins {
					fmt.Fprintln(cmd.OutOrStdout(), p)
				}
				return nil
			},
		},
		&cobra.Command{
			Use:   "run <name> [args...]",
			Short: "Run a plugin by name",
			Args:  cobra.MinimumNArgs(1),
			RunE: func(_ *cobra.Command, args []string) error {
				return plugin.Run(args[0], args[1:])
			},
		},
	)
	return cmd
}
