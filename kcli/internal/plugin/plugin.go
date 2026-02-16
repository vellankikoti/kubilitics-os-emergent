package plugin

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

const pluginPrefix = "kcli-"

func PluginDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".kcli", "plugins"), nil
}

func Discover() ([]string, error) {
	dir, err := PluginDir()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasPrefix(name, pluginPrefix) {
			continue
		}
		pluginName := strings.TrimPrefix(name, pluginPrefix)
		if pluginName != "" {
			out = append(out, pluginName)
		}
	}
	sort.Strings(out)
	return out, nil
}

func Resolve(name string) (string, error) {
	if strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("plugin name required")
	}
	fromPath, err := exec.LookPath(pluginPrefix + name)
	if err == nil {
		return fromPath, nil
	}
	dir, derr := PluginDir()
	if derr != nil {
		return "", derr
	}
	candidate := filepath.Join(dir, pluginPrefix+name)
	st, serr := os.Stat(candidate)
	if serr != nil {
		return "", fmt.Errorf("plugin %q not found", name)
	}
	if st.Mode()&0o111 == 0 {
		return "", fmt.Errorf("plugin %q is not executable", name)
	}
	return candidate, nil
}

func Run(name string, args []string) error {
	bin, err := Resolve(name)
	if err != nil {
		return err
	}
	cmd := exec.Command(bin, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func TryRunForArgs(args []string, isBuiltinFirstArg func(string) bool) (handled bool, err error) {
	if len(args) == 0 {
		return false, nil
	}
	first := strings.TrimSpace(args[0])
	if first == "" || strings.HasPrefix(first, "-") {
		return false, nil
	}
	if isBuiltinFirstArg(first) {
		return false, nil
	}
	if rerr := Run(first, args[1:]); rerr != nil {
		if strings.Contains(rerr.Error(), "not found") {
			return false, nil
		}
		return true, rerr
	}
	return true, nil
}
