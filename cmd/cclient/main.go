package main

import (
	"bufio"
	"os"
	"strconv"

	"github.com/davecgh/go-spew/spew"

	"fmt"
	"github.com/axiom-org/axiom/data"
	"github.com/axiom-org/axiom/network"
	"github.com/axiom-org/axiom/util"
	"net/http"
	"strings"
)

func newConnection() network.Connection {
	config := network.NewLocalNetworkConfig()
	address := config.RandomAddress()
	c := network.NewRedialConnection(address, nil)
	util.Logger.Printf("connecting to %s", address.String())
	return c
}

// Fetches, displays, and returns the status for a user.
func status(user string) *data.Account {
	conn := newConnection()
	account := network.GetAccount(conn, user)

	util.Logger.Printf("account data for %s:\n%s", user, spew.Sdump(account))
	return account
}

// Asks for a login then displays the status
func ourStatus() {
	kp := login()
	status(kp.PublicKey().String())
}

func generate() {
	kp := login()
	os.Stdout.Write(kp.Serialize())
	util.Logger.Printf("key pair generation complete")
}

func validate(filename string) {
	kp, err := util.ReadKeyPairFromFile(filename)
	if err != nil {
		util.Logger.Fatal(err)
	}
	util.Logger.Printf("key pair for %s is valid", kp.PublicKey().String())
}

// Ask the user for a passphrase to log in.
func login() *util.KeyPair {
	util.Logger.Printf("please enter your passphrase:")
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Scan()
	phrase := scanner.Text()
	kp := util.NewKeyPairFromSecretPhrase(phrase)
	util.Logger.Printf("hello. your name is %s", kp.PublicKey().String())
	return kp
}

func send(recipient string, amountStr string) {
	amountInt, err := strconv.Atoi(amountStr)
	if err != nil {
		util.Logger.Fatalf("could not convert %s to a number", amountStr)
	}
	if _, err := util.ReadPublicKey(recipient); err != nil {
		util.Logger.Fatalf("invalid address: %s", recipient)
	}
	amount := uint64(amountInt)
	kp := login()
	user := kp.PublicKey().String()
	conn := newConnection()
	account := network.GetAccount(conn, user)

	util.Logger.Printf("account data for %s:\n%s", user, spew.Sdump(account))

	if account.Balance < amount {
		util.Logger.Fatalf("cannot send %d when our account only has %d",
			amount, account.Balance)
	}

	seq := account.Sequence + 1
	op := &data.SendOperation{
		Signer:   user,
		Sequence: seq,
		To:       recipient,
		Amount:   amount,
		Fee:      0,
	}

	// Send our operation to the network
	sop := data.NewSignedOperation(op, kp)
	om := data.NewOperationMessage(sop)
	sm := util.NewSignedMessage(om, kp)
	conn.Send(sm)
	util.Logger.Printf("sending %d to %s", amount, recipient)

	// Wait for our send operation to clear
	network.WaitToClear(conn, user, seq)
	util.Logger.Printf("op %d cleared", op.GetSequence())
}

func handler(w http.ResponseWriter, r *http.Request) {
	pass := strings.TrimLeft(r.URL.Path, "/")
	kp := util.NewKeyPairFromSecretPhrase(pass)
	s := status(kp.PublicKey().String())
	if s != nil {
		fmt.Fprintf(w, "{ \"sequence\": %d, \"balance\": %d }",
			s.Sequence, s.Balance)
	} else {
		fmt.Fprintf(w, "{}")
	}
}

func main() {
	if len(os.Args) < 2 {
		util.Logger.Fatal("Usage: cclient {generate,proxy,send,status} ...")
	}
	op := os.Args[1]
	rest := os.Args[2:]
	switch op {

	case "status":
		if len(rest) > 1 {
			util.Logger.Fatal("Usage: cclient status [publickey]")
		}
		if len(rest) == 0 {
			ourStatus()
		} else {
			status(rest[0])
		}

	case "send":
		if len(rest) != 2 {
			util.Logger.Fatal("Usage: cclient send <user> <amount>")
		}
		send(rest[0], rest[1])

	case "generate":
		if len(rest) != 0 {
			util.Logger.Fatal("Usage: cclient generate")
		}
		generate()

	case "validate":
		if len(rest) != 1 {
			util.Logger.Fatal("Usage: cclient validate <path/to/keypair.json>")
		}
		validate(rest[0])

	default:
		util.Logger.Fatalf("unrecognized operation: %s", op)
	}
}
