package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type UpdateProviderOperation struct {
	// Who is updating this provider. Must match the owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The ID of the provider to update
	ID uint64 `json:"id"`

	// The new capacity of this provider in megabytes
	Capacity uint32 `json:"capacity"`
}

func (op *UpdateProviderOperation) String() string {
	return fmt.Sprintf("UpdateProvider owner=%s, id=%d, cap=%d",
		util.Shorten(op.Signer), op.ID, op.Capacity)
}

func (op *UpdateProviderOperation) OperationType() string {
	return "UpdateProvider"
}

func (op *UpdateProviderOperation) GetSigner() string {
	return op.Signer
}

func (op *UpdateProviderOperation) GetFee() uint64 {
	return op.Fee
}

func (op *UpdateProviderOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *UpdateProviderOperation) Verify() error {
	if op.ID == 0 {
		return fmt.Errorf("provider id cannot be zero")
	}
	return nil
}

func MakeTestUpdateProviderOperation(id uint64, n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &UpdateProviderOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		ID:       id,
		Capacity: uint32(n * 2000),
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&UpdateProviderOperation{})
}
