package util

import (
	"bytes"
	"testing"
)

func TestSpecificSignature(t *testing.T) {
	serialized := `{
  "public": "0x5cb9ad1487197f63a69f5c51c8bc53fefe6f55f7d01e5509dd0ad055d44eff4f9a86",
  "private": "1YBC5qpaM14DrVdsap5DtBWRv9IHf3Leyd95MOSSBV1cua0Uhxl/Y6afXFHIvFP+/m9V99AeVQndCtBV1E7/Tw"
}
`
	kp, err := DeserializeKeyPair([]byte(serialized))
	if err != nil {
		t.Fatalf("deserialize failed: %s", err)
	}
	s2 := string(kp.Serialize())
	if serialized != s2 {
		t.Fatalf("serialized kps did not match: [%s] vs [%s]", serialized, s2)
	}
	message := "hello, hello"
	sig := kp.Sign(message)
	expected := "7cvpEprNqYCkSuf8rgyV+ESSyziubcCCQpCVtp61FxMff6A3eRVPgFiKnJkH6DfIB0uMEwOr65GFVWnd8n9JAw"
	if sig != expected {
		t.Fatalf("sig != expected: [%s] != [%s]", sig, expected)
	}
}

func TestRejectingGarbage(t *testing.T) {
	randomKey := NewKeyPair().PublicKey()
	if VerifySignature(randomKey, "message", "garbagesig") {
		t.Fatal("this should not have been verified")
	}
}

func TestNewKeyPair(t *testing.T) {
	kp := NewKeyPair()
	message1 := "This is my message. There are many like it, but this one is mine."
	sig1 := kp.Sign(message1)
	message2 := "Another message"
	sig2 := kp.Sign(message2)
	if !VerifySignature(kp.PublicKey(), message1, sig1) {
		t.Fatal("this should verify")
	}
	if !VerifySignature(kp.PublicKey(), message2, sig2) {
		t.Fatal("this should verify")
	}
	if VerifySignature(kp.PublicKey(), message1, sig2) {
		t.Fatal("this should not verify")
	}
	if VerifySignature(kp.PublicKey(), message2, sig1) {
		t.Fatal("this should not verify")
	}
}

func TestNewKeyPairFromSecretPhrase(t *testing.T) {
	kp1 := NewKeyPairFromSecretPhrase("monkey")
	kp2 := NewKeyPairFromSecretPhrase("monkey")
	message1 := "This is my message. There are many like it, but this one is mine."
	sig1 := kp1.Sign(message1)
	message2 := "Another message"
	sig2 := kp1.Sign(message2)
	for _, kp := range []*KeyPair{kp1, kp2} {
		if !VerifySignature(kp.PublicKey(), message1, sig1) {
			t.Fatal("this should verify")
		}
		if !VerifySignature(kp.PublicKey(), message2, sig2) {
			t.Fatal("this should verify")
		}
		if VerifySignature(kp.PublicKey(), message1, sig2) {
			t.Fatal("this should not verify")
		}
		if VerifySignature(kp.PublicKey(), message2, sig1) {
			t.Fatal("this should not verify")
		}
	}

	if sig1 != "s8f4G7896NvyDAjCjyQP8439wRgMam1/vMGzkISAwJVSVZDDOMoKDdPOcZpC9wFCw7mtZ7nbVOkAMpf7Hel8Cg" {
		t.Fatal("sig does not match js")
	}
}

func TestSerializingKeyPair(t *testing.T) {
	kp := NewKeyPairFromSecretPhrase("boopaboop")
	s := kp.Serialize()
	kp2, err := DeserializeKeyPair(s)
	if err != nil {
		t.Fatalf("could not deserialize keypair: %s", err)
	}
	if !kp.publicKey.Equal(kp2.publicKey) {
		t.Fatal("public keys not equal")
	}
	if bytes.Compare(kp.privateKey, kp2.privateKey) != 0 {
		t.Fatal("private keys not equal")
	}
}
