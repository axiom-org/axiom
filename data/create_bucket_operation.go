package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type CreateBucketOperation struct {
	// Who is creating this bucket (and will own it)
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The name of the bucket
	Name string `json:"name"`

	// The size of the bucket in megabytes
	Size uint32 `json:"size"`
}

func (op *CreateBucketOperation) String() string {
	return fmt.Sprintf("CreateBucket owner=%s, name=%s, size=%d",
		util.Shorten(op.Signer), op.Name, op.Size)
}

func (op *CreateBucketOperation) OperationType() string {
	return "CreateBucket"
}

func (op *CreateBucketOperation) GetSigner() string {
	return op.Signer
}

func (op *CreateBucketOperation) GetFee() uint64 {
	return op.Fee
}

func (op *CreateBucketOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *CreateBucketOperation) Verify() error {
	if !IsValidBucketName(op.Name) {
		return fmt.Errorf("invalid bucket name: %s", op.Name)
	}
	if op.Size == 0 {
		return fmt.Errorf("cannot create bucket of size zero")
	}
	return nil
}

func MakeTestCreateBucketOperation(n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &CreateBucketOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		Name:     fmt.Sprintf("bucket%d", n),
		Size:     uint32(n * 1000),
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&CreateBucketOperation{})
}
