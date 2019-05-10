package data

import (
	"fmt"
	"strings"

	"github.com/lacker/coinkit/util"
)

// A QueryMessage is sent by a client that wishes to know information. It doesn't
// indicate any statement being made by the sender.
// Only a single top-level field should be filled in for a single QueryMessage.
// The response should be a DataMessage.
type QueryMessage struct {
	// When Account is nonempty, this message is requesting the account data for
	// this particular user.
	Account string `json:"account"`

	// When Block is nonzero, this message is requesting data for a mined block.
	Block int `json:"block"`

	// When Documents is non-nil, this message is requesting data for matching documents.
	Documents *DocumentQuery `json:"documents"`

	// When Buckets is non-nil, this message is requesting data for matching buckets.
	Buckets *BucketQuery `json:"buckets"`

	// When Providers is non-nil, this message is requesting data for matching providers.
	Providers *ProviderQuery `json:"providers"`

	// When Signature is nonempty, this message is requesting a committed
	// SignedOperation with this signature.
	Signature string `json:"signature"`
}

func (m *QueryMessage) Slot() int {
	return 0
}

func (m *QueryMessage) MessageType() string {
	return "Query"
}

func (m *QueryMessage) String() string {
	parts := []string{"query"}
	if m.Account != "" {
		parts = append(parts, fmt.Sprintf("account=%s", util.Shorten(m.Account)))
	}
	if m.Block != 0 {
		parts = append(parts, fmt.Sprintf("block=%d", m.Block))
	}
	if m.Documents != nil {
		parts = append(parts, fmt.Sprintf("docs=%s", m.Documents))
	}
	if m.Buckets != nil {
		parts = append(parts, fmt.Sprintf("buckets=(%s)", m.Buckets))
	}
	if m.Providers != nil {
		parts = append(parts, fmt.Sprintf("providers=(%s)", m.Providers))
	}
	if m.Signature != "" {
		parts = append(parts, fmt.Sprintf("signature=%s", m.Signature))
	}
	return strings.Join(parts, " ")
}

func init() {
	util.RegisterMessageType(&QueryMessage{})
}
