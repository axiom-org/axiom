package data

import (
	"fmt"
	"strings"
)

// Just some small utility functions

// Panic if there is an error.
func check(err error) {
	if err != nil {
		panic(err)
	}
}

// Comma-joins some numbers
func joinUint64s(ints []uint64) string {
	strs := []string{}
	for _, i := range ints {
		strs = append(strs, fmt.Sprintf("%d", i))
	}
	return strings.Join(strs, ",")
}
