package rest

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/kubilitics/kubilitics-backend/internal/pkg/validate"
)

var shellStreamUpgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  65536,
	WriteBufferSize: 65536,
}

// GetShellStream handles GET /clusters/{clusterId}/shell/stream
// Upgrades to WebSocket and runs an interactive PTY shell with KUBECONFIG set for the cluster.
// Protocol: same as pod exec — stdin, resize (rows/cols), stdout/stderr base64, exit, error.
// Enables full kubectl and any other CLI with zero round-trip latency per keystroke.
func (h *Handler) GetShellStream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["clusterId"]
	if !validate.ClusterID(clusterID) {
		respondError(w, http.StatusBadRequest, "Invalid clusterId")
		return
	}

	cluster, err := h.clusterService.GetCluster(r.Context(), clusterID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}
	if cluster.KubeconfigPath == "" {
		respondError(w, http.StatusBadRequest, "Cluster has no kubeconfig path")
		return
	}

	conn, err := shellStreamUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	sendErr := func(msg string) {
		_ = conn.WriteJSON(wsOutMessage{T: wsMsgError, D: msg})
	}

	shell := "/bin/bash"
	if _, err := exec.LookPath("bash"); err != nil {
		shell = "/bin/sh"
	}
	env := append(os.Environ(), "KUBECONFIG="+cluster.KubeconfigPath)
	workDir := "/tmp"
	if d, err := os.UserHomeDir(); err == nil && d != "" {
		workDir = d
	}
	// Wrapper: source kubectl completion (bash only), set context if needed, then exec interactive shell.
	// This gives native Tab completion for kubectl (e.g. kubectl get pod<Tab>).
	ctxArg := strings.ReplaceAll(cluster.Context, "'", "'\"'\"'")
	var wrapper string
	if shell == "/bin/bash" {
		wrapper = "source <(kubectl completion bash) 2>/dev/null; "
		if cluster.Context != "" {
			wrapper += "kubectl config use-context '" + ctxArg + "' 2>/dev/null; "
		}
		wrapper += "exec bash -i"
	} else {
		if cluster.Context != "" {
			wrapper = "kubectl config use-context '" + ctxArg + "' 2>/dev/null; "
		}
		wrapper += "exec sh -i"
	}
	cmd := exec.CommandContext(ctx, shell, "-c", wrapper)
	cmd.Env = env
	cmd.Dir = workDir

	ptmx, err := pty.Start(cmd)
	if err != nil {
		sendErr("Failed to start shell: " + err.Error())
		return
	}
	defer func() {
		_ = ptmx.Close()
		_ = cmd.Process.Kill()
	}()

	outChan := make(chan wsOutMessage, 128)
	execDone := make(chan struct{})
	var once sync.Once
	closeExecDone := func() { once.Do(func() { close(execDone) }) }
	defer func() {
		closeExecDone()
		<-execDone
		time.Sleep(30 * time.Millisecond)
		close(outChan)
	}()

	// Single writer goroutine: send all messages to WebSocket
	go func() {
		for m := range outChan {
			b, _ := json.Marshal(m)
			conn.SetWriteDeadline(time.Now().Add(30 * time.Second))
			if err := conn.WriteMessage(websocket.TextMessage, b); err != nil {
				return
			}
		}
	}()

	stdoutW := &chanWriter{ch: outChan, typ: wsMsgStdout}
	// PTY combines stdout+stderr into one stream; send as stdout
	go func() {
		defer closeExecDone()
		_, _ = io.Copy(stdoutW, ptmx)
		select {
		case outChan <- wsOutMessage{T: wsMsgExit}:
		default:
		}
	}()

	// Initial size
	_ = pty.Setsize(ptmx, &pty.Winsize{Cols: 80, Rows: 24})

	const readDeadline = 60 * time.Second
	const pingInterval = 30 * time.Second

	// Ping keepalive: detect dead connections when client disappears without closing
	pingDone := make(chan struct{})
	defer close(pingDone)
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-pingDone:
				return
			case <-ticker.C:
				conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	conn.SetReadLimit(1 << 20)
	for {
		conn.SetReadDeadline(time.Now().Add(readDeadline))
		_, data, err := conn.ReadMessage()
		if err != nil {
			cancel()
			_ = ptmx.Close()
			<-execDone
			return
		}

		var msg wsInMessage
		if json.Unmarshal(data, &msg) != nil {
			continue
		}

		switch msg.T {
		case wsMsgStdin:
			if msg.D != "" {
				dec, err := base64.StdEncoding.DecodeString(msg.D)
				if err == nil && len(dec) > 0 {
					_, _ = ptmx.Write(dec)
				}
			}
		case wsMsgResize:
			if msg.R != nil && msg.R.Rows > 0 && msg.R.Cols > 0 {
				_ = pty.Setsize(ptmx, &pty.Winsize{
					Cols: msg.R.Cols,
					Rows: msg.R.Rows,
				})
			}
		}
	}
}
