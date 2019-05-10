package util

import (
	"encoding/json"
	"testing"
)

type TestingMessage struct {
	Number int    `json:"number"`
	Text   string `json:"text"`
}

func (m *TestingMessage) Slot() int {
	return 0
}

func (m *TestingMessage) MessageType() string {
	return "Testing"
}

func (m *TestingMessage) String() string {
	return "Testing"
}

func init() {
	RegisterMessageType(&TestingMessage{})
}

func TestMessageEncoding(t *testing.T) {
	m := &TestingMessage{Number: 7}
	m2 := EncodeThenDecodeMessage(m).(*TestingMessage)
	if m2.Number != 7 {
		t.Fatalf("m2.Number turned into %d", m2.Number)
	}
}

func TestDecodingInvalidMessage(t *testing.T) {
	bytes, err := json.Marshal(DecodedMessage{
		Type:    "Testing",
		Message: nil,
	})
	if err != nil {
		t.Fatal(err)
	}
	encoded := string(bytes)
	m, err := DecodeMessage(encoded)
	if err == nil || m != nil {
		t.Fatal("an encoded nil message should fail to decode")
	}
}
