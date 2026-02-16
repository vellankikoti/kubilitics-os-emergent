package cli

import (
	"reflect"
	"testing"
)

func TestScopeArgsFor(t *testing.T) {
	a := &app{context: "prod", namespace: "ns-a"}

	t.Run("injects context and namespace", func(t *testing.T) {
		got := a.scopeArgsFor([]string{"get", "pods"})
		want := []string{"--context", "prod", "-n", "ns-a", "get", "pods"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("scopeArgsFor mismatch: got %v want %v", got, want)
		}
	})

	t.Run("skips namespace when all namespaces requested", func(t *testing.T) {
		got := a.scopeArgsFor([]string{"get", "pods", "-A"})
		want := []string{"--context", "prod", "get", "pods", "-A"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("scopeArgsFor mismatch: got %v want %v", got, want)
		}
	})

	t.Run("skips duplicates when explicit flags present", func(t *testing.T) {
		got := a.scopeArgsFor([]string{"--context", "dev", "--namespace", "ns-b", "get", "pods"})
		want := []string{"--context", "dev", "--namespace", "ns-b", "get", "pods"}
		if !reflect.DeepEqual(got, want) {
			t.Fatalf("scopeArgsFor mismatch: got %v want %v", got, want)
		}
	})
}
