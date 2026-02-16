package runner

import "testing"

func TestShouldConfirm(t *testing.T) {
	cases := []struct {
		name  string
		args  []string
		force bool
		want  bool
	}{
		{name: "mutating delete", args: []string{"delete", "pod", "x"}, force: false, want: true},
		{name: "read only get", args: []string{"get", "pods"}, force: false, want: false},
		{name: "force bypass", args: []string{"delete", "pod", "x"}, force: true, want: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := shouldConfirm(tc.args, tc.force)
			if got != tc.want {
				t.Fatalf("shouldConfirm(%v, force=%v)=%v, want %v", tc.args, tc.force, got, tc.want)
			}
		})
	}
}
