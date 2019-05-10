package consensus

import (
	"fmt"
	"sort"
	"strings"

	"github.com/lacker/coinkit/util"
)

// See page 23 of the protocol paper for a description of balloting.
type BallotMessage interface {
	QuorumSlice() *QuorumSlice
	Phase() Phase
	MessageType() string
	Slot() int

	// AcceptAsPrepared tells whether this message implies that the sender
	// accepts this ballot as prepared
	AcceptAsPrepared(n int, x SlotValue) bool

	// VoteToPrepare indicates whether this message is actively voting to prepare,
	// not whether some past message can be determined to have voted to prepare.
	VoteToPrepare(n int, x SlotValue) bool

	// AcceptCommit tells whether this message implies that the sender
	// accepts this commit
	AcceptAsCommitted(n int, x SlotValue) bool

	// VoteToCommit indicates whether this message is actively voting
	// to commit, not whether some past message can be determined to
	// have voted to commit
	VoteToCommit(n int, x SlotValue) bool

	// The highest ballot number this node is voting for
	// Used to decide when we should start going to a higher number
	BallotNumber() int

	// CouldEverVoteFor tells whether the node that sent this message
	// could ever have this ballot as its active ballot
	CouldEverVoteFor(n int, x SlotValue) bool

	// RelevantRange returns the range of ballots that this message specifically
	// provides information for.
	RelevantRange(x SlotValue) (int, int)

	// Returns the highest ballot number that this message says anything about.
	MaxN() int

	// A readable, relatively-short string good for putting in logs.
	String() string
}

// Ballot phases
// Invalid is 0 so that if we inadvertently create a new message the wrong way and
// leave things zeroed it will be obviously an invalid phase
type Phase int

const (
	Invalid Phase = iota
	Prepare
	Confirm
	Externalize
)

func (p Phase) String() string {
	switch p {
	case Invalid:
		return "Invalid"
	case Prepare:
		return "Prepare"
	case Confirm:
		return "Confirm"
	case Externalize:
		return "Externalize"
	default:
		panic(fmt.Sprintf("unknown phase: %d", p))
	}
}

type Ballot struct {
	// An increasing counter, n >= 1, to ensure we can always have more ballots
	n int

	// The value this ballot proposes
	x SlotValue
}

func (b *Ballot) String() string {
	return fmt.Sprintf("(%d,%s)", b.n, util.Shorten(string(b.x)))
}

// Whether accepting a as prepared implies b is accepted as prepared
func gtecompat(a *Ballot, b *Ballot) bool {
	if a == nil || b == nil {
		return false
	}
	if a.n < b.n {
		return false
	}
	return a.x == b.x
}

// Whether accepting a as prepared implies accepting b is aborted
func gteincompat(a *Ballot, b *Ballot) bool {
	if a == nil || b == nil {
		return false
	}
	if a.n < b.n {
		return false
	}
	return a.x != b.x
}

// PrepareMessage is the first phase of the three-phase ballot protocol.
// This message is preparing a ballot.
// To prepare is to abort any conflicting ballots.
// This message is voting to prepare b, and also informing the receiver that
// we have accepted that both p and p prime have already been prepared.
type PrepareMessage struct {
	// What slot we are preparing ballots for
	I int `json:"i"`

	// The ballot we are voting to prepare
	Bn int       `json:"bn"`
	Bx SlotValue `json:"bx"`

	// The contents of state.p, which we accept as prepared
	Pn int       `json:"pn"`
	Px SlotValue `json:"px"`

	// The contents of state.pPrime, which we accept as prepared
	Ppn int       `json:"ppn"`
	Ppx SlotValue `json:"ppx"`

	// Ballot numbers for c and h
	Cn int `json:"cn"`
	Hn int `json:"hn"`

	D *QuorumSlice `json:"d"`
}

func (m *PrepareMessage) String() string {
	parts := []string{fmt.Sprintf("prepare i=%d b=%d,%s",
		m.I, m.Bn, util.Shorten(string(m.Bx)))}
	if m.Pn > 0 {
		parts = append(parts, fmt.Sprintf("p=%d,%s",
			m.Pn, util.Shorten(string(m.Px))))
	}
	if m.Ppn > 0 {
		parts = append(parts, fmt.Sprintf("pp=%d,%s",
			m.Ppn, util.Shorten(string(m.Ppx))))
	}
	if m.Cn > 0 || m.Hn > 0 {
		parts = append(parts, fmt.Sprintf("ch=%d,%d", m.Cn, m.Hn))
	}
	return strings.Join(parts, " ")
}

func (m *PrepareMessage) QuorumSlice() *QuorumSlice {
	return m.D
}

func (m *PrepareMessage) Phase() Phase {
	return Prepare
}

func (m *PrepareMessage) MessageType() string {
	return "Prepare"
}

func (m *PrepareMessage) AcceptAsPrepared(n int, x SlotValue) bool {
	// A prepare message accepts that both p and p prime are prepared.
	if m.Px == x {
		return m.Pn >= n
	}
	if m.Ppx == x {
		return m.Ppn >= n
	}
	return false
}

func (m *PrepareMessage) VoteToPrepare(n int, x SlotValue) bool {
	return x == m.Bx && m.Bn >= n
}

func (m *PrepareMessage) AcceptAsCommitted(n int, x SlotValue) bool {
	return false
}

func (m *PrepareMessage) VoteToCommit(n int, x SlotValue) bool {
	if m.Cn == 0 || m.Hn == 0 || m.Bx != x {
		return false
	}
	return m.Cn <= n && n <= m.Hn
}

func (m *PrepareMessage) CouldEverVoteFor(n int, x SlotValue) bool {
	if m.Bn > n {
		// Ballots don't go backwards
		return false
	}
	if m.Bn == n && m.Bx != x {
		// This message is currently voting *against*
		return false
	}
	return true
}

func (m *PrepareMessage) RelevantRange(x SlotValue) (int, int) {
	min, max := 0, 0
	if x == m.Bx {
		min, max = MakeRange(m.Bn, m.Cn, m.Hn)
	}
	if x == m.Px {
		min, max = RangeUnion(min, max, m.Pn, m.Pn)
	}
	if x == m.Ppx {
		min, max = RangeUnion(min, max, m.Ppn, m.Ppn)
	}
	return min, max
}

func (m *PrepareMessage) MaxN() int {
	ns := []int{m.Bn, m.Cn, m.Hn, m.Pn, m.Ppn}
	sort.Ints(ns)
	return ns[len(ns)-1]
}

func (m *PrepareMessage) BallotNumber() int {
	return m.Bn
}

func (m *PrepareMessage) Slot() int {
	return m.I
}

// ConfirmMessage is the second phase of the three-phase ballot protocol
// "Confirm" seems like a bad name for this phase, it seems like it should be
// named "Commit". Because you are also confirming as part of nominate and prepare.
// I stuck with "Confirm" because that's what the paper calls it.
// Intuitively (sic), a confirm message is accepting a commit.
// The consensus can still get borked at this phase if we don't get a
// quorum confirming.
type ConfirmMessage struct {
	// What slot we are confirming ballots for
	I int `json:"i"`

	// The value that we are accepting a commit for.
	X SlotValue `json:"x"`

	// state.p.n
	Pn int `json:"pn"`

	// The range of ballot numbers we accept a commit for.
	Cn int `json:"cn"`
	Hn int `json:"hn"`

	D *QuorumSlice `json:"d"`
}

func (m *ConfirmMessage) String() string {
	return fmt.Sprintf("confirm i=%d x=%s p=%d ch=%d,%d",
		m.I, util.Shorten(string(m.X)), m.Pn, m.Cn, m.Hn)
}

func (m *ConfirmMessage) QuorumSlice() *QuorumSlice {
	return m.D
}

func (m *ConfirmMessage) Phase() Phase {
	return Confirm
}

func (m *ConfirmMessage) MessageType() string {
	return "Confirm"
}

func (m *ConfirmMessage) AcceptAsPrepared(n int, x SlotValue) bool {
	return m.X == x
}

func (m *ConfirmMessage) VoteToPrepare(n int, x SlotValue) bool {
	return false
}

func (m *ConfirmMessage) AcceptAsCommitted(n int, x SlotValue) bool {
	return m.X == x && m.Cn <= n && n <= m.Hn
}

func (m *ConfirmMessage) VoteToCommit(n int, x SlotValue) bool {
	return m.X == x
}

func (m *ConfirmMessage) CouldEverVoteFor(n int, x SlotValue) bool {
	return x == m.X
}

func (m *ConfirmMessage) RelevantRange(x SlotValue) (int, int) {
	if x == m.X {
		return MakeRange(m.Pn, m.Cn, m.Hn)
	}
	return 0, 0
}

func (m *ConfirmMessage) MaxN() int {
	ns := []int{m.Pn, m.Cn, m.Hn}
	sort.Ints(ns)
	return ns[len(ns)-1]
}

func (m *ConfirmMessage) BallotNumber() int {
	return m.Hn
}

func (m *ConfirmMessage) Slot() int {
	return m.I
}

// ExternalizeMessage is the third phase of the three-phase ballot protocol
// Sent after we have confirmed a commit.
type ExternalizeMessage struct {
	// What slot we are externalizing
	I int `json:"i"`

	// The value at this slot
	X SlotValue `json:"x"`

	// The range of ballot numbers we confirm a commit for
	Cn int `json:"cn"`
	Hn int `json:"hn"`

	D *QuorumSlice `json:"d"`
}

func (m *ExternalizeMessage) String() string {
	return fmt.Sprintf("externalize i=%d x=%s ch=%d,%d",
		m.I, util.Shorten(string(m.X)), m.Cn, m.Hn)
}

func (m *ExternalizeMessage) QuorumSlice() *QuorumSlice {
	return m.D
}

func (m *ExternalizeMessage) Phase() Phase {
	return Externalize
}

func (m *ExternalizeMessage) MessageType() string {
	return "Externalize"
}

func (m *ExternalizeMessage) AcceptAsPrepared(n int, x SlotValue) bool {
	return m.X == x
}

func (m *ExternalizeMessage) VoteToPrepare(n int, x SlotValue) bool {
	return false
}

func (m *ExternalizeMessage) AcceptAsCommitted(n int, x SlotValue) bool {
	return x == m.X && m.Cn <= n
}

func (m *ExternalizeMessage) VoteToCommit(n int, x SlotValue) bool {
	return false
}

func (m *ExternalizeMessage) CouldEverVoteFor(n int, x SlotValue) bool {
	return x == m.X
}

func (m *ExternalizeMessage) RelevantRange(x SlotValue) (int, int) {
	if x == m.X {
		return MakeRange(m.Cn, m.Hn)
	}
	return 0, 0
}

func (m *ExternalizeMessage) MaxN() int {
	return m.Hn
}

func (m *ExternalizeMessage) BallotNumber() int {
	return m.Hn
}

func (m *ExternalizeMessage) Slot() int {
	return m.I
}

// Compare returns -1 if ballot1 < ballot2
// 0 if ballot1 == ballot2
// 1 if ballot1 > ballot2
// Ballots are ordered by:
// (phase, b, p, p prime, h)
// This is only intended to be used to compare messages coming from the same node.
func Compare(ballot1 BallotMessage, ballot2 BallotMessage) int {
	phase1 := ballot1.Phase()
	phase2 := ballot2.Phase()
	if phase1 < phase2 {
		return -1
	}
	if phase1 > phase2 {
		return 1
	}
	switch b1 := ballot1.(type) {
	case *PrepareMessage:
		b2 := ballot2.(*PrepareMessage)
		if b1.Bn < b2.Bn {
			return -1
		}
		if b1.Bn > b2.Bn {
			return 1
		}
		if b1.Pn < b2.Pn {
			return -1
		}
		if b1.Pn > b2.Pn {
			return 1
		}
		if b1.Ppn < b2.Ppn {
			return -1
		}
		if b1.Ppn > b2.Ppn {
			return 1
		}
		if b1.Hn < b2.Hn {
			return -1
		}
		if b1.Hn > b2.Hn {
			return 1
		}
		return 0
	case *ConfirmMessage:
		b2 := ballot2.(*ConfirmMessage)
		if b1.Pn < b2.Pn {
			return -1
		}
		if b1.Pn > b2.Pn {
			return 1
		}
		if b1.Hn < b2.Hn {
			return -1
		}
		if b1.Hn > b2.Hn {
			return 1
		}
		return 0
	case *ExternalizeMessage:
		b2 := ballot2.(*ExternalizeMessage)
		if b1.Hn < b2.Hn {
			return -1
		}
		if b1.Hn > b2.Hn {
			return 1
		}
		return 0
	default:
		panic("programming error")
	}
}

func init() {
	util.RegisterMessageType(&PrepareMessage{})
	util.RegisterMessageType(&ConfirmMessage{})
	util.RegisterMessageType(&ExternalizeMessage{})
}
