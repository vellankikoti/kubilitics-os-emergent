package cli

import "github.com/spf13/cobra"

func newKubectlVerbCmd(a *app, verb, short string, aliases ...string) *cobra.Command {
	cmd := &cobra.Command{
		Use:                verb + " [args...]",
		Short:              short,
		Aliases:            aliases,
		GroupID:            "core",
		DisableFlagParsing: true,
		RunE: func(_ *cobra.Command, args []string) error {
			if verb == "get" {
				return a.runGetWithMultiCluster(args)
			}
			full := append([]string{verb}, args...)
			return a.runKubectl(full)
		},
	}
	switch verb {
	case "get", "describe":
		cmd.ValidArgsFunction = a.completeKubectl(verb)
	}
	return cmd
}

func newAuthCmd(a *app) *cobra.Command {
	auth := &cobra.Command{
		Use:     "auth",
		Short:   "Inspect authorization",
		GroupID: "core",
	}
	auth.AddCommand(&cobra.Command{
		Use:                "can-i [args...]",
		Short:              "Check whether an action is allowed",
		DisableFlagParsing: true,
		RunE: func(_ *cobra.Command, args []string) error {
			full := append([]string{"auth", "can-i"}, args...)
			return a.runKubectl(full)
		},
	})
	return auth
}
