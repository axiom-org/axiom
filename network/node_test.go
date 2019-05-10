package network

import (
	"fmt"
	"log"
	"math/rand"
	"testing"

	"github.com/axiom-org/axiom/consensus"
	"github.com/axiom-org/axiom/data"
	"github.com/axiom-org/axiom/util"
)

func sendNodeToNodeMessages(source *Node, target *Node, t *testing.T) {
	util.Infof("sending %s -> %s", source.publicKey.ShortName(),
		target.publicKey.ShortName())
	messages := source.OutgoingMessages()
	for _, message := range messages {
		m := util.EncodeThenDecodeMessage(message)
		response, ok := target.Handle(source.publicKey.String(), m)
		util.Infof("message: %+v, response: %+v", message, response)
		if ok {
			x, ok := source.Handle(target.publicKey.String(), response)
			if ok {
				util.Logger.Printf("initial message: %+v", message)
				util.Logger.Printf("response message: %+v", response)
				util.Logger.Printf("re-response message: %+v", x)
				t.Fatal("infinite response loop")
			}
		}
	}
}

func maxAccountBalance(nodes []*Node) uint64 {
	answer := uint64(0)
	for _, node := range nodes {
		b := node.queue.MaxBalance()
		if b > answer {
			answer = b
		}
	}
	return answer
}

func newSendMessage(from *util.KeyPair, to *util.KeyPair, seq int, amount int) util.Message {

	tr := &data.SendOperation{
		Signer:   from.PublicKey().String(),
		Sequence: uint32(seq),
		To:       to.PublicKey().String(),
		Amount:   uint64(amount),
		Fee:      0,
	}
	op := data.NewSignedOperation(tr, from)
	return data.NewOperationMessage(op)
}

func sendMessages(nodes []*Node, t *testing.T) {
	for n := 0; n < 10; n++ {
		for i := 0; i < len(nodes); i++ {
			for j := 0; j < len(nodes); j++ {
				if i == j {
					continue
				}
				sendNodeToNodeMessages(nodes[i], nodes[j], t)
			}
		}
	}
}

func TestNodeCatchup(t *testing.T) {
	kp := util.NewKeyPairFromSecretPhrase("client")
	kp2 := util.NewKeyPairFromSecretPhrase("bob")
	qs, names := consensus.MakeTestQuorumSlice(4)
	nodes := []*Node{}
	for _, name := range names {
		node := newTestingNode(name, qs)
		node.queue.SetBalance(kp.PublicKey().String(), 100)
		nodes = append(nodes, node)
	}

	// Run a few rounds without the last node
	for round := 1; round <= 3; round++ {
		m := newSendMessage(kp, kp2, round, 1)
		nodes[0].Handle(kp.PublicKey().String(), m)
		sendMessages(nodes[0:len(nodes)-1], t)
		for i := 0; i <= 2; i++ {
			if nodes[i].Slot() != round+1 {
				t.Fatalf("nodes[%d] did not finish round %d", i, round)
			}
		}
	}

	// The last node should be able to catch up
	sendMessages(nodes, t)
	if nodes[3].Slot() != 4 {
		t.Fatalf("catchup failed")
	}
}

func TestNodeCatchupFromDatabase(t *testing.T) {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	bob := util.NewKeyPairFromSecretPhrase("bob")
	qs, names := consensus.MakeTestQuorumSlice(4)
	nodes := []*Node{}
	for i, name := range names {
		util.Logger.Printf("creating initial node %d", i)
		db := data.NewTestDatabase(i)
		node := NewNode(name, qs, db)
		if node == nil {
			t.Fatal("NewNode failed")
		}
		nodes = append(nodes, node)
	}

	// Run a few rounds without the last node
	for round := 1; round <= 3; round++ {
		m := newSendMessage(mint, bob, round, 10)
		nodes[0].Handle(mint.PublicKey().String(), m)
		sendMessages(nodes[0:len(nodes)-1], t)
		for i := 0; i <= 2; i++ {
			if nodes[i].Slot() != round+1 {
				t.Fatalf("nodes[%d] did not finish round %d", i, round)
			}
		}
	}
	data.CheckAllDatabasesCommitted()

	// Knock out and restart the first three nodes to force a db recovery
	for i := 0; i <= 2; i++ {
		util.Logger.Printf("restarting node %d", i)
		nodes[i] = NewNode(names[i], qs, nodes[i].database)
		if nodes[0] == nil {
			t.Fatalf("NewNode failed")
		}
	}

	// This should be enough to catch up one block
	util.Verbose = true
	sendNodeToNodeMessages(nodes[3], nodes[0], t)
	sendNodeToNodeMessages(nodes[3], nodes[1], t)
	sendNodeToNodeMessages(nodes[3], nodes[2], t)
	util.Verbose = false

	// The last node should be able to catch up
	sendMessages(nodes, t)
	if nodes[3].Slot() != 4 {
		t.Fatalf("catchup failed")
	}
}

func TestNodeRestarting(t *testing.T) {
	mint := util.NewKeyPairFromSecretPhrase("mint")
	bob := util.NewKeyPairFromSecretPhrase("bob")
	qs, names := consensus.MakeTestQuorumSlice(4)
	nodes := []*Node{}
	for i, name := range names {
		db := data.NewTestDatabase(i)
		node := NewNode(name, qs, db)
		nodes = append(nodes, node)
	}

	// Send 10 to Bob
	// Don't use the last node, pretend it is out of the network
	m := newSendMessage(mint, bob, 1, 10)
	nodes[0].Handle(mint.PublicKey().String(), m)
	sendMessages(nodes[0:len(nodes)-1], t)

	if nodes[0].database.Commits() != 2 {
		t.Fatalf("two commits should have happened, one for airdrop, one for the send")
	}

	err := nodes[0].queue.CheckConsistency()
	if err != nil {
		t.Fatal(err)
	}

	// Knock out and replace node 1.
	// So node 3 is totally out, node 1 had to restart from the database.
	log.Printf("replacing node 1 (%s)", util.Shorten(names[1].String()))
	nodes[1] = NewNode(names[1], qs, nodes[1].database)
	if nodes[1].Slot() != nodes[1].queue.Slot() {
		t.Fatalf("the new node has a slot mismatch: node slot %d, queue slot %d",
			nodes[1].Slot(), nodes[1].queue.Slot())
	}

	// Send another 10 to Bob
	m = newSendMessage(mint, bob, 2, 10)
	nodes[0].Handle(mint.PublicKey().String(), m)

	// Even without the last node, the network should continue
	sendMessages(nodes[0:len(nodes)-1], t)

	if nodes[1].queue.MaxBalance() != data.TotalMoney-20 {
		t.Fatalf("looks like node 1 never recovered after its restart")
	}

	// Try messing with node 2's database
	account := nodes[2].database.GetAccount(mint.PublicKey().String())
	account.Balance = 1234
	nodes[2].database.UpsertAccount(account)
	nodes[2].database.Commit()
	node := NewNode(names[2], qs, nodes[2].database)
	if node != nil {
		t.Fatalf("NewNode should fail on a tampered database")
	}
}

func validateOp(nodes []*Node, op *data.SignedOperation, t *testing.T) bool {
	hasTrue := false
	hasFalse := false
	for _, node := range nodes {
		if node.queue.Validate(op) {
			hasTrue = true
		} else {
			hasFalse = true
		}
	}
	if hasTrue && hasFalse {
		t.Fatalf("inconsistent nodes")
	}
	return hasTrue
}

func TestDocumentOperations(t *testing.T) {
	qs, names := consensus.MakeTestQuorumSlice(4)
	nodes := []*Node{}
	for i, name := range names {
		db := data.NewTestDatabase(i)
		node := NewNode(name, qs, db)
		nodes = append(nodes, node)
	}

	// Create a document
	op := data.MakeTestCreateDocumentOperation(1)
	m := data.NewOperationMessage(op)
	nodes[0].Handle(op.GetSigner(), m)

	sendMessages(nodes, t)

	doc := nodes[0].database.GetDocument(1)
	if doc == nil {
		t.Fatalf("the document should have been created")
	}

	if nodes[0].Slot() != 2 {
		t.Fatalf("after one create, slot should be 2 but is %d", nodes[0].Slot())
	}

	op = data.MakeTestUpdateDocumentOperation(1, 2)
	if !nodes[0].queue.Validate(op) {
		t.Fatalf("the update op does not validate")
	}
	m = data.NewOperationMessage(op)
	nodes[0].Handle(op.GetSigner(), m)

	sendMessages(nodes, t)

	doc = nodes[0].database.GetDocument(1)
	foo, ok := doc.Data.GetInt("foo")
	if !ok {
		t.Fatalf("foo was not in doc after update")
	}
	if foo != 2 {
		t.Fatalf("expected foo to be updated to 2")
	}

	if nodes[0].Slot() != 3 {
		t.Fatalf("after create + update, slot should be 3 but is %d", nodes[0].Slot())
	}

	// Make sure the wrong user can't delete our document
	wrong := util.NewKeyPairFromSecretPhrase("wrong")
	dop := &data.DeleteDocumentOperation{
		Signer:   wrong.PublicKey().String(),
		Sequence: 3,
		ID:       1,
		Fee:      0,
	}
	sop := data.NewSignedOperation(dop, wrong)
	if nodes[0].queue.Validate(sop) {
		t.Fatalf("deletes should only be runnable by the owner")
	}

	// Make sure the wrong user can't update our document
	uop := &data.UpdateDocumentOperation{
		Signer:   wrong.PublicKey().String(),
		Sequence: 3,
		ID:       1,
		Fee:      0,
	}
	sop = data.NewSignedOperation(uop, wrong)
	if nodes[0].queue.Validate(sop) {
		t.Fatalf("updates should only be runnable by the owner")
	}

	// Try to update a nonexistent document
	op = data.MakeTestUpdateDocumentOperation(1000, 1)
	if nodes[0].queue.Validate(op) {
		t.Fatalf("updating a nonexistent document should not validate")
	}
	m = data.NewOperationMessage(op)
	nodes[0].Handle(op.GetSigner(), m)

	sendMessages(nodes, t)

	if nodes[0].Slot() != 3 {
		t.Fatalf("the slot should not have advanced with an invalid op")
	}

	// Make sure we can't delete nonexistent documents
	op = data.MakeTestDeleteDocumentOperation(10, 3)
	if nodes[0].queue.Validate(op) {
		t.Fatalf("deleting a nonexistent doc should not validate")
	}

	// Delete our document
	op = data.MakeTestDeleteDocumentOperation(1, 3)
	if !nodes[0].queue.Validate(op) {
		t.Fatalf("the delete op should validate")
	}
	m = data.NewOperationMessage(op)
	nodes[0].Handle(op.GetSigner(), m)

	sendMessages(nodes, t)

	// Check that our document is deleted
	doc = nodes[0].database.GetDocument(1)
	if doc != nil {
		t.Fatalf("the document should have gotten deleted")
	}
}

func nodeFuzzTest(seed int64, t *testing.T) {
	initialMoney := uint64(4)

	numClients := 5
	clients := []*util.KeyPair{}
	for i := 0; i < numClients; i++ {
		kp := util.NewKeyPairFromSecretPhrase(fmt.Sprintf("client%d", i))
		clients = append(clients, kp)
	}

	clientMessages := []*data.OperationMessage{}
	for i, client := range clients {
		neighbor := clients[(i+1)%len(clients)]

		// Each client attempts to send 1 money to their neighbor
		// with a fee of 1, many times.
		// This should always end up with everyone having 1 money.
		// Proof is left as an exercise to the reader :D
		ops := []*data.SignedOperation{}
		for seq := uint32(1); seq < uint32(initialMoney); seq++ {
			tr := &data.SendOperation{
				Signer:   client.PublicKey().String(),
				Sequence: seq,
				To:       neighbor.PublicKey().String(),
				Amount:   1,
				Fee:      1,
			}
			ops = append(ops, data.NewSignedOperation(tr, client))
		}
		m := data.NewOperationMessage(ops...)
		clientMessages = append(clientMessages, m)
	}

	// 4 nodes running on 3-out-of-4
	qs, names := consensus.MakeTestQuorumSlice(4)
	nodes := []*Node{}
	for _, name := range names {
		node := newTestingNode(name, qs)
		for _, client := range clients {
			node.queue.SetBalance(client.PublicKey().String(), initialMoney)
		}
		nodes = append(nodes, node)
	}

	rand.Seed(seed ^ 789789)
	util.Logger.Printf("fuzz testing nodes with seed %d", seed)
	for i := 0; i <= 10000; i++ {
		if rand.Intn(2) == 0 {
			// Pick a random pair of nodes to exchange messages
			source := nodes[rand.Intn(len(nodes))]
			target := nodes[rand.Intn(len(nodes))]
			sendNodeToNodeMessages(source, target, t)
		} else {
			// Send a client-to-node message
			j := rand.Intn(len(clientMessages))
			client := clients[j]
			m := clientMessages[j]
			node := nodes[rand.Intn(len(nodes))]
			node.Handle(client.PublicKey().String(), m)
		}

		// Check if we are done
		if maxAccountBalance(nodes) == 1 {
			break
		}
	}

	if maxAccountBalance(nodes) != 1 {
		for _, node := range nodes {
			node.Log()
		}
		t.Fatalf("failure to converge with seed %d", seed)
	}
}

// Works up to 1k
func TestNodeFullCluster(t *testing.T) {
	var i int64
	for i = 1; i <= util.GetTestLoopLength(2, 1000); i++ {
		nodeFuzzTest(i, t)
	}
}
