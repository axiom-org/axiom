package data

import (
	"bytes"
	"testing"
)

func TestAccountHashing(t *testing.T) {
	a1 := &Account{Sequence: 1, Balance: 2}
	a2 := &Account{Sequence: 1, Balance: 20}
	if bytes.Equal(a1.Bytes(), a2.Bytes()) {
		t.Fatal("bytes should not be two-to-one")
	}
}
