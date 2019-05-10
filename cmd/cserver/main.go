package main

import (
	"flag"
	"io/ioutil"
	"log"
	"os"

	"github.com/axiom-org/axiom/data"
	"github.com/axiom-org/axiom/network"
	"github.com/axiom-org/axiom/util"
)

// cserver runs a blockchain server.

func main() {
	var databaseFilename string
	var keyPairFilename string
	var networkFilename string
	var httpPort int
	var logToStdOut bool

	flag.StringVar(&databaseFilename,
		"database", "", "optional. the file to load database config from")
	flag.StringVar(&keyPairFilename,
		"keypair", "", "the file to load keypair config from")
	flag.StringVar(&networkFilename,
		"network", "", "the file to load network config from")
	flag.IntVar(&httpPort, "http", 0, "the port to serve /healthz etc on")
	flag.BoolVar(&logToStdOut, "logtostdout", false, "whether to log to stdout")

	flag.Parse()

	if keyPairFilename == "" {
		util.Logger.Fatal("the --keypair flag must be set")
	}

	if networkFilename == "" {
		util.Logger.Fatal("the --network flag must be set")
	}

	if logToStdOut {
		util.Logger = log.New(os.Stdout, "", log.LstdFlags)
	}

	var db *data.Database
	dbConfig := data.NewProdConfig()
	if dbConfig == nil && databaseFilename != "" {
		bytes, err := ioutil.ReadFile(databaseFilename)
		if err != nil {
			panic(err)
		}
		dbConfig = data.NewConfigFromSerialized(bytes)
	}
	if dbConfig != nil {
		db = data.NewDatabase(dbConfig)
	}

	kp, err := util.ReadKeyPairFromFile(keyPairFilename)
	if err != nil {
		util.Logger.Fatal(err)
	}

	bytes, err := ioutil.ReadFile(networkFilename)
	if err != nil {
		panic(err)
	}
	net := network.NewConfigFromSerialized(bytes)

	s := network.NewServer(kp, net, db)
	if s == nil {
		util.Fatalf("failed to start the server")
	}

	if httpPort != 0 {
		s.ServeHttpInBackground(httpPort)
		util.Printf("serving http interface on port %d", httpPort)
	}
	s.ServeForever()
}
