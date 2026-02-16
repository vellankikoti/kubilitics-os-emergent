package main

import (
	"fmt"
	"os"

	"github.com/kubilitics/kcli/internal/cli"
	"github.com/kubilitics/kcli/internal/plugin"
)

func main() {
	handled, err := plugin.TryRunForArgs(os.Args[1:], cli.IsBuiltinFirstArg)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if handled {
		return
	}

	root := cli.NewRootCommand()
	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
