package rest

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/tools/remotecommand"

	"github.com/kubilitics/kubilitics-backend/internal/pkg/validate"
)

var execUpgrader = websocket.Upgrader{
	CheckOrigin:     func(r *http.Request) bool { return true },
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
}

const (
	wsMsgStdin  = "stdin"
	wsMsgResize = "resize"
	wsMsgStdout = "stdout"
	wsMsgStderr = "stderr"
	wsMsgExit   = "exit"
	wsMsgError  = "error"
)

type wsInMessage struct {
	T string         `json:"t"`
	D string         `json:"d,omitempty"`
	R *resizePayload `json:"r,omitempty"`
}

type resizePayload struct {
	Rows uint16 `json:"rows"`
	Cols uint16 `json:"cols"`
}

type wsOutMessage struct {
	T string `json:"t"`
	D string `json:"d,omitempty"`
}

type sizeQueue struct {
	ch  chan *remotecommand.TerminalSize
	ctx context.Context
}

func (q *sizeQueue) Next() *remotecommand.TerminalSize {
	select {
	case s := <-q.ch:
		return s
	case <-q.ctx.Done():
		return nil
	}
}

func (q *sizeQueue) push(cols, rows uint16) {
	select {
	case q.ch <- &remotecommand.TerminalSize{Width: cols, Height: rows}:
	default:
	}
}

type chanWriter struct {
	ch  chan<- wsOutMessage
	typ string
}

func (w *chanWriter) Write(p []byte) (n int, err error) {
	if len(p) == 0 {
		return 0, nil
	}
	d := base64.StdEncoding.EncodeToString(p)
	select {
	case w.ch <- wsOutMessage{T: w.typ, D: d}:
	default:
	}
	return len(p), nil
}

// GetPodExec handles GET /clusters/{clusterId}/pods/{namespace}/{name}/exec
// Upgrades to WebSocket and runs an interactive shell (exec) in the pod container.
// Query: container=..., shell=/bin/sh (default).
// Protocol: Client -> Server: {"t":"stdin","d":"<base64>"} | {"t":"resize","r":{"rows":N,"cols":M}}
// Server -> Client: {"t":"stdout","d":"<base64>"} | {"t":"stderr","d":"<base64>"} | {"t":"exit"} | {"t":"error","d":"msg"}
func (h *Handler) GetPodExec(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clusterID := vars["clusterId"]
	namespace := vars["namespace"]
	name := vars["name"]
	if !validate.ClusterID(clusterID) || !validate.Namespace(namespace) || !validate.Name(name) {
		respondError(w, http.StatusBadRequest, "Invalid clusterId, namespace, or pod name")
		return
	}

	resolvedID, err := h.resolveClusterID(r.Context(), clusterID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	container := r.URL.Query().Get("container")
	shell := r.URL.Query().Get("shell")
	if shell == "" {
		shell = "/bin/sh"
	}

	client, err := h.clusterService.GetClient(resolvedID)
	if err != nil {
		respondError(w, http.StatusNotFound, err.Error())
		return
	}

	conn, err := execUpgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	sendWSError := func(msg string) {
		_ = conn.WriteJSON(wsOutMessage{T: wsMsgError, D: msg})
	}

	pod, err := client.Clientset.CoreV1().Pods(namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		sendWSError("pod not found or not accessible: " + err.Error())
		return
	}
	if container == "" {
		if len(pod.Spec.Containers) == 1 {
			container = pod.Spec.Containers[0].Name
		} else {
			names := make([]string, 0, len(pod.Spec.Containers))
			for _, c := range pod.Spec.Containers {
				names = append(names, c.Name)
			}
			sendWSError("container query is required when pod has multiple containers. Valid: " + strings.Join(names, ", "))
			return
		}
	} else {
		found := false
		for _, c := range pod.Spec.Containers {
			if c.Name == container {
				found = true
				break
			}
		}
		if !found {
			names := make([]string, 0, len(pod.Spec.Containers))
			for _, c := range pod.Spec.Containers {
				names = append(names, c.Name)
			}
			sendWSError(fmt.Sprintf("container %q not found in pod. Valid: %s", container, strings.Join(names, ", ")))
			return
		}
	}

	stdinR, stdinW := io.Pipe()
	defer func() { _ = stdinW.Close() }()

	outChan := make(chan wsOutMessage, 64)
	execDone := make(chan struct{})

	sizeCh := make(chan *remotecommand.TerminalSize, 4)
	sq := &sizeQueue{ch: sizeCh, ctx: ctx}
	sq.push(80, 24)

	defer func() {
		<-execDone
		time.Sleep(50 * time.Millisecond)
		close(outChan)
	}()

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
	stderrW := &chanWriter{ch: outChan, typ: wsMsgStderr}

	req := client.Clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Namespace(namespace).
		Name(name).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   []string{shell},
			Stdin:     true,
			Stdout:    true,
			Stderr:    true,
			TTY:       true,
		}, scheme.ParameterCodec)

	executor, err := remotecommand.NewSPDYExecutor(client.Config, "POST", req.URL())
	if err != nil {
		close(execDone)
		_ = conn.WriteJSON(wsOutMessage{T: wsMsgError, D: "Failed to create executor: " + err.Error()})
		return
	}

	go func() {
		defer close(execDone)
		err := executor.StreamWithContext(ctx, remotecommand.StreamOptions{
			Stdin:             stdinR,
			Stdout:            stdoutW,
			Stderr:            stderrW,
			Tty:               true,
			TerminalSizeQueue: sq,
		})
		if err != nil {
			select {
			case outChan <- wsOutMessage{T: wsMsgError, D: err.Error()}:
			default:
			}
		}
		select {
		case outChan <- wsOutMessage{T: wsMsgExit}:
		default:
		}
	}()

	conn.SetReadLimit(1 << 16)
	for {
		_, data, err := conn.ReadMessage()
		if err != nil {
			cancel()
			_ = stdinW.Close()
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
					_, _ = stdinW.Write(dec)
				}
			}
		case wsMsgResize:
			if msg.R != nil && msg.R.Rows > 0 && msg.R.Cols > 0 {
				sq.push(msg.R.Cols, msg.R.Rows)
			}
		}
	}
}
