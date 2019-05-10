package data

import (
	"fmt"

	"github.com/axiom-org/axiom/util"
)

type DeleteDocumentOperation struct {
	// Who is deleting the document. Must be the owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// How much the updater is willing to pay to send this operation through
	Fee uint64 `json:"fee"`

	// The id of the document to update
	ID uint64 `json:"id"`
}

func (op *DeleteDocumentOperation) String() string {
	return fmt.Sprintf("delete owner=%s, id=%d", util.Shorten(op.Signer), op.ID)
}

func (op *DeleteDocumentOperation) OperationType() string {
	return "DeleteDocument"
}

func (op *DeleteDocumentOperation) GetSigner() string {
	return op.Signer
}

func (op *DeleteDocumentOperation) GetFee() uint64 {
	return op.Fee
}

func (op *DeleteDocumentOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *DeleteDocumentOperation) Verify() error {
	return nil
}

func MakeTestDeleteDocumentOperation(id uint64, sequence int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &DeleteDocumentOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(sequence),
		ID:       id,
		Fee:      0,
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&DeleteDocumentOperation{})
}
