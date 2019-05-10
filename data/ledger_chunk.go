package data

import (
	"crypto/sha512"
	"database/sql/driver"
	"encoding/base64"
	"encoding/json"
	"errors"
	"sort"

	"github.com/lacker/coinkit/consensus"
	"github.com/lacker/coinkit/util"
)

// MaxChunkSize defines how many items can be put in a chunk
const MaxChunkSize = 100

// A LedgerChunk is the information in one block of the blockchain.
// LedgerChunk is sql-json-serializable.
type LedgerChunk struct {
	// The state of accounts after these operations have been processed.
	// This only includes account information for the accounts that are
	// mentioned in the operations.
	Accounts map[string]*Account `json:"accounts"`

	// The id for the next document to be created, after this chunk
	NextDocumentID uint64 `json:"nextDocumentID"`

	// The id for the next provider to be created, after this chunk
	NextProviderID uint64 `json:"nextProviderID"`

	Operations []*SignedOperation `json:"operations"`
}

func (c *LedgerChunk) Hash() consensus.SlotValue {
	if c == nil {
		return consensus.SlotValue("")
	}
	h := sha512.New512_256()
	for _, op := range c.Operations {
		h.Write([]byte(op.Signature))
	}
	keys := []string{}
	for key, _ := range c.Accounts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		h.Write([]byte(key))
		account := c.Accounts[key]
		h.Write(account.Bytes())
	}
	return consensus.SlotValue(base64.RawStdEncoding.EncodeToString(h.Sum(nil)))
}

func (c *LedgerChunk) String() string {
	return StringifyOperations(c.Operations)
}

func (c *LedgerChunk) Value() (driver.Value, error) {
	bytes := util.CanonicalJSONEncode(c)
	return driver.Value(bytes), nil
}

func (c *LedgerChunk) GetOperation(signature string) *SignedOperation {
	for _, op := range c.Operations {
		if op.Signature == signature {
			return op
		}
	}
	return nil
}

func (c *LedgerChunk) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		return errors.New("expected []byte")
	}
	return json.Unmarshal(bytes, c)
}
