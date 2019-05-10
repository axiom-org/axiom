package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type UpdateBucketOperation struct {
	// Who is updating this bucket. Must match the owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The name of the bucket
	Name string `json:"name"`

	// The new magnet uri
	Magnet string `json:"magnet"`
}

func (op *UpdateBucketOperation) String() string {
	return fmt.Sprintf("UpdateBucket owner=%s, name=%s, magnet=%s",
		util.Shorten(op.Signer), op.Name, op.Magnet)
}

func (op *UpdateBucketOperation) OperationType() string {
	return "UpdateBucket"
}

func (op *UpdateBucketOperation) GetSigner() string {
	return op.Signer
}

func (op *UpdateBucketOperation) GetFee() uint64 {
	return op.Fee
}

func (op *UpdateBucketOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *UpdateBucketOperation) Verify() error {
	if !IsValidMagnet(op.Magnet) {
		return fmt.Errorf("invalid magnet: %s", op.Magnet)
	}
	return nil
}

func MakeTestUpdateBucketOperation(n int) *SignedOperation {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	op := &UpdateBucketOperation{
		Signer:   mint.PublicKey().String(),
		Sequence: uint32(n),
		Name:     fmt.Sprintf("bucket%d", n),
		Magnet:   fmt.Sprintf("http://example.com/%d", n),
	}
	return NewSignedOperation(op, mint)
}

func init() {
	RegisterOperationType(&UpdateBucketOperation{})
}
