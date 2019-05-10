package consensus

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/lacker/coinkit/util"
)

type QuorumSlice struct {
	// Members is a list of public keys for nodes that occur in the quorum slice.
	// Members must be unique.
	// Typically includes ourselves.
	Members []string `json:"members"`

	// The number of members we require for consensus, including ourselves.
	// The protocol can support other sorts of slices, like weighted or any wacky
	// thing, but for now we only do this simple "any k out of these n" voting.
	Threshold int `json:"threshold"`
}

func NewQuorumSlice(members []string, threshold int) *QuorumSlice {
	return &QuorumSlice{
		Members:   members,
		Threshold: threshold,
	}
}

func (qs *QuorumSlice) atLeast(nodes []string, t int) bool {
	count := 0
	for _, member := range qs.Members {
		for _, node := range nodes {
			if node == member {
				count++
				if count >= t {
					return true
				}
				break
			}
		}
	}
	return false
}

func (qs *QuorumSlice) BlockedBy(nodes []string) bool {
	return qs.atLeast(nodes, len(qs.Members)-qs.Threshold+1)
}

func (qs *QuorumSlice) SatisfiedWith(nodes []string) bool {
	return qs.atLeast(nodes, qs.Threshold)
}

// Makes data for a test quorum slice that requires a consensus of more
// than two thirds of the given size.
// Also returns a list of public keys of the quorum members.
func MakeTestQuorumSlice(size int) (*QuorumSlice, []util.PublicKey) {
	threshold := 2*size/3 + 1
	pks := []util.PublicKey{}
	names := []string{}
	for i := 0; i < size; i++ {
		pk := util.NewKeyPairFromSecretPhrase(fmt.Sprintf("node%d", i)).PublicKey()
		pks = append(pks, pk)
		names = append(names, pk.String())
	}
	qs := NewQuorumSlice(names, threshold)
	return qs, pks
}

type QuorumFinder interface {
	QuorumSlice(node string) (*QuorumSlice, bool)
	PublicKey() util.PublicKey
}

// Returns whether this set of nodes meets the quorum for the network overall.
func MeetsQuorum(f QuorumFinder, nodes []string) bool {
	// Filter out the nodes in the potential quorum that do not have their
	// own quorum slices met
	hasUs := false
	filtered := []string{}
	for _, node := range nodes {
		qs, ok := f.QuorumSlice(node)
		util.Infof("node %s has qs %+v", node, qs)
		if ok && qs.SatisfiedWith(nodes) {
			filtered = append(filtered, node)
			if node == f.PublicKey().String() {
				hasUs = true
			}
		}
	}
	if !hasUs {
		return false
	}
	if len(filtered) == len(nodes) {
		return true
	}
	return MeetsQuorum(f, filtered)
}

func (qs *QuorumSlice) Value() (driver.Value, error) {
	bytes := util.CanonicalJSONEncode(qs)
	return driver.Value(bytes), nil
}

func (qs *QuorumSlice) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		return errors.New("expected []byte")
	}
	return json.Unmarshal(bytes, qs)
}
