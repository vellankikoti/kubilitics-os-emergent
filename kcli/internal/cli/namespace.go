package cli

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

func newNamespaceCmd(a *app) *cobra.Command {
	var list bool
	cmd := &cobra.Command{
		Use:     "ns [name]",
		Short:   "Get or set namespace for the current context",
		GroupID: "workflow",
		Args:    cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if list {
				return a.runKubectl([]string{"get", "namespaces"})
			}
			if len(args) == 0 {
				out, err := a.captureKubectl([]string{"config", "view", "--minify", "-o", "jsonpath={..namespace}"})
				if err != nil {
					return err
				}
				ns := strings.TrimSpace(out)
				if ns == "" {
					ns = "default"
				}
				fmt.Fprintln(cmd.OutOrStdout(), ns)
				return nil
			}
			target := strings.TrimSpace(args[0])
			if target == "" {
				return fmt.Errorf("namespace cannot be empty")
			}
			if err := a.runKubectl([]string{"config", "set-context", "--current", "--namespace", target}); err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "Namespace set to %q\n", target)
			return nil
		},
	}
	cmd.Flags().BoolVarP(&list, "list", "l", false, "list namespaces")
	return cmd
}
