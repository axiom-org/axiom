package util

import (
	"bytes"
	"encoding/json"
	"fmt"
)

func PrettyJSON(x interface{}) []byte {
	bs, err := json.MarshalIndent(x, "", "  ")
	if err != nil {
		panic(err)
	}
	return append(bs, '\n')
}

func ToJSON(x interface{}) []byte {
	bs, err := json.Marshal(x)
	if err != nil {
		panic(err)
	}
	return bs
}

// Reencodes some JSON canonically.
// The optional choices that make this canonical:
//   * Field order is alphabetized
//   * & < > characters are not escaped
// Returns an error if the bytes are not valid json
func CanonicalJSONReencode(bs []byte) ([]byte, error) {
	var decoded interface{}
	json.Unmarshal(bs, &decoded)
	buf := new(bytes.Buffer)
	enc := json.NewEncoder(buf)
	enc.SetEscapeHTML(false)
	err := enc.Encode(decoded)
	if err != nil {
		return []byte{}, err
	}
	encoded := buf.Bytes()

	// The default go json encoder adds newlines which we need to remove
	return bytes.TrimRight(encoded, "\n"), nil
}

// Returns a descriptive error if this is not canonical json
func CheckCanonicalJSON(bs []byte) error {
	bs2, err := CanonicalJSONReencode(bs)
	if err != nil {
		return err
	}
	if bytes.Compare(bs, bs2) != 0 {
		return fmt.Errorf("uncanonical json:\n%s\nthe canonicalized version is:\n%s",
			bs, bs2)
	}
	return nil
}

// JSON-encodes something in a canonical way.
// TODO: this encodes twice. find a more efficient way to do this
func CanonicalJSONEncode(x interface{}) []byte {
	encoded, err := json.Marshal(x)
	if err != nil {
		panic(err)
	}
	reencoded, err := CanonicalJSONReencode(encoded)
	if err != nil {
		panic(err)
	}
	return reencoded
}
