package cli

import (
	"testing"
	"time"
)

func TestParseEventTime(t *testing.T) {
	e := k8sEvent{}
	e.LastTimestamp = "2026-02-16T10:00:00Z"
	e.EventTime = "2026-02-16T09:00:00Z"
	got := parseEventTime(e)
	if got.IsZero() {
		t.Fatalf("expected parsed timestamp")
	}
	if got.Format(time.RFC3339) != "2026-02-16T10:00:00Z" {
		t.Fatalf("expected lastTimestamp preference, got %s", got.Format(time.RFC3339))
	}
}

func TestFilterEventsByRecent(t *testing.T) {
	now := time.Date(2026, 2, 16, 12, 0, 0, 0, time.UTC)
	records := []eventRecord{
		{Timestamp: now.Add(-10 * time.Minute), Type: "Warning", Namespace: "default", Object: "Pod/a"},
		{Timestamp: now.Add(-3 * time.Hour), Type: "Warning", Namespace: "default", Object: "Pod/b"},
		{Timestamp: time.Time{}, Type: "Normal", Namespace: "default", Object: "Pod/c"},
	}
	got := filterEventsByRecent(records, 2*time.Hour, now)
	if len(got) != 2 {
		t.Fatalf("expected 2 records within window (+zero-time), got %d", len(got))
	}
	if got[0].Object != "Pod/a" {
		t.Fatalf("unexpected first record: %+v", got[0])
	}
}
