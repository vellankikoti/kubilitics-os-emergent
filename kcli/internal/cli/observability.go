package cli

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

type k8sEventList struct {
	Items []k8sEvent `json:"items"`
}

type k8sEvent struct {
	Type      string `json:"type"`
	Reason    string `json:"reason"`
	Message   string `json:"message"`
	Count     int    `json:"count"`
	EventTime string `json:"eventTime"`

	FirstTimestamp string `json:"firstTimestamp"`
	LastTimestamp  string `json:"lastTimestamp"`

	InvolvedObject struct {
		Kind      string `json:"kind"`
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"involvedObject"`

	Metadata struct {
		Name              string `json:"name"`
		Namespace         string `json:"namespace"`
		CreationTimestamp string `json:"creationTimestamp"`
	} `json:"metadata"`
}

type eventRecord struct {
	Timestamp time.Time `json:"timestamp"`
	Type      string    `json:"type"`
	Namespace string    `json:"namespace"`
	Object    string    `json:"object"`
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	Count     int       `json:"count,omitempty"`
}

func newMetricsCmd(a *app) *cobra.Command {
	return &cobra.Command{
		Use:                "metrics [resource]",
		Short:              "Top/metrics view for resources",
		GroupID:            "observability",
		DisableFlagParsing: true,
		RunE: func(_ *cobra.Command, args []string) error {
			if len(args) == 0 {
				return a.runKubectl([]string{"top", "pods", "-A"})
			}
			return a.runKubectl(append([]string{"top"}, args...))
		},
	}
}

func newRestartsCmd(a *app) *cobra.Command {
	return &cobra.Command{
		Use:     "restarts",
		Short:   "List pods sorted by restart count",
		GroupID: "observability",
		RunE: func(_ *cobra.Command, _ []string) error {
			return a.runKubectl([]string{
				"get", "pods", "-A",
				"--sort-by=.status.containerStatuses[0].restartCount",
				"-o", "custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,PHASE:.status.phase,RESTARTS:.status.containerStatuses[0].restartCount,AGE:.metadata.creationTimestamp",
			})
		},
	}
}

func newInstabilityCmd(a *app) *cobra.Command {
	return &cobra.Command{
		Use:     "instability",
		Short:   "Quick instability snapshot (restarts + warning events)",
		GroupID: "observability",
		RunE: func(cmd *cobra.Command, _ []string) error {
			fmt.Fprintln(cmd.OutOrStdout(), "== Restart Leaders ==")
			if err := a.runKubectl([]string{
				"get", "pods", "-A",
				"--sort-by=.status.containerStatuses[0].restartCount",
				"-o", "custom-columns=NAMESPACE:.metadata.namespace,NAME:.metadata.name,RESTARTS:.status.containerStatuses[0].restartCount,STATUS:.status.phase",
			}); err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "\n== Recent Warning Events ==")
			records, err := fetchEvents(a)
			if err != nil {
				return err
			}
			warnings := make([]eventRecord, 0, len(records))
			for _, r := range records {
				if strings.EqualFold(r.Type, "Warning") {
					warnings = append(warnings, r)
				}
			}
			sort.SliceStable(warnings, func(i, j int) bool {
				return warnings[i].Timestamp.After(warnings[j].Timestamp)
			})
			if len(warnings) > 25 {
				warnings = warnings[:25]
			}
			printEventTable(cmd, warnings)
			return nil
		},
	}
}

func newEventsCmd(a *app) *cobra.Command {
	var recent string
	var output string
	cmd := &cobra.Command{
		Use:     "events",
		Short:   "View cluster events",
		GroupID: "observability",
		RunE: func(c *cobra.Command, _ []string) error {
			records, err := fetchEvents(a)
			if err != nil {
				return err
			}
			if strings.TrimSpace(recent) != "" {
				d, err := time.ParseDuration(strings.TrimSpace(recent))
				if err != nil {
					return fmt.Errorf("invalid --recent value %q: %w", recent, err)
				}
				records = filterEventsByRecent(records, d, time.Now())
			}
			sort.SliceStable(records, func(i, j int) bool {
				return records[i].Timestamp.After(records[j].Timestamp)
			})
			switch strings.ToLower(strings.TrimSpace(output)) {
			case "table", "":
				printEventTable(c, records)
				return nil
			case "json":
				return printEventsJSON(c, records)
			default:
				return fmt.Errorf("unsupported --output %q (supported: table, json)", output)
			}
		},
	}
	cmd.Flags().StringVar(&recent, "recent", "", "only show events within this duration window (e.g. 30m, 2h)")
	cmd.Flags().StringVar(&output, "output", "table", "output format: table|json")
	return cmd
}

func fetchEvents(a *app) ([]eventRecord, error) {
	out, err := a.captureKubectl([]string{"get", "events", "-A", "-o", "json"})
	if err != nil {
		return nil, err
	}
	var list k8sEventList
	if err := json.Unmarshal([]byte(out), &list); err != nil {
		return nil, fmt.Errorf("failed to parse events JSON: %w", err)
	}
	records := make([]eventRecord, 0, len(list.Items))
	for _, item := range list.Items {
		ts := parseEventTime(item)
		ns := strings.TrimSpace(item.InvolvedObject.Namespace)
		if ns == "" {
			ns = strings.TrimSpace(item.Metadata.Namespace)
		}
		obj := strings.TrimSpace(item.InvolvedObject.Kind + "/" + item.InvolvedObject.Name)
		if obj == "/" {
			obj = "-"
		}
		records = append(records, eventRecord{
			Timestamp: ts,
			Type:      strings.TrimSpace(item.Type),
			Namespace: ns,
			Object:    obj,
			Reason:    strings.TrimSpace(item.Reason),
			Message:   strings.TrimSpace(item.Message),
			Count:     item.Count,
		})
	}
	return records, nil
}

func parseEventTime(e k8sEvent) time.Time {
	candidates := []string{e.LastTimestamp, e.EventTime, e.FirstTimestamp, e.Metadata.CreationTimestamp}
	for _, raw := range candidates {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		if t, err := time.Parse(time.RFC3339, raw); err == nil {
			return t
		}
	}
	return time.Time{}
}

func filterEventsByRecent(records []eventRecord, window time.Duration, now time.Time) []eventRecord {
	if window <= 0 {
		return records
	}
	cutoff := now.Add(-window)
	out := make([]eventRecord, 0, len(records))
	for _, r := range records {
		if !r.Timestamp.IsZero() && r.Timestamp.Before(cutoff) {
			continue
		}
		out = append(out, r)
	}
	return out
}

func printEventTable(cmd *cobra.Command, records []eventRecord) {
	if len(records) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No events found.")
		return
	}
	fmt.Fprintf(cmd.OutOrStdout(), "%-20s %-8s %-18s %-30s %-18s %s\n", "TIME", "TYPE", "NAMESPACE", "OBJECT", "REASON", "MESSAGE")
	for _, r := range records {
		ts := "-"
		if !r.Timestamp.IsZero() {
			ts = r.Timestamp.Format("2006-01-02 15:04:05")
		}
		msg := r.Message
		if len(msg) > 120 {
			msg = msg[:117] + "..."
		}
		fmt.Fprintf(
			cmd.OutOrStdout(),
			"%-20s %-8s %-18s %-30s %-18s %s\n",
			ts,
			emptyDash(r.Type),
			emptyDash(r.Namespace),
			truncateCell(r.Object, 30),
			truncateCell(r.Reason, 18),
			msg,
		)
	}
}

func printEventsJSON(cmd *cobra.Command, records []eventRecord) error {
	b, err := json.MarshalIndent(records, "", "  ")
	if err != nil {
		return err
	}
	fmt.Fprintln(cmd.OutOrStdout(), string(b))
	return nil
}

func truncateCell(v string, limit int) string {
	if len(v) <= limit {
		return emptyDash(v)
	}
	if limit <= 3 {
		return v[:limit]
	}
	return v[:limit-3] + "..."
}

func emptyDash(v string) string {
	if strings.TrimSpace(v) == "" {
		return "-"
	}
	return v
}
