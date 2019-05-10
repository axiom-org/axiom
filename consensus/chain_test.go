package consensus

import (
	"math/rand"
	"testing"

	"github.com/lacker/coinkit/util"
)

// Simulate the sending of messages from source to target
func chainSend(source *Chain, target *Chain) {
	if source == target {
		return
	}
	messages := source.OutgoingMessages()
	for _, message := range messages {
		m := util.EncodeThenDecodeMessage(message)
		response, ok := target.Handle(source.publicKey.String(), m)
		if ok {
			_, ok := source.Handle(target.publicKey.String(), response)
			if ok {
				util.Logger.Fatal("infinite response loop")
			}
		}
	}
}

// Makes a cluster of chains that requires a consensus of more than two thirds.
func chainCluster(size int) []*Chain {
	qs, names := MakeTestQuorumSlice(size)
	chains := []*Chain{}
	for i, name := range names {
		vs := NewTestValueStore(i)
		chains = append(chains, NewEmptyChain(name, qs, vs))
	}
	return chains
}

// checkProgress checks that blocks match up to and including limit.
// it errors if there is any disagreement in externalized values.
func checkProgress(chains []*Chain, limit int, t *testing.T) {
	first := chains[0]
	for i := 1; i < len(chains); i++ {
		chain := chains[i]
		for j := 1; j <= limit; j++ {
			// Check that this chain agrees with the first one for slot j
			blockValue := chain.history[j].X
			firstValue := first.history[j].X
			if blockValue != firstValue {
				util.Logger.Printf("%s externalized %+v for slot %d",
					first.publicKey, firstValue, j)
				util.Logger.Printf("%s externalized %+v for slot %d",
					chain.publicKey, blockValue, j)
				t.Fatal("this cannot be")
			}
		}
	}
}

// progress returns the number of blocks that all of these chains have externalized
func progress(chains []*Chain) int {
	minSlot := chains[0].current.slot
	for i := 1; i < len(chains); i++ {
		if chains[i].current.slot < minSlot {
			minSlot = chains[i].current.slot
		}
	}
	return minSlot - 1
}

func chainFuzzTest(chains []*Chain, seed int64, t *testing.T) {
	limit := 10
	rand.Seed(seed ^ 46372837824)
	util.Logger.Printf("fuzz testing chains with seed %d", seed)
	for i := 1; i <= 10000; i++ {
		j := rand.Intn(len(chains))
		k := rand.Intn(len(chains))
		chainSend(chains[j], chains[k])
		if progress(chains) >= limit {
			break
		}
		if i%1000 == 0 {
			util.Logger.Printf("done round: %d ************************************", i)
		}
	}

	if progress(chains) < limit {
		LogChains(chains)
		t.Fatalf("with seed %d, we only externalized %d blocks",
			seed, progress(chains))
	}

	checkProgress(chains, 10, t)
}

// Should work to 10k
func TestChainFullCluster(t *testing.T) {
	var i int64
	for i = 0; i < util.GetTestLoopLength(10, 10000); i++ {
		c := chainCluster(4)
		chainFuzzTest(c, i, t)
	}
}

// Should work to 10k
func TestChainOneNodeKnockedOut(t *testing.T) {
	var i int64
	for i = 0; i < util.GetTestLoopLength(10, 10000); i++ {
		c := chainCluster(4)
		knockout := c[0:3]
		chainFuzzTest(knockout, i, t)
	}
}
