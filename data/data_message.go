package data

import (
	"fmt"
	"strings"

	"github.com/axiom-org/axiom/util"
)

// A DataMessage is used to respond when a client requests data.
type DataMessage struct {
	// I is the last finalized slot occurring in the data snapshot used for this data.
	// If I is zero, it just means we are not reporting which slot this reflects.
	I int `json:"i"`

	// The contents of an account, keyed by owner.
	// A nil value means there is no account for the owner key.
	Accounts map[string]*Account `json:"accounts"`

	// The contents of some blocks, keyed by slot.
	// Nil values mean that the block is unknown because it has not been finalized yet.
	Blocks map[int]*Block `json:"blocks"`

	// These lists are in response to queries.
	Documents []*Document `json:"documents"`
	Buckets   []*Bucket   `json:"buckets"`
	Providers []*Provider `json:"providers"`

	// The contents of some committed operations, keyed by signature.
	Operations map[string]*SignedOperation `json:"operations"`
}

func (m *DataMessage) Slot() int {
	return m.I
}

func (m *DataMessage) MessageType() string {
	return "Data"
}

func (m *DataMessage) String() string {
	parts := []string{"data", fmt.Sprintf("slot=%d", m.Slot())}
	for owner, account := range m.Accounts {
		parts = append(parts, fmt.Sprintf("a:%s=%s",
			util.Shorten(owner), StringifyAccount(account)))
	}
	for i, _ := range m.Blocks {
		parts = append(parts, fmt.Sprintf("block%d", i))
	}
	return strings.Join(parts, " ")
}

func init() {
	util.RegisterMessageType(&DataMessage{})
}
