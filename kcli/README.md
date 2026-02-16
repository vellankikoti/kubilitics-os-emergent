# kcli

`kcli` is the Kubilitics terminal core: kubectl-parity workflows with guardrails, context ergonomics, observability shortcuts, incident mode, and optional AI.

## Build

```bash
cd kcli
go build -o bin/kcli ./cmd/kcli
```

## Shell completion

```bash
kcli completion bash > /etc/bash_completion.d/kcli
kcli completion zsh > "${fpath[1]}/_kcli"
```

## Example usage

```bash
kcli get pods -A
kcli get pods -A --all-contexts
kcli get deploy -A --all-contexts --context-group prod
kcli search payments
kcli search api --context-group prod --kinds deployments,services,ingresses
kcli ctx
kcli ctx prod-cluster
kcli ctx group set prod prod-us-east prod-us-west
kcli ctx group prod
kcli ctx group export groups.json
kcli ctx group import groups.json --merge
kcli ns kube-system
kcli restarts
kcli events --recent 30m --output json
kcli incident
kcli incident --recent 2h --restarts-threshold 5 --output json
kcli exec -it pod/my-pod -- /bin/sh
```

## Safety model

Mutating verbs prompt for confirmation by default. Use `--force` to bypass prompt in automated workflows.

```bash
kcli delete pod my-pod
kcli --force delete pod my-pod
```

## Optional AI

Set `KCLI_AI_ENDPOINT` (and optionally `KCLI_AI_API_KEY`) to enable AI commands.

```bash
kcli ai explain deployment/my-app
kcli why pod/my-pod
kcli summarize events
kcli suggest fix deployment/my-app
```

## Interactive TUI

`kcli ui` launches the built-in Bubble Tea interface.

Keybindings:
- `/` filter pods
- `l` logs
- `d` describe
- `y` yaml
- `A` AI analyze (when enabled)
- `r` refresh
- `q` quit

## Plugins

Plugins live in `~/.kcli/plugins/` and use executable name prefix `kcli-`.

```bash
kcli plugin list
kcli plugin run mytool --flag value
```

You can also run plugins directly as first-class commands:

```bash
kcli mytool --flag value
```

## State storage

Context history and favorites are persisted in `~/.kcli/state.json`.
