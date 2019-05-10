package consensus

import (
	"crypto/sha512"
	"encoding/base64"
	"sort"
)

func HashString(x string) string {
	h := sha512.New512_256()
	hashBytes := h.Sum([]byte(x))
	return base64.RawStdEncoding.EncodeToString(hashBytes)
}

// SeedSort sorts in a way that is repeatable depending on the seed string.
// Does not mutate input
func SeedSort(seed string, input []string) []string {
	m := make(map[string]string)
	keys := []string{}
	for _, x := range input {
		hashed := HashString(seed + x)
		m[hashed] = x
		keys = append(keys, hashed)
	}
	sort.Strings(keys)
	answer := []string{}
	for _, key := range keys {
		answer = append(answer, m[key])
	}
	return answer
}

// SeedPriority returns the index of node in the seed-sorted list
// -1 indicates we should never nominate anything
func SeedPriority(seed string, input []string, node string) int {
	sorted := SeedSort(seed, input)
	for i, value := range sorted {
		if value == node {
			return i
		}
	}
	return -1
}
