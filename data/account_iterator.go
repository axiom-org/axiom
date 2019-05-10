package data

import ()

// Typically an AccountIterator iterates in sorted order.
type AccountIterator interface {
	// Next returns nil when there are no more accounts left
	Next() *Account
}

func CheckAccountsMatch(iter1 AccountIterator, iter2 AccountIterator) error {
	for {
		a1 := iter1.Next()
		a2 := iter2.Next()
		err := a1.CheckEqual(a2)
		if err != nil {
			return err
		}
	}
}
