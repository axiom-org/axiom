package util

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"

	"golang.org/x/crypto/ed25519"
)

type KeyPair struct {
	publicKey  PublicKey
	privateKey ed25519.PrivateKey
}

// Generates a key pair at random
func NewKeyPair() *KeyPair {
	pub, priv, err := ed25519.GenerateKey(nil)
	if err != nil {
		panic(err)
	}
	return &KeyPair{
		publicKey:  GeneratePublicKey(pub),
		privateKey: priv,
	}
}

func NewKeyPairFromSecretPhrase(phrase string) *KeyPair {
	// ed25519 needs 32 bytes of "entropy".
	// Use the hash of the phrase for that.
	h := sha512.New512_256()
	h.Write([]byte(phrase))
	checksum := h.Sum(nil)
	reader := bytes.NewReader(checksum)
	pub, priv, err := ed25519.GenerateKey(reader)
	if err != nil {
		panic(err)
	}
	return &KeyPair{
		publicKey:  GeneratePublicKey(pub),
		privateKey: priv,
	}
}

type SerializedKeyPair struct {
	Public  string `json:"public"`
	Private string `json:"private"`
}

func DeserializeKeyPair(serialized []byte) (*KeyPair, error) {
	s := &SerializedKeyPair{}
	err := json.Unmarshal(serialized, s)
	if err != nil {
		return nil, err
	}
	priv, err := base64.RawStdEncoding.DecodeString(s.Private)
	if err != nil {
		return nil, err
	}
	pub, err := ReadPublicKey(s.Public)
	if err != nil {
		return nil, err
	}
	kp := &KeyPair{
		publicKey:  pub,
		privateKey: priv,
	}

	// Ensure that the keypair works. Otherwise we could accidentally have a public
	// key and private key that do not match, and it would be hard to catch.
	message := "Jackdaws of quartz love my big sphinx"
	sig := kp.Sign(message)
	if !VerifySignature(kp.PublicKey(), message, sig) {
		return nil, errors.New("keypair fails signature validation")
	}

	return kp, nil
}

func ReadKeyPairFromFile(filename string) (*KeyPair, error) {
	bytes, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	kp, err := DeserializeKeyPair(bytes)
	if err != nil {
		return nil, fmt.Errorf("the keypair in %s is invalid: %s", filename, err)
	}
	return kp, nil
}

func (kp *KeyPair) PublicKey() PublicKey {
	return kp.publicKey
}

func (kp *KeyPair) Serialize() []byte {
	s := &SerializedKeyPair{
		Public:  kp.publicKey.String(),
		Private: base64.RawStdEncoding.EncodeToString(kp.privateKey),
	}
	return PrettyJSON(s)
}

// Interprets the message as utf8, then returns the signature as base64.
func (kp *KeyPair) Sign(message string) string {
	signature, err := kp.privateKey.Sign(rand.Reader, []byte(message), crypto.Hash(0))
	if err != nil {
		panic(err)
	}
	return base64.RawStdEncoding.EncodeToString(signature)
}

// message is handled as utf8, the signature is base64.
func VerifySignature(publicKey PublicKey, message string, signature string) bool {
	pub := publicKey.WithoutChecksum()
	if len(pub) != ed25519.PublicKeySize {
		return false
	}
	sig, err := base64.RawStdEncoding.DecodeString(signature)
	if err != nil || len(sig) != ed25519.SignatureSize {
		return false
	}
	answer := ed25519.Verify(pub, []byte(message), sig)
	return answer
}
