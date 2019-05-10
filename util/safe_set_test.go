package util

import (
	"testing"
)

func TestSetOps(t *testing.T) {
	s := NewSafeSet()
	s.Add("foo")
	s.Add("bar")
	if !s.Contains("foo") {
		t.Fatalf("no foo")
	}
	s.Remove("foo")
	if s.Contains("foo") {
		t.Fatalf("yes foo")
	}
}
