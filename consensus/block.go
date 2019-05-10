package consensus

import (
	"github.com/lacker/coinkit/util"
)

// consensus.Block implements the convergence algorithm for a single block,
// according to the Stellar Consensus Protocol. See:
// https://www.stellar.org/papers/stellar-consensus-protocol.pdf
// Most logic is not in the Block itself, but is delegated to the
// NominationState for the nomination phase and the BallotState for the
// ballot phase.
// Block is not threadsafe.
type Block struct {
	// Which slot this block state is building
	slot int

	nState *NominationState
	bState *BallotState

	// This is nil before the block is finalized.
	// When it is finalized, this is all we need to keep around in order
	// to catch up old nodes.
	external *ExternalizeMessage

	values ValueStore

	// Who we care about
	D *QuorumSlice

	// Who we are
	publicKey util.PublicKey
}

func NewBlock(
	publicKey util.PublicKey, qs *QuorumSlice, slot int, vs ValueStore) *Block {
	nState := NewNominationState(publicKey, qs, vs)
	nState.MaybeNominateNewValue()
	block := &Block{
		slot:      slot,
		nState:    nState,
		bState:    NewBallotState(publicKey, qs, nState),
		values:    vs,
		D:         qs,
		publicKey: publicKey,
	}
	return block
}

func (block *Block) AssertValid() {
	block.nState.AssertValid()
	block.bState.AssertValid()
	if block.bState.phase == Externalize && block.external == nil {
		block.bState.Show()
		util.Logger.Fatalf("this block has externalized but block.external is not set")
	}
}

// OutgoingMessages returns the outgoing messages.
// There can be zero or one nomination messages, and zero or one ballot messages.
func (b *Block) OutgoingMessages() []util.Message {
	if b.external != nil {
		// This block is already externalized
		return []util.Message{b.external}
	}

	// We send out a blank nomination message even if it has no real content,
	// because other nodes use that to figure out when they should start
	// nominating something.
	answer := []util.Message{b.nState.Message(b.slot, b.D)}

	// If we aren't working on any ballot, try to start working on a ballot
	if b.bState.b == nil {
		b.bState.GoToNextBallot()
	}

	if b.bState.HasMessage() {
		m := b.bState.Message(b.slot, b.D)
		answer = append(answer, m)
	}

	return answer
}

func (b *Block) Done() bool {
	return b.external != nil
}

// ValueStoreUpdated should be called when the value store is updated.
func (b *Block) ValueStoreUpdated() {
	b.nState.MaybeNominateNewValue()
}

// Handle handles an incoming message
func (b *Block) Handle(sender string, message util.Message) {
	if sender == b.publicKey.String() {
		// It's one of our own returning to us, we can ignore it
		return
	}
	switch m := message.(type) {
	case *NominationMessage:
		b.nState.Handle(sender, m)
		b.nState.MaybeNominateNewValue()
	case *PrepareMessage:
		b.bState.Handle(sender, m)
	case *ConfirmMessage:
		b.bState.Handle(sender, m)
	case *ExternalizeMessage:
		b.bState.Handle(sender, m)
	default:
		util.Logger.Printf("unrecognized message: %v", m)
	}

	if b.bState.phase == Externalize && b.external == nil {
		b.external = b.bState.Message(b.slot, b.D).(*ExternalizeMessage)
	}

	b.AssertValid()
}
