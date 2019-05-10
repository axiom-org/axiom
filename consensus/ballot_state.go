package consensus

import (
	"sort"

	"github.com/lacker/coinkit/util"
)

// The ballot state for the Stellar Consensus Protocol.
// See page 23 of
// https://www.stellar.org/papers/stellar-consensus-protocol.pdf
type BallotState struct {
	// What phase of balloting we are in
	phase Phase

	// The current ballot we are trying to prepare and commit.
	b *Ballot

	// The last value of b we saw during validation.
	// This is just used to make sure the values of b are monotonically
	// increasing, to ensure we don't vote for contradictory things.
	last *Ballot

	// The highest two incompatible ballots that are accepted as prepared.
	// p is the highest, pPrime the next.
	// It's nil if there is no such ballot.
	p      *Ballot
	pPrime *Ballot

	// cn and hn are two weird numbers that are best understood, sadly, by
	// reading the SCP paper.
	// When cn and hn are both > 0, it indicated a range.
	// In the Prepare phase, this is the range we have voted to commit (which
	// we do when we can confirm the ballot is prepared) but that we have not
	// aborted.
	// In the Confirm phase, this is the range we have accepted a commit.
	// In the Externalize phase, this is the range we have confirmed a commit.
	// When cn and hn are both = 0, it means we haven't confirmed any preps.
	// When cn = 0 and hn > 0, it means we did confirm a prepare, but it
	// later got aborted, so now it's only useful to figure out what
	// value to use on subsequent ballots.
	cn int
	hn int

	// The value to use in the next ballot, if this ballot fails.
	// This is the highest ballot that we have confirmed as prepared,
	// if that value is unique.
	// If that rule does not provide us a value, we should defer to the
	// nomination state, and z is nil.
	z *SlotValue

	// The latest PrepareMessage, ConfirmMessage, or ExternalizeMessage from
	// each peer
	M map[string]BallotMessage

	// How many duplicate messages we received from each peer
	// Used like a timer to guess when we should advance rounds
	stale map[string]int

	// Who we are
	publicKey util.PublicKey

	// Who we listen to for quorum
	D *QuorumSlice

	// The nomination state
	nState *NominationState
}

func NewBallotState(publicKey util.PublicKey, qs *QuorumSlice, nState *NominationState) *BallotState {
	return &BallotState{
		phase:     Prepare,
		M:         make(map[string]BallotMessage),
		publicKey: publicKey,
		stale:     make(map[string]int),
		D:         qs,
		nState:    nState,
	}
}

func (s *BallotState) Logf(format string, a ...interface{}) {
	util.Logf("BS", s.publicKey.ShortName(), format, a...)
}

func (s *BallotState) Show() {
	s.Logf("bState:")
	if s.phase != Prepare {
		s.Logf("phase: %s", s.phase)
	}
	s.Logf("b: %+v", s.b)
	s.Logf("p: %+v", s.p)
	s.Logf("pPrime: %+v", s.pPrime)
	s.Logf("c: %d", s.cn)
	s.Logf("h: %d", s.hn)
	if s.z == nil {
		if !s.nState.HasNomination() {
			s.Logf("no candidate value")
		} else {
			s.Logf("candidate: %s", s.nState.PredictValue())
		}
	} else {
		s.Logf("z: %s", *s.z)
	}
}

func (s *BallotState) PublicKey() util.PublicKey {
	return s.publicKey
}

func (s *BallotState) QuorumSlice(node string) (*QuorumSlice, bool) {
	if node == s.publicKey.String() {
		return s.D, true
	}
	m, ok := s.M[node]
	if !ok {
		return nil, false
	}
	qs := m.QuorumSlice()
	return qs, true
}

// MaybeAcceptAsPrepared returns true if the ballot state changes.
func (s *BallotState) MaybeAcceptAsPrepared(n int, x SlotValue) bool {
	if s.phase != Prepare {
		return false
	}
	if n == 0 {
		return false
	}

	// Check if we already accept this as prepared
	if s.p != nil && s.p.n >= n && s.p.x == x {
		return false
	}
	if s.pPrime != nil && s.pPrime.n >= n && s.pPrime.x == x {
		return false
	}

	if s.pPrime != nil && s.pPrime.n >= n {
		// This is about an old ballot number, we don't care even if it is
		// accepted
		return false
	}

	// The rules for accepting are, if a quorum has voted or accepted,
	// we can accept.
	// Or, if a local blocking set has accepted, we can accept.
	votedOrAccepted := []string{}
	accepted := []string{}
	if s.b != nil && s.b.n >= n && s.b.x == x {
		// We have voted for this
		votedOrAccepted = append(votedOrAccepted, s.publicKey.String())
	}

	for node, m := range s.M {
		if m.AcceptAsPrepared(n, x) {
			accepted = append(accepted, node)
			votedOrAccepted = append(votedOrAccepted, node)
			continue
		}
		if m.VoteToPrepare(n, x) {
			votedOrAccepted = append(votedOrAccepted, node)
		}
	}

	if !MeetsQuorum(s, votedOrAccepted) && !s.D.BlockedBy(accepted) {
		// We can't accept this as prepared yet
		return false
	}

	ballot := &Ballot{
		n: n,
		x: x,
	}
	s.Logf("accepts as prepared: %s", ballot)

	// p and p prime should be the top two conflicting things we accept
	// as prepared. update them accordingly
	if s.p == nil {
		s.p = ballot
	} else if s.p.x == x {
		if n <= s.p.n {
			util.Logger.Fatal("should have short circuited already")
		}
		s.p = ballot
	} else if n >= s.p.n {
		s.pPrime = s.p
		s.p = ballot
	} else {
		// We already short circuited if it isn't worth bumping p prime
		s.pPrime = ballot
	}

	// Check if accepting this prepare means that we should abort our
	// votes to commit
	if s.cn != 0 && s.hn != 0 && s.AcceptedAbort(s.hn, s.b.x) {
		s.Logf("%s accepts the abort of %d %+v", s.hn, s.b.x)
		s.cn = 0
	}

	return true
}

// AcceptedAbort returns whether we have already accepted an abort for the
// ballot number and slot value provided.
func (s *BallotState) AcceptedAbort(n int, x SlotValue) bool {
	if s.phase != Prepare {
		// After the prepare phase, we've accepted an abort for everything
		// else.
		return x != s.b.x
	}

	if s.p != nil && s.p.n >= n && s.p.x != x {
		// we accept p is prepared, which implies we accept this abort
		return true
	}

	if s.pPrime != nil && s.pPrime.n >= n && s.pPrime.x != x {
		// we accept p' is prepared, which implies we accept this abort
		return true
	}

	// No reason to think we accept this abort
	return false
}

// MaybeConfirmAsPrepared returns whether anything in the ballot state changed.
func (s *BallotState) MaybeConfirmAsPrepared(n int, x SlotValue) bool {
	if s.phase != Prepare {
		return false
	}
	if s.hn > n {
		// We already confirmed a ballot as prepared that is better than
		// this one.
		return false
	}
	if s.hn == n {
		if s.z == nil {
			// We have confirmed the abort of every ballot in this
			// round of voting, so there's no point in proceeding.
			return false
		}
		if *s.z == x {
			// We already confirmed this ballot as prepared.
			return false
		}
	}

	ballot := &Ballot{
		n: n,
		x: x,
	}

	// We confirm when a quorum accepts as prepared
	accepted := []string{}
	if gtecompat(s.p, ballot) || gtecompat(s.pPrime, ballot) {
		// We accept as prepared
		accepted = append(accepted, s.publicKey.String())
	}

	for node, m := range s.M {
		if m.AcceptAsPrepared(n, x) {
			accepted = append(accepted, node)
		}
	}

	if !MeetsQuorum(s, accepted) {
		return false
	}

	s.Logf("confirms as prepared: %s", &Ballot{n: n, x: x})

	if s.hn == n {
		// We have two equally high ballots and they are both
		// confirmed as prepared. This means that every ballot is
		// both prepared and aborted at this ballot number, and we'll have to go
		// to a future ballot.
		s.Logf("confirmed abort of all ballots with number %d", n)
		s.cn = 0
		s.z = nil
		return true
	}

	if s.cn > 0 && x != s.b.x {
		s.Show()
		util.Logger.Fatalf("we are voting to commit but must confirm a contradiction")
	}

	// This value is now our default for future rounds
	s.hn = n
	s.z = &x

	if s.b == nil {
		// We weren't working on any ballot, but now we can work on this one
		s.b = ballot
	}

	if s.cn == 0 && x == s.b.x {
		// Check if we should start voting to commit
		if gteincompat(s.p, ballot) || gteincompat(s.pPrime, ballot) {
			// We have already accepted the abort of this. So nope.
		} else if s.b.n > n {
			// We are already past this ballot number. We might have
			// even voted to abort it. So we can't vote to commit.
		} else {
			s.cn = s.b.n
		}
	}

	return true
}

// MaybeAcceptAsCommitted returns whether anything in the ballot state changed.
func (s *BallotState) MaybeAcceptAsCommitted(n int, x SlotValue) bool {
	if s.phase == Externalize {
		return false
	}
	if s.phase == Confirm && s.cn <= n && n <= s.hn {
		// We already do accept this commit
		return false
	}

	votedOrAccepted := []string{}
	accepted := []string{}

	if s.phase == Prepare && s.b != nil &&
		s.b.x == x && s.cn != 0 && s.cn <= n && n <= s.hn {
		// We vote to commit this
		votedOrAccepted = append(votedOrAccepted, s.publicKey.String())
	}

	for node, m := range s.M {
		if m.AcceptAsCommitted(n, x) {
			votedOrAccepted = append(votedOrAccepted, node)
			accepted = append(accepted, node)
		} else if m.VoteToCommit(n, x) {
			votedOrAccepted = append(votedOrAccepted, node)
		}
	}

	if !MeetsQuorum(s, votedOrAccepted) && !s.D.BlockedBy(accepted) {
		// We can't accept this commit yet
		return false
	}

	s.Logf("accepts as committed: %s", &Ballot{n: n, x: x})

	// We accept this commit
	s.phase = Confirm
	if s.b == nil || s.b.x != x {
		// Totally replace our old target value
		s.b = &Ballot{
			n: n,
			x: x,
		}
		s.cn = n
		s.hn = n
		s.z = &x
	} else {
		// Just update our range of acceptance
		if n < s.cn {
			s.cn = n
		}
		if n > s.hn {
			s.hn = n
		}
	}
	return true
}

// MaybeConfirmAsCommitted returns whether anything in the ballot state changed.
func (s *BallotState) MaybeConfirmAsCommitted(n int, x SlotValue) bool {
	if s.phase == Prepare {
		return false
	}
	if s.b == nil || s.b.x != x {
		return false
	}

	accepted := []string{}
	if s.phase == Confirm {
		if s.cn <= n && n <= s.hn {
			accepted = append(accepted, s.publicKey.String())
		}
	} else if s.cn <= n && n <= s.hn {
		// We already did confirm this as committed
		return false
	}

	for node, m := range s.M {
		if m.AcceptAsCommitted(n, x) {
			accepted = append(accepted, node)
		}
	}

	if !MeetsQuorum(s, accepted) {
		return false
	}

	s.Logf("confirms as committed: %s", &Ballot{n: n, x: x})

	if s.phase == Confirm {
		s.phase = Externalize
		s.cn = n
		s.hn = n
	} else {
		if n < s.cn {
			s.cn = n
		}
		if n > s.hn {
			s.hn = n
		}
	}

	return true
}

// GoToNextBallot returns whether we could actually go to the next ballot.
func (s *BallotState) GoToNextBallot() bool {
	b := &Ballot{}

	if s.b == nil {
		// Start with ballot 1
		b.n = 1
	} else {
		b.n = s.b.n + 1
	}

	if s.z != nil {
		b.x = *s.z
	} else {
		if !s.nState.HasNomination() {
			// We don't have a candidate value so we can't go to the next ballot
			return false
		}
		b.x = s.nState.PredictValue()
	}

	s.b = b
	if s.cn == 0 && s.hn >= s.b.n && !s.AcceptedAbort(s.hn, s.b.x) {
		// With the new ballot, we can immediately vote to commit
		s.cn = s.b.n
	}

	return true
}

// CheckForBlockedBallot returns whether we ended up changing the state.
// We bump the ballot number if the set of nodes that could never vote
// for our ballot is blocking, and we have a candidate value.
func (s *BallotState) CheckForBlockedBallot() bool {
	if s.b == nil {
		return false
	}

	// Nodes that could never vote for our ballot
	blockers := []string{}

	for node, m := range s.M {
		if !m.CouldEverVoteFor(s.b.n, s.b.x) {
			blockers = append(blockers, node)
		}
	}

	if !s.D.BlockedBy(blockers) {
		return false
	}

	return s.GoToNextBallot()
}

// HandleStaleQuorum returns whether we ended up changing the ballot state.
// The assumption is that the system is stuck on some ballot, and we should
// proceed to the next ballot if this could be the stuck one.
// TODO: could we just use CheckForBlockedBallot here?
func (s *BallotState) HandleStaleQuorum() bool {
	if s.b == nil {
		return false
	}

	// Nodes that are behind us in balloting
	behind := []string{}

	for node, m := range s.M {
		if m.BallotNumber() < s.b.n {
			behind = append(behind, node)
		}
	}

	if s.D.BlockedBy(behind) {
		// Our ballot is blocked because other nodes are behind it.
		// We should wait for them to catch up rather than advancing further.
		return false
	}

	return s.GoToNextBallot()
}

// CheckIfStale is a heuristic to guess whether the network is blocked.
// We do rely on this heuristic being neither too aggressive nor too conservative
// for values to converge.
func (s *BallotState) CheckIfStale() {
	stale := []string{s.publicKey.String()}
	for node, staleCount := range s.stale {
		if staleCount >= 3 {
			stale = append(stale, node)
		}
	}
	if MeetsQuorum(s, stale) {
		s.stale = make(map[string]int)
		s.HandleStaleQuorum()
	}
}

// Update the stage of this ballot as needed
// See the handling algorithm on page 24 of the Mazieres paper.
// The investigate method does steps 1-8
func (s *BallotState) InvestigateBallot(n int, x SlotValue) {
	if n < 1 {
		return
	}
	s.MaybeAcceptAsPrepared(n, x)
	s.MaybeConfirmAsPrepared(n, x)
	s.MaybeAcceptAsCommitted(n, x)
	s.MaybeConfirmAsCommitted(n, x)
}

// RelevantRange returns the range of ballots that at least one of our
// peers is talking about, for this slot value.
func (s *BallotState) RelevantRange(x SlotValue) (int, int) {
	min, max := 0, 0
	for _, message := range s.M {
		a, b := message.RelevantRange(x)
		min, max = RangeUnion(min, max, a, b)
	}
	return min, max
}

// Returns the max ballot number that a blocking set of nodes are talking about.
func (s *BallotState) MaxActionableBallotNumber() int {
	numberToNodes := make(map[int][]string)

	for node, message := range s.M {
		maxN := message.MaxN()
		numberToNodes[maxN] = append(numberToNodes[maxN], node)
	}

	i := 0
	nKeys := make([]int, len(numberToNodes))
	for n := range numberToNodes {
		nKeys[i] = n
		i++
	}

	sort.Sort(sort.Reverse(sort.IntSlice(nKeys)))

	nodesAbove := []string{}

	for _, n := range nKeys {
		nodesAbove = append(nodesAbove, numberToNodes[n]...)
		if s.D.BlockedBy(nodesAbove) {
			return n
		}
	}

	return 0
}

// InvestigateValue checks if any information can be updated for this value.
func (s *BallotState) InvestigateValue(x SlotValue) {
	min, max := s.RelevantRange(x)
	maxActionable := s.MaxActionableBallotNumber()
	if max > maxActionable {
		max = maxActionable
	}

	i := min
	for ; i <= max; i++ {
		s.InvestigateBallot(i, x)
	}

	if s.b != nil && i <= s.b.n {
		s.InvestigateBallot(s.b.n, x)
	}
}

func (s *BallotState) InvestigateValues(values ...SlotValue) {
	done := []SlotValue{}
	for _, value := range values {
		if HasSlotValue(done, value) {
			continue
		}
		s.InvestigateValue(value)
		done = append(done, value)
	}
}

// SelfInvestigate checks whether the current ballot can be advanced
// Useful for debugging, not so useful for the standard algorithm because
// it tends to miss cases where things can be advanced that aren't our
// current ballot.
func (s *BallotState) SelfInvestigate() {
	if s.b == nil {
		return
	}
	s.InvestigateBallot(s.b.n, s.b.x)
}

func (s *BallotState) Handle(node string, message BallotMessage) {
	// If this message isn't new, skip it
	old, ok := s.M[node]
	if ok && Compare(old, message) >= 0 {
		s.stale[node]++
		s.CheckIfStale()
		return
	}
	// s.Logf("got message from %s: %s", util.Shorten(node), message)
	s.stale[node] = 0
	s.M[node] = message

	for {
		// Investigate all ballots whose state might be updated
		switch m := message.(type) {
		case *PrepareMessage:
			s.InvestigateValues(m.Bx, m.Px, m.Ppx)
		case *ConfirmMessage:
			s.InvestigateValue(m.X)
		case *ExternalizeMessage:
			s.InvestigateValue(m.X)
		}

		// Step 9 of the processing algorithm
		if !s.CheckForBlockedBallot() {
			break
		}
	}
}

func (s *BallotState) HasMessage() bool {
	return s.b != nil
}

func (s *BallotState) AssertValid() {
	if s.cn > s.hn {
		s.Show()
		util.Logger.Fatalf("c should be <= h")
	}

	if s.p != nil && s.pPrime != nil && s.p.x == s.pPrime.x {
		s.Logf("p: %+v", s.p)
		s.Logf("pPrime: %+v", s.pPrime)
		util.Logger.Fatalf("p and p prime should not be compatible")
	}

	if s.b != nil && s.phase == Prepare {
		if s.p != nil && s.b.x != s.p.x && s.cn != 0 && s.hn <= s.p.n {
			s.Logf("b: %+v", s.b)
			s.Logf("c: %d", s.cn)
			s.Logf("h: %d", s.hn)
			s.Logf("p: %+v", s.p)
			util.Logger.Fatalf("the vote to commit should have been aborted")
		}
		if s.pPrime != nil && s.b.x != s.pPrime.x && s.cn != 0 && s.hn <= s.pPrime.n {
			s.Logf("b: %+v", s.b)
			s.Logf("c: %d", s.cn)
			s.Logf("h: %d", s.hn)
			s.Logf("pPrime: %+v", s.pPrime)
			util.Logger.Fatalf("the vote to commit should have been aborted")
		}
	}

	if s.b != nil && s.phase == Prepare {
		if s.last != nil && s.b.x != s.last.x && s.last.n > s.b.n {
			s.Logf("last b: %+v", s.last)
			s.Logf("curr b: %+v", s.b)
			util.Logger.Fatalf("monotonicity violation")
		}

		s.last = s.b
	}
}

func (s *BallotState) Message(slot int, qs *QuorumSlice) BallotMessage {
	if !s.HasMessage() {
		panic("coding error")
	}

	switch s.phase {
	case Prepare:
		m := &PrepareMessage{
			I:  slot,
			Bn: s.b.n,
			Bx: s.b.x,
			Cn: s.cn,
			Hn: s.hn,
			D:  qs,
		}
		if s.p != nil {
			m.Pn = s.p.n
			m.Px = s.p.x
		}
		if s.pPrime != nil {
			m.Ppn = s.pPrime.n
			m.Ppx = s.pPrime.x
		}
		return m

	case Confirm:
		m := &ConfirmMessage{
			I:  slot,
			X:  s.b.x,
			Cn: s.cn,
			Hn: s.hn,
			D:  qs,
		}
		if s.p != nil {
			m.Pn = s.p.n
		}
		return m

	case Externalize:
		return &ExternalizeMessage{
			I:  slot,
			X:  s.b.x,
			Cn: s.cn,
			Hn: s.hn,
			D:  qs,
		}
	}

	panic("code flow should not get here")
}
