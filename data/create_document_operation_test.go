package data

import (
	"encoding/json"
	"testing"
)

func TestCreateDocumentOperationSerialization(t *testing.T) {
	op1 := MakeTestCreateDocumentOperation(1).Operation.(*CreateDocumentOperation)
	bytes, err := json.Marshal(op1)
	if err != nil {
		panic(err)
	}
	op2 := &CreateDocumentOperation{}
	err = json.Unmarshal(bytes, op2)
	if err != nil {
		panic(err)
	}
	if op1.Signer != op2.Signer {
		t.Fatalf("op1.Signer is %s, op2.Signer is %s", op1.Signer, op2.Signer)
	}
	if op1.Data.DefaultInt("foo", 0) != op2.Data.DefaultInt("foo", -1) {
		t.Logf("op1.Data: %s", op1.Data)
		t.Logf("op2.Data: %s", op2.Data)
		t.Fatalf("op1.Data != op2.Data")
	}
}
