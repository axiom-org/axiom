package data

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/lacker/coinkit/util"
)

// Operation is an interface for things that can be serialized onto the blockchain.
// Logically, the blockchain can be thought of as a sequence of operations. Any
// other data on the blockchain besides the sequence of operations is just for
// efficiency.
type Operation interface {
	// OperationType() returns a unique short string mapping to the operation type
	OperationType() string

	// String() should return a short, human-readable string
	String() string

	// GetSigner() returns the public key of the user who needs to sign this operation
	GetSigner() string

	// Verify() should do any internal checking that this operation can do to
	// make sure it is valid. This doesn't include checking against data in the
	// blockchain. This returns a descriptive error when verification fails.
	Verify() error

	// GetFee() returns how much the signer is willing to pay to prioritize this op
	GetFee() uint64

	// GetSequence() returns the number in sequence that this operation is for the signer
	// This prevents most replay attacks
	GetSequence() uint32
}

// OperationTypeMap maps into struct types whose pointer-types implement Operation.
var OperationTypeMap map[string]reflect.Type = make(map[string]reflect.Type)

func RegisterOperationType(op Operation) {
	name := op.OperationType()
	_, ok := OperationTypeMap[name]
	if ok {
		util.Logger.Fatalf("operation type registered multiple times: %s", name)
	}
	opv := reflect.ValueOf(op)
	if opv.Kind() != reflect.Ptr {
		util.Logger.Fatalf("RegisterOperationType should only be called on pointers")
	}

	sv := opv.Elem()
	if sv.Kind() != reflect.Struct {
		util.Logger.Fatalf("RegisterOperationType should be called on pointers to structs")
	}

	OperationTypeMap[name] = sv.Type()
}

func StringifyOperations(ops []*SignedOperation) string {
	parts := []string{}
	limit := 2
	for i, op := range ops {
		if i >= limit {
			parts = append(parts, fmt.Sprintf("and %d more", len(ops)-limit))
			break
		}
		parts = append(parts, op.Operation.String())
	}
	return fmt.Sprintf("(%s)", strings.Join(parts, "; "))
}
