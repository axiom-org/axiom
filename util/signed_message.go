package util

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"reflect"
	"strings"
)

const OK = "ok"

type SignedMessage struct {
	message       Message
	messageString string
	signer        string
	signature     string

	// Whenever keepalive is true, the SignedMessage has no real content, it's
	// just a small value used to keep a network connection alive
	keepalive bool
}

func NewSignedMessage(message Message, kp *KeyPair) *SignedMessage {
	if message == nil || reflect.ValueOf(message).IsNil() {
		Logger.Fatal("cannot sign nil message")
	}
	ms := EncodeMessage(message)
	return &SignedMessage{
		message:       message,
		messageString: ms,
		signer:        kp.PublicKey().String(),
		signature:     kp.Sign(ms),
	}
}

func (sm *SignedMessage) Message() Message {
	return sm.message
}

func (sm *SignedMessage) Signer() string {
	return sm.signer
}

func (sm *SignedMessage) Signature() string {
	return sm.signature
}

func (sm *SignedMessage) Serialize() string {
	return fmt.Sprintf("e:%s:%s:%s", sm.signer, sm.signature, sm.messageString)
}

func (sm *SignedMessage) IsKeepAlive() bool {
	return sm.keepalive
}

// Panics if this message cannot be serialized and deserialized
func (sm *SignedMessage) CheckSerialization() {
	serialized := sm.Serialize()
	_, err := NewSignedMessageFromSerialized(serialized)
	if err != nil {
		panic(err)
	}
}

func NewSignedMessageFromSerialized(serialized string) (*SignedMessage, error) {
	parts := strings.SplitN(serialized, ":", 4)
	if len(parts) != 4 {
		return nil, errors.New("could not find 4 parts")
	}
	version, signer, signature, ms := parts[0], parts[1], parts[2], parts[3]
	if version != "e" {
		return nil, errors.New("unrecognized version")
	}
	publicKey, err := ReadPublicKey(signer)
	if err != nil {
		return nil, err
	}
	if !VerifySignature(publicKey, ms, signature) {
		Logger.Printf("invalid signature on signed message: %s", serialized)
		return nil, errors.New("signature failed verification")
	}
	m, err := DecodeMessage(ms)
	if err != nil {
		Logger.Printf("DecodeMessage failed reading SignedMessage: %s", serialized)
		return nil, err
	}
	return &SignedMessage{
		message:       m,
		messageString: ms,
		signer:        signer,
		signature:     signature,
	}, nil
}

func KeepAlive() *SignedMessage {
	return &SignedMessage{keepalive: true}
}

func (sm *SignedMessage) Write(w io.Writer) {
	if sm == nil {
		panic("cannot write nil signed message")
	}
	var data string
	if sm.keepalive {
		data = OK + "\n"
	} else {
		data = sm.Serialize() + "\n"
	}
	io.WriteString(w, data)
}

// ReadSignedMessage can return a nil message even when there is no error.
// Specifically, a line with just "ok" indicates no message, but also no error.
// The caller is responsible for setting any deadlines.
func ReadSignedMessage(r *bufio.Reader) (*SignedMessage, error) {
	data, err := r.ReadString('\n')
	if err != nil {
		if err == io.EOF {
			return nil, fmt.Errorf("no endline while reading: [%s]", data)
		}
		return nil, err
	}

	// Chop the newline
	serialized := data[:len(data)-1]
	if serialized == OK {
		return &SignedMessage{keepalive: true}, nil
	}

	return NewSignedMessageFromSerialized(serialized)
}
