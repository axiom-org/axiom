package util

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
)

// The last two bytes are a checksum.
type PublicKey [34]byte

// Calculate a checksum for a byte array
func checkBytes(input []byte) []byte {
	if len(input) != 32 {
		panic("checkBytes called on bad-length input")
	}
	h := sha512.New512_256()
	h.Write(input)
	return h.Sum(nil)[:2]
}

// GeneratePublicKey adds a checksum on the end.
func GeneratePublicKey(input []byte) PublicKey {
	if len(input) != 32 {
		panic("caller should only generate public keys with 32 bytes")
	}
	var answer PublicKey
	copy(answer[:], input)
	copy(answer[32:], checkBytes(input))
	return answer
}

func (pk PublicKey) Validate() bool {
	return bytes.Equal(checkBytes(pk[:32]), pk[32:])
}

// For debugging
func (pk PublicKey) ShortName() string {
	return hex.EncodeToString(pk[:3])
}

func (pk PublicKey) String() string {
	return "0x" + hex.EncodeToString(pk[:])
}

// Strips the checksum
func (pk PublicKey) WithoutChecksum() []byte {
	return pk[:32]
}

func (pk PublicKey) Equal(other PublicKey) bool {
	return bytes.Equal(pk[:], other[:])
}

// ReadPublicKey attempts to read a public key from a string format.
// The string format starts with "0x" and is hex-encoded.
// Returns an error if the input format is not valid.
func ReadPublicKey(input string) (PublicKey, error) {
	var invalid PublicKey
	if len(input) != 70 {
		return invalid, fmt.Errorf("public key %s should be 70 characters long", input)
	}
	if input[:2] != "0x" {
		return invalid, fmt.Errorf("public key %s should start with 0x", input)
	}
	bs, err := hex.DecodeString(input[2:])
	if err != nil {
		return invalid, err
	}
	var answer PublicKey
	copy(answer[:], bs)
	if !answer.Validate() {
		return invalid, fmt.Errorf("public key %s has a bad checksum", input)
	}
	return answer, nil
}
