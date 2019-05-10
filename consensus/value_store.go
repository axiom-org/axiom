package consensus

import (
	"fmt"
	"sort"
	"strings"

	"github.com/lacker/coinkit/util"
)

// This is an id for the full slot value. The ValueStore should be able to
// provide application-relevant information about it.
type SlotValue string

func AssertNoDupes(list []SlotValue) {
	m := make(map[string]bool)
	for _, v := range list {
		s := string(v)
		if m[s] {
			util.Logger.Fatalf("dupe in %+v", list)
		}
		m[s] = true
	}
}

func HasSlotValue(a []SlotValue, b SlotValue) bool {
	for _, x := range a {
		if x == b {
			return true
		}
	}
	return false
}

// The consensus protocol is going to send around possible slot values a lot,
// so we don't want to send them in their entirety each time. Instead, we
// use a value manager to have a unique id for every possible value.
// This also helps test the consensus protocol with test values.
type ValueStore interface {
	Combine(list []SlotValue) SlotValue

	// Whether the ValueStore is ready to finalize this value
	CanFinalize(v SlotValue) bool

	// Called when a value is finalized
	Finalize(v SlotValue, c int, h int, qs *QuorumSlice)

	// The last finalized slot value
	Last() SlotValue

	// SuggestValue is called when the consensus logic wants us to initialize
	// the next slot value
	// The bool is false when there is no value to suggest
	SuggestValue() (SlotValue, bool)

	// ValidateValue returns whether a value can be used by the consensus
	// mechanism.
	ValidateValue(v SlotValue) bool
}

// For testing, id strings are comma-separated lists of values.
type TestValueStore struct {
	last       SlotValue
	suggestion SlotValue
}

func NewTestValueStore(n int) *TestValueStore {
	return &TestValueStore{
		last:       "",
		suggestion: SlotValue(fmt.Sprintf("value%d", n)),
	}
}

func (t *TestValueStore) Combine(list []SlotValue) SlotValue {
	m := make(map[string]bool)
	for _, s := range list {
		for _, part := range strings.Split(string(s), ",") {
			m[part] = true
		}
	}
	parts := []string{}
	for part, _ := range m {
		parts = append(parts, part)
	}
	sort.Strings(parts)
	return SlotValue(strings.Join(parts, ","))
}

func (t *TestValueStore) CanFinalize(v SlotValue) bool {
	return true
}

func (t *TestValueStore) Finalize(v SlotValue, c int, h int, qs *QuorumSlice) {
	t.last = v
}

func (t *TestValueStore) Last() SlotValue {
	return t.last
}

func (t *TestValueStore) SuggestValue() (SlotValue, bool) {
	return t.suggestion, true
}

func (t *TestValueStore) ValidateValue(v SlotValue) bool {
	return true
}
