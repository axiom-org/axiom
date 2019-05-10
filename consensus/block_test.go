package consensus

import (
	"math"
	"math/rand"
	"testing"

	"github.com/lacker/coinkit/util"

	"github.com/davecgh/go-spew/spew"
)

func TestSolipsistQuorum(t *testing.T) {
	vs := NewTestValueStore(1)
	kp := util.NewKeyPairFromSecretPhrase("foo")
	s := NewBlock(kp.PublicKey(),
		NewQuorumSlice([]string{kp.PublicKey().String()}, 1), 1, vs)
	if !MeetsQuorum(s.nState, []string{kp.PublicKey().String()}) {
		t.Fatal("known public key should meet the quorum")
	}
	if MeetsQuorum(s.nState, []string{"bar"}) {
		t.Fatal("bar should not meet the quorum")
	}
}

func TestConsensus(t *testing.T) {
	apk := util.NewKeyPairFromSecretPhrase("amy").PublicKey()
	bpk := util.NewKeyPairFromSecretPhrase("bob").PublicKey()
	cpk := util.NewKeyPairFromSecretPhrase("cal").PublicKey()
	dpk := util.NewKeyPairFromSecretPhrase("dan").PublicKey()
	members := []string{
		apk.String(),
		bpk.String(),
		cpk.String(),
		dpk.String(),
	}
	qs := NewQuorumSlice(members, 3)
	vs := NewTestValueStore(0)
	amy := NewBlock(apk, qs, 1, vs)
	bob := NewBlock(bpk, qs, 1, vs)
	cal := NewBlock(cpk, qs, 1, vs)
	dan := NewBlock(dpk, qs, 1, vs)

	// Let everyone receive an initial nomination from Amy
	amy.nState.NominateNewValue(SlotValue("hello its amy"))
	a := amy.OutgoingMessages()[0]

	bob.Handle(apk.String(), a)
	if len(bob.nState.N) != 1 {
		t.Fatal("len(bob.nState.N) != 1")
	}
	cal.Handle(apk.String(), a)
	dan.Handle(apk.String(), a)

	// At this point everyone should have a nomination
	if !amy.nState.HasNomination() {
		t.Fatal("!amy.nState.HasNomination()")
	}
	if !bob.nState.HasNomination() {
		t.Fatal("!bob.nState.HasNomination()")
	}
	if !cal.nState.HasNomination() {
		t.Fatal("!cal.nState.HasNomination()")
	}
	if !dan.nState.HasNomination() {
		t.Fatal("!dan.nState.HasNomination()")
	}

	// Once bob and cal broadcast, everyone should have one accepted value,
	// but still no candidates. This works even without dan, who has nothing
	// accepted.
	b := bob.OutgoingMessages()[0]
	amy.Handle(bpk.String(), b)
	if len(amy.nState.N) != 1 {
		t.Fatalf("amy.nState.N = %#v", amy.nState.N)
	}
	cal.Handle(bpk.String(), b)
	c := cal.OutgoingMessages()[0]
	amy.Handle(cpk.String(), c)
	bob.Handle(cpk.String(), c)
	if len(amy.nState.Y) != 1 {
		t.Fatal("len(amy.nState.Y) != 1")
	}
	if len(bob.nState.Y) != 1 {
		t.Fatal("len(bob.nState.Y) != 1")
	}
	if len(cal.nState.Y) != 1 {
		t.Fatal("len(cal.nState.Y) != 1")
	}
	if len(dan.nState.Y) != 0 {
		t.Fatal("len(dan.nState.Y) != 0")
	}
}

func exchangeMessages(blocks []*Block, beEvil bool) {
	firstEvil := false

	for _, block := range blocks {
		messages := block.OutgoingMessages()

		for _, block2 := range blocks {
			if block == block2 {
				continue
			}

			for _, message := range messages {
				if beEvil && !firstEvil {
					switch m := message.(type) {
					case *PrepareMessage:
						m.Hn = math.MaxInt32
						firstEvil = true
					}
				}

				block2.Handle(block.publicKey.String(), message)
			}
		}
	}
}

func TestProtectionAgainstBigRangeDDoS(t *testing.T) {
	apk := util.NewKeyPairFromSecretPhrase("amy").PublicKey()
	bpk := util.NewKeyPairFromSecretPhrase("bob").PublicKey()
	cpk := util.NewKeyPairFromSecretPhrase("cal").PublicKey()
	dpk := util.NewKeyPairFromSecretPhrase("dan").PublicKey()
	members := []string{
		apk.String(),
		bpk.String(),
		cpk.String(),
		dpk.String(),
	}

	qs := NewQuorumSlice(members, 3)
	vs := NewTestValueStore(0)

	blocks := []*Block{
		NewBlock(apk, qs, 1, vs),
		NewBlock(bpk, qs, 1, vs),
		NewBlock(cpk, qs, 1, vs),
		NewBlock(dpk, qs, 1, vs),
	}

	exchangeMessages(blocks, false)
	exchangeMessages(blocks, false)
	exchangeMessages(blocks, true)
	exchangeMessages(blocks, false)

	if !allDone(blocks) {
		t.Fatalf("Didn't converge")
	}
}

// Simulate the pending messages being sent from source to target
func blockSend(source *Block, target *Block) {
	if source == target {
		return
	}
	messages := source.OutgoingMessages()
	for _, message := range messages {
		m := util.EncodeThenDecodeMessage(message)
		target.Handle(source.publicKey.String(), m)
	}
}

// Makes a cluster that requires a consensus of more than two thirds.
func blockCluster(size int) []*Block {
	qs, names := MakeTestQuorumSlice(size)
	blocks := []*Block{}
	for i, name := range names {
		vs := NewTestValueStore(i)
		blocks = append(blocks, NewBlock(name, qs, 1, vs))
	}
	return blocks
}

func allDone(blocks []*Block) bool {
	for _, block := range blocks {
		if !block.Done() {
			return false
		}
	}
	return true
}

// assertDone verifies that every block has gotten to externalize
func assertDone(blocks []*Block, t *testing.T) {
	for _, block := range blocks {
		if !block.Done() {
			t.Fatalf("%s is not externalizing: %s",
				block.publicKey, spew.Sdump(block))
		}
	}
}

func nominationConverged(blocks []*Block) bool {
	var value SlotValue
	for i, block := range blocks {
		if !block.nState.HasNomination() {
			return false
		}
		if i == 0 {
			value = block.nState.PredictValue()
		} else {
			v := block.nState.PredictValue()
			if value != v {
				return false
			}
		}
	}
	return true
}

func blockFuzzTest(blocks []*Block, seed int64, t *testing.T) {
	rand.Seed(seed ^ 1234569)
	util.Logger.Printf("fuzz testing blocks with seed %d", seed)
	for i := 0; i < 10000; i++ {
		j := rand.Intn(len(blocks))
		k := rand.Intn(len(blocks))
		blockSend(blocks[j], blocks[k])

		if allDone(blocks) {
			return
		}
		if i%1000 == 0 {
			util.Logger.Printf("done round: %d", i)
		}
	}

	if !nominationConverged(blocks) {
		util.Logger.Printf("nomination did not converge")
		for i := 0; i < len(blocks); i++ {
			util.Logger.Printf("--------------------------------------------------------------------------")
			if blocks[i].nState != nil {
				blocks[i].nState.Show()
			}
		}

		util.Logger.Printf("**************************************************************************")

		t.Fatalf("fuzz testing with seed %d, nomination did not converge", seed)
	}

	util.Logger.Printf("balloting did not converge")
	for i := 0; i < len(blocks); i++ {
		util.Logger.Printf("--------------------------------------------------------------------------")
		if blocks[i].bState != nil {
			blocks[i].bState.Show()
		}
	}

	util.Logger.Printf("**************************************************************************")
	t.Fatalf("fuzz testing with seed %d, ballots did not converge", seed)
}

// Should work to 100k
func TestBlockFullCluster(t *testing.T) {
	var i int64
	for i = 0; i < util.GetTestLoopLength(100, 100000); i++ {
		c := blockCluster(4)
		blockFuzzTest(c, i, t)
	}
}

// Should work to 100k
func TestBlockOneNodeKnockedOut(t *testing.T) {
	var i int64
	for i = 0; i < util.GetTestLoopLength(100, 100000); i++ {
		c := blockCluster(4)
		knockout := c[0:3]
		blockFuzzTest(knockout, i, t)
	}
}
