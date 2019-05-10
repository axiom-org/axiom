package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type CreateProviderOperation struct {
	// Who is creating this provider (and will own it)
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The capacity of the provider in megabytes
	Capacity uint32 `json:"capacity"`
}

func (op *CreateProviderOperation) String() string {
	return fmt.Sprintf("CreateProvider owner=%s, cap=%d",
		util.Shorten(op.Signer), op.Capacity)
}

func (op *CreateProviderOperation) OperationType() string {
	return "CreateProvider"
}

func (op *CreateProviderOperation) GetSigner() string {
	return op.Signer
}

func (op *CreateProviderOperation) GetFee() uint64 {
	return op.Fee
}

func (op *CreateProviderOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *CreateProviderOperation) Verify() error {
	return nil
}

func MakeTestCreateProviderOperation(n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &CreateProviderOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		Capacity: uint32(n * 1000),
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&CreateProviderOperation{})
}
