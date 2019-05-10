package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

// CreateDocumentOperation is used to create a new document on the blockchain.
type CreateDocumentOperation struct {
	// Who is creating this document
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// How much the creator is willing to pay to get this document registered
	Fee uint64 `json:"fee"`

	// The data to be created in the new document
	Data *JSONObject `json:"data"`
}

func (op *CreateDocumentOperation) String() string {
	return fmt.Sprintf("create owner=%s, data=%s", util.Shorten(op.Signer), op.Data)
}

func (op *CreateDocumentOperation) OperationType() string {
	return "CreateDocument"
}

func (op *CreateDocumentOperation) GetSigner() string {
	return op.Signer
}

func (op *CreateDocumentOperation) GetFee() uint64 {
	return op.Fee
}

func (op *CreateDocumentOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *CreateDocumentOperation) GetData() *JSONObject {
	return op.Data
}

func (op *CreateDocumentOperation) Verify() error {
	return nil
}

func MakeTestCreateDocumentOperation(n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	data := NewEmptyJSONObject()
	data.Set("foo", n)
	op := &CreateDocumentOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		Data:     data,
		Fee:      0,
	}
	return NewSignedOperation(op, mint)
}

func (op *CreateDocumentOperation) Document(id uint64) *Document {
	data := op.Data.Copy()
	data.Set("id", id)
	data.Set("owner", op.Signer)
	return &Document{
		Data: data,
		ID:   id,
	}
}

func init() {
	RegisterOperationType(&CreateDocumentOperation{})
}
