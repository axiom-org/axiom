package data

import (
	"fmt"

	"github.com/axiom-org/axiom/util"
)

// Money is measured in "microaxioms".
// A million microaxioms = Ax$1.
// The target is for Ax$1 to be worth roughly $1 in USD.
// The price of decentralized storage is currently pegged at $3 per gigabyte per month.
// The goal is 1/3 goes to the file host, 1/3 to the app developer, 1/3 to the protocol
// developers. So that means that if you host a single kilobyte for a month you make
// one microaxiom.
// Currently TotalMoney is approximately the size of hosting 333G of files on the initial
// seed servers. Once payment is in place, the total amount of money can float.
const TotalMoney = 1e9
const CostPerMegabyteMonth = 3000

type Account struct {
	Owner string `json:"owner"`

	// The sequence id of the last operation authorized by this account.
	// 0 means there have never been any authorized operations.
	// Used to prevent replay attacks.
	Sequence uint32 `json:"sequence"`

	// The current balance of this account.
	Balance uint64 `json:"balance"`

	// How much total bucket size, in megabytes, this account is currently storing.
	Storage uint32 `json:"storage"`
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

func (a *Account) CanAddStorage(amount uint32) {
	possible := a.Storage + amount
	return CostPerMegabyteMonth*possible <= a.Balance
}
