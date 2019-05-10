package util

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
)

// Message is an interface for the network-level communication between nodes.
// Any message sent from node to node should be a Message.
// The implementation is pretty similar to Operation; maybe they would share more code
// if I could figure out how to do that intelligently.
type Message interface {
	// Slot returns 0 if the message doesn't relate to a particular slot
	Slot() int

	// MessageType returns a unique short string mapping to the type
	MessageType() string

	// String() should return a short, human-readable string
	String() string
}

// MessageTypeMap maps into struct types whose pointer-types implement Message.
// For example, *NominationMessage is a Message. So this map contains the
// NominationMessage type.
var MessageTypeMap map[string]reflect.Type = make(map[string]reflect.Type)

func RegisterMessageType(m Message) {
	name := m.MessageType()
	if len(name) < 2 {
		Logger.Fatalf("message type must be at least 2 letters: %s", name)
	}
	_, ok := MessageTypeMap[name]
	if ok {
		Logger.Fatalf("message type registered multiple times: %s", name)
	}
	mv := reflect.ValueOf(m)
	if mv.Kind() != reflect.Ptr {
		Logger.Fatalf("RegisterMessageType should only be called on pointers")
	}

	sv := mv.Elem()
	if sv.Kind() != reflect.Struct {
		Logger.Fatalf("RegisterMessageType should be called on pointers to structs")
	}

	// Logger.Printf("registering %s -> %+v", name, sv.Type())
	MessageTypeMap[name] = sv.Type()
}

// DecodedMessage is just used for the encoding process.
type DecodedMessage struct {
	// The type of the message
	Type string `json:"type"`

	// The message itself
	Message Message `json:"message"`
}

type PartiallyDecodedMessage struct {
	Type    string          `json:"type"`
	Message json.RawMessage `json:"message"`
}

func EncodeMessage(m Message) string {
	if m == nil || reflect.ValueOf(m).IsNil() {
		panic("you should not EncodeMessage(nil)")
	}
	dm := DecodedMessage{
		Type:    m.MessageType(),
		Message: m,
	}
	encoded := string(CanonicalJSONEncode(dm))

	if Testing() {
		// Check for capitalized fields.
		// Fields in JSON messages can be capitalized if they are programmatic strings
		// like public keys, but those are long. So only fail when it's short.
		matched, _ := regexp.MatchString("[^:]\"[A-Z].{0,30}\"", encoded)
		if matched {
			Logger.Fatalf("capitalized key in encoded message: %s", encoded)
		}
	}

	return encoded
}

func DecodeMessage(encoded string) (Message, error) {
	bytes := []byte(encoded)

	var pdm PartiallyDecodedMessage
	err := json.Unmarshal(bytes, &pdm)
	if err != nil {
		return nil, err
	}
	err = CheckCanonicalJSON(bytes)
	if err != nil {
		return nil, err
	}

	if pdm.Type == "" {
		return nil, fmt.Errorf("cannot decode message %s with no message type", encoded)
	}
	messageType, ok := MessageTypeMap[pdm.Type]
	if !ok {
		return nil, fmt.Errorf("unregistered message type: %s", pdm.Type)
	}
	m := reflect.New(messageType).Interface().(Message)
	err = json.Unmarshal(pdm.Message, &m)
	if err != nil {
		return nil, err
	}
	if m == nil {
		return nil, fmt.Errorf("it looks like a nil message got encoded")
	}

	return m, nil
}

// Useful for simulating a network transit
func EncodeThenDecodeMessage(message Message) Message {
	encoded := EncodeMessage(message)
	m, err := DecodeMessage(encoded)
	if err != nil {
		Logger.Fatal("EncodeThenDecodeMessage error:", err)
	}
	return m
}
