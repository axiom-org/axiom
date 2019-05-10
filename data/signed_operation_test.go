package data

import (
	"encoding/json"
	"testing"

	"github.com/axiom-org/axiom/util"
)

func TestSignedOperation(t *testing.T) {
	kp := util.NewKeyPairFromSecretPhrase("yo")
	op := &TestingOperation{
		Number: 8,
		Signer: kp.PublicKey().String(),
	}
	so := NewSignedOperation(op, kp)
	if so.Verify() != nil {
		t.Fatal("so should Verify")
	}
}

func TestSignedOperationJson(t *testing.T) {
	kp := util.NewKeyPairFromSecretPhrase("hi")
	op := &TestingOperation{
		Number: 9,
		Signer: kp.PublicKey().String(),
	}
	so := NewSignedOperation(op, kp)
	bytes := util.CanonicalJSONEncode(so)
	t.Logf("canonically encoded signed op: %s", bytes)
	so2 := &SignedOperation{}
	err := json.Unmarshal(bytes, so2)
	if err != nil {
		t.Fatal(err)
	}
	if so2.Operation.(*TestingOperation).Number != 9 {
		t.Fatalf("so2.Operation is %+v", so2.Operation)
	}
}

func TestSignedOperationDecodingAlsoVerifiesSignature(t *testing.T) {
	kp := util.NewKeyPairFromSecretPhrase("borp")
	op := &TestingOperation{
		Number: 10,
		Signer: kp.PublicKey().String(),
	}
	so := NewSignedOperation(op, kp)
	so.Signature = "BadSignature"
	bytes, err := json.Marshal(so)
	if err != nil {
		t.Fatal(err)
	}
	so2 := &SignedOperation{}
	err = json.Unmarshal(bytes, so2)
	if err == nil {
		t.Fatal("expected error in decoding")
	}
}

func TestSignedOperationDecodingAlsoVerifiesOperation(t *testing.T) {
	kp := util.NewKeyPairFromSecretPhrase("bop")
	op := &TestingOperation{
		Number:  11,
		Signer:  kp.PublicKey().String(),
		Invalid: true,
	}
	so := NewSignedOperation(op, kp)
	bytes, err := json.Marshal(so)
	if err != nil {
		t.Fatal(err)
	}
	so2 := &SignedOperation{}
	err = json.Unmarshal(bytes, so2)
	if err == nil {
		t.Fatal("expected error in decoding")
	}
}
