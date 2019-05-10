package consensus

import (
	"github.com/axiom-org/axiom/util"
)

// The nomination state for the Stellar Consensus Protocol.
// See page 21 of:
// https://www.stellar.org/papers/stellar-consensus-protocol.pdf
type NominationState struct {
	// The values we have voted to nominate
	X []SlotValue

	// The values we have accepted as nominated
	Y []SlotValue

	// The values whose nomination we have confirmed
	Z []SlotValue

	// The last NominationMessage received from each node
	N map[string]*NominationMessage

	// Who we are
	publicKey util.PublicKey

	// Who we listen to for quorum
	D *QuorumSlice

	// The number of messages this state has processed
	received int

	// Which priority we think we are for creating a nomination
	// 0 is the first priority
	// Negative means we should never create a nomination
	priority int

	// The value store we use to validate or combine values
	values ValueStore
}

func NewNominationState(
	publicKey util.PublicKey, qs *QuorumSlice, vs ValueStore) *NominationState {

	return &NominationState{
		X:         make([]SlotValue, 0),
		Y:         make([]SlotValue, 0),
		Z:         make([]SlotValue, 0),
		N:         make(map[string]*NominationMessage),
		publicKey: publicKey,
		D:         qs,
		priority:  SeedPriority(string(vs.Last()), qs.Members, publicKey.String()),
		values:    vs,
	}
}

func (s *NominationState) Logf(format string, a ...interface{}) {
	util.Logf("NS", s.publicKey.ShortName(), format, a...)
}

func (s *NominationState) Show() {
	s.Logf("nState:")
	s.Logf("X: %+v", s.X)
	s.Logf("Y: %+v", s.Y)
	s.Logf("Z: %+v", s.Z)
}

// HasNomination tells you whether this nomination state can currently send out
// a nominate message.
// If we have never received a nomination from a peer, and haven't had SetDefault
// called ourselves, then we won't have a nomination.
func (s *NominationState) HasNomination() bool {
	return len(s.X) > 0
}

// Returns whether we nominated a new value
func (s *NominationState) MaybeNominateNewValue() bool {
	if len(s.X) > 0 {
		// We already nominated a value
		return false
	}

	if s.priority < 0 || s.D.Threshold*s.priority > s.received {
		// We don't think it's our turn
		return false
	}

	v, ok := s.values.SuggestValue()
	if !ok {
		// We have nothing to nominate
		return false
	}

	s.Logf("nominating %s", util.Shorten(string(v)))
	s.NominateNewValue(v)
	return true
}

// WantsToNominateNewValue is a heuristic. If we already have some value, we don't
// want to nominate a new one. We also want to wait some time, according to our
// priority, before we are willing to make a nomination.
func (s *NominationState) WantsToNominateNewValue() bool {

	return s.D.Threshold*s.priority <= s.received
}

func (s *NominationState) NominateNewValue(v SlotValue) {
	if s.HasNomination() {
		// We already have something to nominate
		return
	}
	s.X = []SlotValue{v}
}

// PredictValue can predict the value iff HasNomination is true. If not, panic
func (s *NominationState) PredictValue() SlotValue {
	if len(s.Z) > 0 {
		return s.values.Combine(s.Z)
	}
	if len(s.Y) > 0 {
		return s.values.Combine(s.Y)
	}
	if len(s.X) > 0 {
		return s.values.Combine(s.X)
	}
	panic("PredictValue was called when HasNomination was false")
}

func (s *NominationState) QuorumSlice(node string) (*QuorumSlice, bool) {
	if node == s.publicKey.String() {
		return s.D, true
	}
	m, ok := s.N[node]
	if !ok {
		return nil, false
	}
	return m.D, true
}

func (s *NominationState) PublicKey() util.PublicKey {
	return s.publicKey
}

func (s *NominationState) AssertValid() {
	AssertNoDupes(s.X)
	AssertNoDupes(s.Y)
	AssertNoDupes(s.Z)
}

// MaybeAdvance checks whether we should accept the nomination for this slot value,
// and adds it to our accepted list if appropriate.
// It also checks whether we should confirm the nomination.
// Returns whether we made any changes.
func (s *NominationState) MaybeAdvance(v SlotValue) bool {
	if HasSlotValue(s.Z, v) {
		// We already confirmed this, so we can't do anything more
		return false
	}

	changed := false
	votedOrAccepted := []string{}
	accepted := []string{}
	if HasSlotValue(s.X, v) {
		votedOrAccepted = append(votedOrAccepted, s.publicKey.String())
	}
	if HasSlotValue(s.Y, v) {
		accepted = append(accepted, s.publicKey.String())
	}
	for node, m := range s.N {
		if HasSlotValue(m.Acc, v) {
			votedOrAccepted = append(votedOrAccepted, node)
			accepted = append(accepted, node)
			continue
		}
		if HasSlotValue(m.Nom, v) {
			votedOrAccepted = append(votedOrAccepted, node)
		}
	}

	// The rules for accepting are on page 13, section 5.3
	// Rule 1: if a quorum has either voted for the nomination or accepted the
	// nomination, we accept it.
	// Rule 2: if a blocking set for us accepts the nomination, we accept it.
	accept := MeetsQuorum(s, votedOrAccepted) || s.D.BlockedBy(accepted)

	if accept && !HasSlotValue(s.Y, v) {
		// Accept this value
		s.Logf("accepts the nomination of %s", util.Shorten(string(v)))
		changed = true
		AssertNoDupes(s.Y)
		s.Y = append(s.Y, v)
		accepted = append(accepted, s.publicKey.String())
		AssertNoDupes(s.Y)
	}

	// We confirm once a quorum has accepted
	if MeetsQuorum(s, accepted) {
		s.Logf("confirms the nomination of %s", util.Shorten(string(v)))
		changed = true
		s.Z = append(s.Z, v)
	}
	return changed
}

// Handles an incoming nomination message from a peer node
func (s *NominationState) Handle(node string, m *NominationMessage) {
	s.received++

	// What nodes we have seen new information about
	touched := []SlotValue{}

	// Check if there's anything new
	old, ok := s.N[node]
	var oldLenNom, oldLenAcc int
	if ok {
		oldLenNom = len(old.Nom)
		oldLenAcc = len(old.Acc)
	}
	if len(m.Nom) < oldLenNom {
		s.Logf("%s sent a stale message: %v", node, m)
		return
	}
	if len(m.Acc) < oldLenAcc {
		s.Logf("%s sent a stale message: %v", node, m)
		return
	}
	if len(m.Nom) == oldLenNom && len(m.Acc) == oldLenAcc {
		// It's just a dupe
		return
	}
	// Update our most-recent-message
	// s.Logf("got message from %s: %s", util.Shorten(node), m)
	s.N[node] = m

	for i := oldLenNom; i < len(m.Nom); i++ {
		value := m.Nom[i]
		if !HasSlotValue(touched, value) {
			touched = append(touched, value)
		}

		// If we don't have a candidate, and the value is valid,
		// we can support this new nomination
		if !HasSlotValue(s.X, value) && s.values.ValidateValue(value) {
			s.Logf("supports the nomination of %s", util.Shorten(string(value)))
			s.X = append(s.X, value)
		}
	}

	for i := oldLenAcc; i < len(m.Acc); i++ {
		if !HasSlotValue(touched, m.Acc[i]) {
			touched = append(touched, m.Acc[i])
		}
	}
	for _, v := range touched {
		s.MaybeAdvance(v)
	}
}

func (s *NominationState) Message(slot int, qs *QuorumSlice) *NominationMessage {
	return &NominationMessage{
		I:   slot,
		Nom: s.X,
		Acc: s.Y,
		D:   qs,
	}
}
