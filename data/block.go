package data

import (
	"github.com/axiom-org/axiom/consensus"
	"github.com/axiom-org/axiom/util"
)

// data.Block represents how the value for a single block gets stored to the database.
type Block struct {
	// Which block this is
	Slot int `json:"slot"`

	// The LedgerChunk for this block
	Chunk *LedgerChunk `json:"chunk"`

	// The ballot numbers this node confirmed.
	C int `json:"c"`
	H int `json:"h"`

	// The quorum slice used to confirm this block
	D *consensus.QuorumSlice `json:"d"`
}

// ExternalizeMessage() constructs a message with the metadata for how we came to
// consensus on this block
func (b *Block) ExternalizeMessage() *consensus.ExternalizeMessage {
	return &consensus.ExternalizeMessage{
		I:  b.Slot,
		X:  b.Chunk.Hash(),
		Cn: b.C,
		Hn: b.H,
		D:  b.D,
	}
}

// OperationMessage() constructs a message with the chunk contents
func (b *Block) OperationMessage() *OperationMessage {
	return NewOperationMessageWithChunk(b.Chunk)
}

func (b *Block) String() string {
	return string(util.PrettyJSON(b))
}

// Returns nil if the operation with this signature is not in this block.
func (b *Block) GetOperation(signature string) *SignedOperation {
	return b.Chunk.GetOperation(signature)
}
