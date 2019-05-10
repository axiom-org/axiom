package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type DeleteProviderOperation struct {
	// Who is deleting this provider. Must be the owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The id of the provider to delete
	ID uint64 `json:"id"`
}

func (op *DeleteProviderOperation) String() string {
	return fmt.Sprintf("DeleteProvider owner=%s, id=%d",
		util.Shorten(op.Signer), op.ID)
}

func (op *DeleteProviderOperation) OperationType() string {
	return "DeleteProvider"
}

func (op *DeleteProviderOperation) GetSigner() string {
	return op.Signer
}

func (op *DeleteProviderOperation) GetFee() uint64 {
	return op.Fee
}

func (op *DeleteProviderOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *DeleteProviderOperation) Verify() error {
	return nil
}

func MakeTestDeleteProviderOperation(id uint64, n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &DeleteProviderOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		ID:       id,
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&DeleteProviderOperation{})
}
