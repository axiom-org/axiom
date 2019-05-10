package network

import (
	"bytes"
	"testing"
)

func TestSerializingConfig(t *testing.T) {
	c := &Config{
		Servers:   make(map[string]*Address),
		Threshold: 3,
	}
	c.Servers["a"] = &Address{Host: "a", Port: 1}
	c.Servers["b"] = &Address{Host: "b", Port: 2}
	c.Servers["c"] = &Address{Host: "c", Port: 3}
	c.Servers["d"] = &Address{Host: "d", Port: 4}

	s := c.Serialize()
	c2 := NewConfigFromSerialized(s)
	s2 := c2.Serialize()
	if bytes.Compare(s, s2) != 0 {
		t.Fatal("serialize-deserialize fail in config")
	}
}
