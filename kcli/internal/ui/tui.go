package ui

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
)

type Pod struct {
	Namespace string
	Name      string
	Status    string
}

type Options struct {
	Context   string
	Namespace string
	AIEnabled bool
	AIFunc    func(target string) (string, error)
}

type model struct {
	opts        Options
	pods        []Pod
	filtered    []Pod
	selected    int
	filtering   bool
	filterInput textinput.Model
	detail      string
	err         string
}

type podsLoadedMsg struct {
	pods []Pod
	err  error
}

type detailLoadedMsg struct {
	detail string
	err    error
}

func Run(opts Options) error {
	m := initialModel(opts)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()
	return err
}

func initialModel(opts Options) model {
	ti := textinput.New()
	ti.Placeholder = "filter pods"
	ti.CharLimit = 128
	ti.Width = 40
	return model{opts: opts, filterInput: ti}
}

func (m model) Init() tea.Cmd { return loadPodsCmd(m.opts) }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if m.filtering {
			switch msg.String() {
			case "esc", "enter":
				m.filtering = false
				m.applyFilter()
				return m, nil
			default:
				var cmd tea.Cmd
				m.filterInput, cmd = m.filterInput.Update(msg)
				m.applyFilter()
				return m, cmd
			}
		}
		switch msg.String() {
		case "ctrl+c", "q":
			return m, tea.Quit
		case "r":
			return m, loadPodsCmd(m.opts)
		case "up", "k":
			if m.selected > 0 {
				m.selected--
			}
		case "down", "j":
			if m.selected < len(m.filtered)-1 {
				m.selected++
			}
		case "/":
			m.filtering = true
			m.filterInput.Focus()
			return m, textinput.Blink
		case "y":
			if p, ok := m.currentPod(); ok {
				return m, detailCmd(m.opts, []string{"get", "pod", p.Name, "-n", p.Namespace, "-o", "yaml"})
			}
		case "l":
			if p, ok := m.currentPod(); ok {
				return m, detailCmd(m.opts, []string{"logs", p.Name, "-n", p.Namespace, "--tail=150"})
			}
		case "d":
			if p, ok := m.currentPod(); ok {
				return m, detailCmd(m.opts, []string{"describe", "pod", p.Name, "-n", p.Namespace})
			}
		case "A":
			if p, ok := m.currentPod(); ok {
				if m.opts.AIFunc == nil {
					m.detail = "AI is disabled. Set KCLI_AI_ENDPOINT to enable."
					return m, nil
				}
				return m, aiCmd(m.opts, p.Namespace+"/"+p.Name)
			}
		}
		return m, nil
	case podsLoadedMsg:
		if msg.err != nil {
			m.err = msg.err.Error()
			return m, nil
		}
		m.pods = msg.pods
		m.filtered = msg.pods
		if m.selected >= len(m.filtered) {
			m.selected = max(0, len(m.filtered)-1)
		}
		if len(m.filtered) > 0 && m.detail == "" {
			m.detail = "Press l for logs, d for describe, y for YAML, A for AI analysis"
		}
		m.err = ""
		return m, nil
	case detailLoadedMsg:
		if msg.err != nil {
			m.detail = "Error: " + msg.err.Error()
			return m, nil
		}
		m.detail = msg.detail
		return m, nil
	}
	return m, nil
}

func (m model) View() string {
	var b strings.Builder
	b.WriteString("kcli ui  •  / filter  •  y YAML  •  l logs  •  d describe  •  A AI  •  r refresh  •  q quit\n\n")
	if m.filtering {
		b.WriteString("Filter: " + m.filterInput.View() + "\n\n")
	}
	if m.err != "" {
		b.WriteString("Error loading pods: " + m.err + "\n\n")
	}
	b.WriteString("Pods\n")
	if len(m.filtered) == 0 {
		b.WriteString("  (no pods)\n")
	} else {
		for i, p := range m.filtered {
			prefix := "  "
			if i == m.selected {
				prefix = "> "
			}
			b.WriteString(fmt.Sprintf("%s%s/%s [%s]\n", prefix, p.Namespace, p.Name, p.Status))
		}
	}
	b.WriteString("\nDetails\n")
	if strings.TrimSpace(m.detail) == "" {
		b.WriteString("  (select a pod and press l/d/y/A)\n")
	} else {
		detail := m.detail
		if len(detail) > 12000 {
			detail = detail[:12000] + "\n... output truncated ..."
		}
		b.WriteString(detail)
		if !strings.HasSuffix(detail, "\n") {
			b.WriteString("\n")
		}
	}
	return b.String()
}

func (m *model) applyFilter() {
	needle := strings.ToLower(strings.TrimSpace(m.filterInput.Value()))
	if needle == "" {
		m.filtered = append([]Pod(nil), m.pods...)
		m.selected = min(m.selected, max(0, len(m.filtered)-1))
		return
	}
	out := make([]Pod, 0, len(m.pods))
	for _, p := range m.pods {
		key := strings.ToLower(p.Namespace + "/" + p.Name + " " + p.Status)
		if strings.Contains(key, needle) {
			out = append(out, p)
		}
	}
	m.filtered = out
	if m.selected >= len(m.filtered) {
		m.selected = max(0, len(m.filtered)-1)
	}
}

func (m model) currentPod() (Pod, bool) {
	if len(m.filtered) == 0 || m.selected < 0 || m.selected >= len(m.filtered) {
		return Pod{}, false
	}
	return m.filtered[m.selected], true
}

func loadPodsCmd(opts Options) tea.Cmd {
	return func() tea.Msg {
		args := []string{"get", "pods", "-A", "--no-headers"}
		if opts.Namespace != "" {
			args = []string{"get", "pods", "-n", opts.Namespace, "--no-headers"}
		}
		out, err := runKubectl(opts, args)
		if err != nil {
			return podsLoadedMsg{err: err}
		}
		lines := strings.Split(strings.TrimSpace(out), "\n")
		pods := make([]Pod, 0, len(lines))
		for _, ln := range lines {
			ln = strings.TrimSpace(ln)
			if ln == "" {
				continue
			}
			fields := strings.Fields(ln)
			if len(fields) < 4 {
				continue
			}
			// with -A: NAMESPACE NAME READY STATUS ...
			ns, name, status := fields[0], fields[1], fields[3]
			if opts.Namespace != "" {
				// without -A: NAME READY STATUS ...
				ns, name, status = opts.Namespace, fields[0], fields[2]
			}
			pods = append(pods, Pod{Namespace: ns, Name: name, Status: status})
		}
		return podsLoadedMsg{pods: pods}
	}
}

func detailCmd(opts Options, args []string) tea.Cmd {
	return func() tea.Msg {
		out, err := runKubectl(opts, args)
		if err != nil {
			return detailLoadedMsg{err: err}
		}
		return detailLoadedMsg{detail: out}
	}
}

func aiCmd(opts Options, target string) tea.Cmd {
	return func() tea.Msg {
		if opts.AIFunc == nil {
			return detailLoadedMsg{detail: "AI is disabled. Set KCLI_AI_ENDPOINT to enable."}
		}
		res, err := opts.AIFunc(target)
		if err != nil {
			return detailLoadedMsg{err: err}
		}
		return detailLoadedMsg{detail: res}
	}
}

func runKubectl(opts Options, args []string) (string, error) {
	full := make([]string, 0, len(args)+4)
	if opts.Context != "" {
		full = append(full, "--context", opts.Context)
	}
	full = append(full, args...)
	cmd := exec.Command("kubectl", full...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return string(out), fmt.Errorf("%w\n%s", err, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
