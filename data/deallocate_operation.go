package data

import (
	"fmt"

	"github.com/lacker/coinkit/util"
)

type DeallocateOperation struct {
	// Who is performing this deallocation. Can be either the bucket or provider owner
	Signer string `json:"signer"`

	// The sequence number for this operation
	Sequence uint32 `json:"sequence"`

	// The operation fee for entering an op into the blockchain
	Fee uint64 `json:"fee"`

	// The name of the bucket
	BucketName string `json:"bucketName"`

	// The id of the provider
	ProviderID uint64 `json:"providerID"`
}

func (op *DeallocateOperation) String() string {
	return fmt.Sprintf("Deallocate signer=%s, bucketName=%s, providerID=%d",
		util.Shorten(op.Signer), op.BucketName, op.ProviderID)
}

func (op *DeallocateOperation) OperationType() string {
	return "Deallocate"
}

func (op *DeallocateOperation) GetSigner() string {
	return op.Signer
}

func (op *DeallocateOperation) GetFee() uint64 {
	return op.Fee
}

func (op *DeallocateOperation) GetSequence() uint32 {
	return op.Sequence
}

func (op *DeallocateOperation) Verify() error {
	if !IsValidBucketName(op.BucketName) {
		return fmt.Errorf("invalid bucket name: %s", op.BucketName)
	}
	if op.ProviderID == 0 {
		return fmt.Errorf("providerID cannot be zero")
	}
	return nil
}

func init() {
	RegisterOperationType(&DeallocateOperation{})
}
