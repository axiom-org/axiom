package data

import (
	"fmt"

	"github.com/axiom-org/axiom/util"
)

// SendOperation is used to send money from one account to another.
type SendOperation struct {
	// Who is sending this money
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// Who is receiving this money
	To string `json:"to"`

	// The amount of currency to transfer
	Amount uint64 `json:"amount"`

	// How much the sender is willing to pay to get this transfer registered
	// This is on top of the amount
	Fee uint64 `json:"fee"`
}

func (op *SendOperation) String() string {
	return fmt.Sprintf("send %d from %s -> %s, seq %d fee %d",
		op.Amount, util.Shorten(op.Signer), util.Shorten(op.To), op.Sequence, op.Fee)
}

func (op *SendOperation) OperationType() string {
	return "Send"
}

func (op *SendOperation) GetSigner() string {
	return op.Signer
}

func (op *SendOperation) GetFee() uint64 {
	return op.Fee
}

func (op *SendOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *SendOperation) Verify() error {
	if _, err := util.ReadPublicKey(op.To); err != nil {
		return fmt.Errorf("cannot send to invalid public key: %s", op.To)
	}
	return nil
}

func makeTestSendOperation(n int) *SignedOperation {
	kp := util.NewKeyPairFromSecretPhrase(fmt.Sprintf("blorp %d", n))
	dest := util.NewKeyPairFromSecretPhrase("destination")
	op := &SendOperation{
		Signer:   kp.PublicKey().String(),
		Sequence: 1,
		To:       dest.PublicKey().String(),
		Amount:   uint64(n),
		Fee:      uint64(n),
	}
	return NewSignedOperation(op, kp)
}

func init() {
	RegisterOperationType(&SendOperation{})
}
