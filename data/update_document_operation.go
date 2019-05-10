package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

// UpdateDocumentOperation is used to alter the contents of a document that is
// already stored.
type UpdateDocumentOperation struct {
	// Who is updating the document. Must be the owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// How much the updater is willing to pay to send this operation through
	Fee uint64 `json:"fee"`

	// The id of the document to update
	ID uint64 `json:"id"`

	// The data to update the document with.
	Data *JSONObject `json:"data"`
}

func (op *UpdateDocumentOperation) String() string {
	return fmt.Sprintf("update owner=%s, id=%d, data=%s",
		util.Shorten(op.Signer), op.ID, op.Data)
}

func (op *UpdateDocumentOperation) OperationType() string {
	return "UpdateDocument"
}

func (op *UpdateDocumentOperation) GetSigner() string {
	return op.Signer
}

func (op *UpdateDocumentOperation) GetFee() uint64 {
	return op.Fee
}

func (op *UpdateDocumentOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *UpdateDocumentOperation) GetData() *JSONObject {
	return op.Data
}

func (op *UpdateDocumentOperation) Verify() error {
	return nil
}

// Works with MakeTestCreateDocumentOperation to change the value
func MakeTestUpdateDocumentOperation(id uint64, sequence int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	data := NewEmptyJSONObject()
	data.Set("foo", sequence)
	op := &UpdateDocumentOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(sequence),
		Data:     data,
		ID:       id,
		Fee:      0,
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&UpdateDocumentOperation{})
}
