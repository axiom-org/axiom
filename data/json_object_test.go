package data

import (
	"testing"
)

func TestUpdateWith(t *testing.T) {
	initial, err := ReadJSONObject([]byte(`{"foo":1,"bar":2}`))
	if err != nil {
		t.Fatal(err)
	}
	foo, ok := initial.GetInt("foo")
	if !ok || foo != 1 {
		t.Fatal("bad foo")
	}

	updater, err := ReadJSONObject([]byte(`{"foo":null,"bar":3}`))
	if err != nil {
		t.Fatal(err)
	}
	initial.UpdateWith(updater)

	foo, ok = initial.GetInt("foo")
	if ok {
		t.Fatal("foo should no longer be present")
	}
	bar, ok := initial.GetInt("bar")
	if !ok || bar != 3 {
		t.Fatal("bad bar")
	}
}
