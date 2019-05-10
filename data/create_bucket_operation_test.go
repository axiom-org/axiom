package data

import (
	"encoding/json"
	"testing"
)

func TestCreateBucketOperationSerialization(t *testing.T) {
	op1 := MakeTestCreateBucketOperation(1).Operation.(*CreateBucketOperation)
	bytes, err := json.Marshal(op1)
	if err != nil {
		panic(err)
	}
	op2 := &CreateBucketOperation{}
	err = json.Unmarshal(bytes, op2)
	if err != nil {
		panic(err)
	}
	if op1.Signer != op2.Signer {
		t.Fatalf("op1.Signer is %s, op2.Signer is %s", op1.Signer, op2.Signer)
	}
	if op1.Name != op2.Name {
		t.Fatalf("op1.Name is %s, op2.Name is %s", op1.Name, op2.Name)
	}
	if op1.Size != op2.Size {
		t.Fatalf("op1.Size is %d, op2.Size is %d", op1.Size, op2.Size)
	}
}
