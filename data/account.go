package data

import (
	"fmt"

	"github.com/axiom-org/axiom/util"
)

// Each unit of money pays for the storage of one byte.
// The total amount of money is thus (roughly) equivalent to the total
// amount of document bytes that a node has to be storing.
// The equivalence is only rough because there is some other data
// besides the direct document storage that takes up space.
const TotalMoney = 1e9

type Account struct {
	Owner string `json:"owner"`

	// The sequence id of the last operation authorized by this account.
	// 0 means there have never been any authorized operations.
	// Used to prevent replay attacks.
	Sequence uint32 `json:"sequence"`

	// The current balance of this account.
	Balance uint64 `json:"balance"`

	// How much data this account is currently storing.
	// Storage can never exceed balance.
	Storage uint64 `json:"storage"`
}

// For debugging
func StringifyAccount(a *Account) string {
	if a == nil {
		return "nil"
	}
	return fmt.Sprintf("%s:s%d:b%d", util.Shorten(a.Owner), a.Sequence, a.Balance)
}

func (a *Account) CheckEqual(other *Account) error {
	if a == nil && other == nil {
		return nil
	}
	if a == nil || other == nil {
		return fmt.Errorf("a != other. a is %+v, other is %+v", a, other)
	}
	if a.Owner != other.Owner {
		return fmt.Errorf("owner %s != owner %s", a.Owner, other.Owner)
	}
	if a.Sequence != other.Sequence {
		return fmt.Errorf("data mismatch for owner %s: seq %d != seq %d",
			a.Owner, a.Sequence, other.Sequence)
	}
	if a.Balance != other.Balance {
		return fmt.Errorf("data mismatch for owner %s: balance %d != balance %d",
			a.Owner, a.Balance, other.Balance)
	}
	return nil
}

func (a *Account) Bytes() []byte {
	return []byte(fmt.Sprintf("%s:%d:%d", a.Owner, a.Sequence, a.Balance))
}

func (a *Account) ValidateSendOperation(op *SendOperation) bool {
	cost := op.Amount + op.Fee
	return cost <= a.Balance
}
