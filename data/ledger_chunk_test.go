package data

import (
	"testing"
)

func TestLedgerChunkHashing(t *testing.T) {
	t1 := makeTestSendOperation(1)
	t1copy := makeTestSendOperation(1)
	t2 := makeTestSendOperation(2)
	t3 := makeTestSendOperation(3)
	a1 := &Account{Sequence: 1, Balance: 2}
	a1copy := &Account{Sequence: 1, Balance: 2}
	a2 := &Account{Sequence: 1, Balance: 20}

	chunk1 := &LedgerChunk{
		Operations: []*SignedOperation{t1, t2},
		Accounts: map[string]*Account{
			"a1": a1,
			"a2": a2,
		},
	}

	chunk1copy := &LedgerChunk{
		Operations: []*SignedOperation{t1copy, t2},
		Accounts: map[string]*Account{
			"a1": a1copy,
			"a2": a2,
		},
	}

	chunk2 := &LedgerChunk{
		Operations: []*SignedOperation{t1, t3},
		Accounts: map[string]*Account{
			"a1": a1,
			"a2": a2,
		},
	}

	chunk3 := &LedgerChunk{
		Operations: []*SignedOperation{t1, t2},
		Accounts: map[string]*Account{
			"a1": a2,
			"a2": a1,
		},
	}

	chunk4 := &LedgerChunk{
		Operations: []*SignedOperation{t1},
		Accounts: map[string]*Account{
			"a1": a1,
			"a2": a2,
		},
	}

	if chunk1.Hash() != chunk1copy.Hash() {
		t.Fatal("chunk1 should equal chunk1copy")
	}
	if chunk1.Hash() == chunk2.Hash() {
		t.Fatal("chunk1 should != chunk2")
	}
	if chunk1.Hash() == chunk3.Hash() {
		t.Fatal("chunk1 should != chunk3")
	}
	if chunk1.Hash() == chunk4.Hash() {
		t.Fatal("chunk1 should != chunk4")
	}
}
