package util

import (
	"flag"
	"os"
	"strconv"
)

// Returns whether we are currently in a unit test environment
func Testing() bool {
	return flag.Lookup("test.v") != nil
}

func GetTestLoopLength(short int64, long int64) int64 {
	arg, err := strconv.Atoi(os.Getenv("COINKIT_LONG_TESTS"))
	if err == nil && arg == 1 {
		return long
	} else {
		return short
	}
}
