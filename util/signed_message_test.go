package util

import (
	"bytes"
	"strings"
	"testing"
)

func TestSignedMessage(t *testing.T) {
	m := &TestingMessage{Number: 4}
	kp := NewKeyPairFromSecretPhrase("foo")
	sm := NewSignedMessage(m, kp)
	str := sm.Serialize()
	sm2, err := NewSignedMessageFromSerialized(str)
	if sm2 == nil {
		Logger.Print(err)
		t.Fatal("sm2 should not be nil")
	}
	if sm.signer != sm2.signer || sm.signature != sm2.signature {
		Logger.Printf("sm: %+v", sm)
		Logger.Printf("sm2: %+v", sm2)
		t.Fatal("sm should equal sm2")
	}
}

func TestSignedMessageWriting(t *testing.T) {
	m := &TestingMessage{Number: 7}
	kp := NewKeyPairFromSecretPhrase("foo")
	sm := NewSignedMessage(m, kp)
	buf := new(bytes.Buffer)
	sm.Write(buf)
	serialized := strings.TrimSuffix(buf.String(), "\n")
	_, err := NewSignedMessageFromSerialized(serialized)
	if err != nil {
		t.Fatal(err)
	}
}

func TestSignedMessageWithPercents(t *testing.T) {
	m := &TestingMessage{Text: "foo %s bar %d"}
	kp := NewKeyPairFromSecretPhrase("foo")
	sm := NewSignedMessage(m, kp)
	buf := new(bytes.Buffer)
	sm.Write(buf)
	serialized := strings.TrimSuffix(buf.String(), "\n")
	_, err := NewSignedMessageFromSerialized(serialized)
	if err != nil {
		t.Fatal(err)
	}
}
