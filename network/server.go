package network

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/davecgh/go-spew/spew"

	"github.com/axiom-org/axiom/data"
	"github.com/axiom-org/axiom/util"
)

var DatabasesInUse *util.SafeSet = util.NewSafeSet()

type Server struct {
	port    int
	keyPair *util.KeyPair
	peers   []*RedialConnection

	// The node is capable of handling some sorts of incoming messages
	// serially.
	// Generally this is the messages that are trying to do a write to
	// the blockchain.
	node *Node

	// The database is capable of handling some sorts of incoming
	// messages in parallel.
	// Generally this is the messages that are trying to read some
	// data from this server without modifying it.
	db *data.Database

	// Whenever there is a new batch of outgoing messages, it is sent to the
	// outgoing channel
	outgoing chan []*util.SignedMessage

	// inbox contains messages that are going to be handled serially
	// by the node, and do not require a response.
	inbox chan *util.SignedMessage

	// The last message we received
	lastReceived *util.SignedMessage

	// The last message we broadcasted
	lastBroadcasted *util.SignedMessage

	// requests contains messages that are going to be handled
	// serially by the node, and *do* require a response.
	requests chan *Request

	listener net.Listener

	// We close the currentBlock channel whenever the current block is complete
	currentBlock chan bool

	// We set shutdown to true and close the quit channel
	// when the server is shutting down
	shutdown bool
	quit     chan bool

	// A counter of how many messages we have broadcasted
	broadcasted int

	start time.Time

	// How often we send out a rebroadcast, resending our redundant data
	RebroadcastInterval time.Duration
}

func NewServer(keyPair *util.KeyPair, config *Config, db *data.Database) *Server {
	if db != nil {
		// Make sure this process isn't running multiple servers per database
		key := db.Config().String()
		if DatabasesInUse.Contains(key) {
			util.Logger.Fatalf("multiple servers running for database: %s", key)
		}
		DatabasesInUse.Add(key)
	}

	peers := []*RedialConnection{}
	inbox := make(chan *util.SignedMessage)
	for _, address := range config.PeerAddresses(keyPair) {
		peers = append(peers, NewRedialConnection(address, inbox))
	}
	qs := config.QuorumSlice()
	node := NewNode(keyPair.PublicKey(), qs, db)

	if node == nil {
		return nil
	}

	return &Server{
		port:                config.GetPort(keyPair.PublicKey().String(), 9000),
		keyPair:             keyPair,
		peers:               peers,
		node:                node,
		outgoing:            make(chan []*util.SignedMessage, 10),
		inbox:               inbox,
		requests:            make(chan *Request),
		listener:            nil,
		shutdown:            false,
		quit:                make(chan bool),
		currentBlock:        make(chan bool),
		broadcasted:         0,
		db:                  db,
		RebroadcastInterval: time.Second,
	}
}

func (s *Server) Logf(format string, a ...interface{}) {
	util.Logf("SE", s.keyPair.PublicKey().ShortName(), format, a...)
}

// Only use for testing
func (s *Server) setBalance(user string, amount uint64) {
	s.node.queue.SetBalance(user, amount)
}

// Panics if anything is left in progress on the server. Only use for testing
func (s *Server) assertDone() {
	s.db.AssertDone()
}

func (s *Server) numPeersConnected() int {
	answer := 0
	for _, peer := range s.peers {
		if peer.IsConnected() {
			answer += 1
		}
	}
	return answer
}

// Handles an incoming connection.
// This is likely to include many messages, all separated by endlines.
func (s *Server) handleConnection(connection net.Conn) {
	defer connection.Close()
	conn := NewBasicConnection(connection, make(chan *util.SignedMessage))

	for {
		var sm *util.SignedMessage
		select {
		case <-s.quit:
			conn.Close()
			return
		case sm = <-conn.Receive():
		}

		if sm == nil {
			return
		}

		s.lastReceived = sm

		m, ok := s.handleMessage(sm)
		if !ok {
			return
		}
		if m != nil {
			conn.Send(m)
		}
	}
}

// handleMessage may be called from multiple threads and is used to
// respond to a message from a sender who wants a response.
// Generally this is a client sender who is not necessarily part of
// the consensus logic.
// handleMessage is safe to be called from multiple threads. It routes
// messages that must be handled by the node through the request queue.
// When handling is complete, it returns (response, true).
// If handling cannot be completed, like if the server shuts down, it
// returns (nil, false).
func (s *Server) handleMessage(sm *util.SignedMessage) (*util.SignedMessage, bool) {
	// QueryMessages can be handled by the database
	im, ok := sm.Message().(*data.QueryMessage)
	if ok {
		if s.db == nil {
			util.Logger.Fatal("you must attach a database to handle QueryMessages")
		}
		dm, err := s.db.HandleQueryMessage(im)
		if err != nil {
			return s.errorf("error handling query message: %s", err), true
		}
		if dm == nil {
			return s.errorf("unknown error handling query message: %+v", im), true
		}
		return util.NewSignedMessage(dm, s.keyPair), true
	}

	response := make(chan *util.SignedMessage)
	request := &Request{
		Message:  sm,
		Response: response,
	}

	// Send our request to the processing goroutine, wait for the response,
	// and return it down the connection
	s.requests <- request
	timer := time.NewTimer(time.Second)
	select {
	case m := <-response:
		return m, true
	case <-s.quit:
		return nil, false
	case <-timer.C:
		util.Logger.Fatalf("the processing goroutine got overloaded")
		return nil, false
	}
}

// retryHandleMessage is like handleMessage, but it expects a non-nil response.
// If the response is nil, it waits for another block to be finalized and tries again
// when it is.
// TODO: this is unused, but I theorize we will want something like this for efficiently
// awaiting the next block, so let's remove or alter this when we want that.
func (s *Server) retryHandleMessage(sm *util.SignedMessage) (*util.SignedMessage, bool) {
	for {
		m, ok := s.handleMessage(sm)
		if !ok {
			return nil, false
		}
		if m != nil {
			return m, true
		}
		select {
		case <-s.currentBlock:
			// There's another block, so let the loop retry
		case <-s.quit:
			return nil, false
		}
	}
}

// Flushes the outgoing queue and returns the last value if there is any.
// Returns [], false if there is none
// Does not wait
func (s *Server) getOutgoing() ([]*util.SignedMessage, bool) {
	messages := []*util.SignedMessage{}
	ok := false
	for {
		select {
		case messages = <-s.outgoing:
			ok = true
		default:
			return messages, ok
		}
	}
}

// unsafeUpdateOutgoing gets the outgoing messages from our node and uses
// the outgoing channel to broadcast them.
// Since it deals with the node directly, it should only be called from the
// message-processing thread.
func (s *Server) unsafeUpdateOutgoing() {
	// Sign our messages
	out := []*util.SignedMessage{}
	for _, m := range s.node.OutgoingMessages() {
		out = append(out, util.NewSignedMessage(m, s.keyPair))
	}

	// Clear the outgoing queue
	s.getOutgoing()

	// Send our messages to the now-probably-empty queue
	s.outgoing <- out
}

// unsafeProcessMessage handles a message by interacting with the node directly.
// It should be only be called from the message-processing thread.
func (s *Server) unsafeProcessMessage(m *util.SignedMessage) *util.SignedMessage {
	prevSlot := s.node.Slot()
	message, hasResponse := s.node.Handle(m.Signer(), m.Message())
	postSlot := s.node.Slot()
	s.unsafeUpdateOutgoing()

	if postSlot != prevSlot {
		close(s.currentBlock)
		s.currentBlock = make(chan bool)
	}

	// Return the appropriate message
	if !hasResponse {
		return nil
	}
	sm := util.NewSignedMessage(message, s.keyPair)
	return sm
}

// processMessagesForever should be run in its own goroutine. This is the only
// thread that is allowed to access the node, because node is not threadsafe.
// The 'unsafe' methods should only be called from within here.
func (s *Server) processMessagesForever() {
	// TODO: run long tests to make sure this is ok
	s.unsafeUpdateOutgoing()

	for {

		select {

		case request := <-s.requests:
			if s.shutdown {
				return
			}
			if request.Message != nil {
				response := s.unsafeProcessMessage(request.Message)
				if request.Response != nil {
					request.Response <- response
				}
			} else {
				s.Logf("nil message in request queue")
			}

		case message := <-s.inbox:
			if s.shutdown {
				return
			}
			if message != nil {
				s.unsafeProcessMessage(message)
			} else {
				s.Logf("nil message in inbox queue")
			}

		case <-s.quit:
			return
		}
	}
}

func (s *Server) listen() {
	s.Logf("listening on port %d", s.port)
	for {
		conn, err := s.listener.Accept()
		if s.shutdown {
			break
		}
		if err != nil {
			util.Logger.Print("incoming connection error: ", err)
			continue
		}
		go s.handleConnection(conn)
	}
}

// Must be called before listen()
// Will retry up to 5 seconds
func (s *Server) acquirePort() {
	s.Logf("acquiring port %d...", s.port)
	for i := 0; i < 100; i++ {
		ln, err := net.Listen("tcp", fmt.Sprintf("0.0.0.0:%d", s.port))
		if err == nil {
			s.listener = ln
			s.start = time.Now()
			s.Logf("port %d acquired", s.port)
			return
		}
		time.Sleep(time.Millisecond * time.Duration(50))
	}
	util.Logger.Fatalf("could not acquire port %d", s.port)
}

func (s *Server) broadcast(messages []*util.SignedMessage) {
	for _, message := range messages {
		for _, peer := range s.peers {
			peer.Send(message)
		}
		s.lastBroadcasted = message
		s.broadcasted += 1
	}
}

// Return a list of everything in a that is not in b.
func subtract(a []*util.SignedMessage, b []*util.SignedMessage) []*util.SignedMessage {
	sigs := make(map[string]bool)
	for _, m := range b {
		sigs[m.Signature()] = true
	}
	answer := []*util.SignedMessage{}
	for _, m := range a {
		if !sigs[m.Signature()] {
			answer = append(answer, m)
		}
	}
	return answer
}

// broadcastIntermittently() sends outgoing messages every so often. It
// should be run as a goroutine. This handles both redundancy rebroadcasts and
// the regular broadcasts of new messages.
func (s *Server) broadcastIntermittently() {
	lastMessages := []*util.SignedMessage{}

	for {
		timer := time.NewTimer(s.RebroadcastInterval)
		select {

		case <-s.quit:
			return

		case messages := <-s.outgoing:
			if s.shutdown {
				return
			}

			// See if there are even newer messages
			newerMessages, ok := s.getOutgoing()
			if ok {
				messages = newerMessages
			}

			// When we receive a new outgoing, we only need to send out the
			// messages that have changed since last time.
			changedMessages := subtract(messages, lastMessages)
			lastMessages = messages
			s.broadcast(changedMessages)

		case <-timer.C:
			if s.shutdown {
				return
			}

			// It's time for a rebroadcast. Send out duplicate messages.
			// This is a backstop against miscellaneous problems. If the
			// network is functioning perfectly, this isn't necessary.
			// s.Logf("performing a backup rebroadcast")
			s.broadcast(lastMessages)
		}
	}
}

func (s *Server) LocalhostAddress() *Address {
	return &Address{
		Host: "127.0.0.1",
		Port: s.port,
	}
}

// ServeForever spawns off all the goroutines and never returns.
// Stop() might not work when you run the server this way, because stopping
// during startup does not work well
func (s *Server) ServeForever() {
	s.acquirePort()

	go s.processMessagesForever()
	go s.listen()
	s.broadcastIntermittently()
}

// ServeInBackground spawns goroutines to run the server.
// It returns once it has successfully bound to its port.
// Stop() should work if it is called after ServeInBackground returns.
func (s *Server) ServeInBackground() {
	s.acquirePort()
	go s.processMessagesForever()
	go s.listen()
	go s.broadcastIntermittently()
}

// ServeHttpInBackground spawns a goroutine to serve http.
func (s *Server) ServeHttpInBackground(port int) {
	// /healthz just returns OK as long as the server is healthy
	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "OK\n")
	})

	http.HandleFunc("/uptimez", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "%.2f\n", s.Uptime())
	})

	// /statusz returns more detailed information about this server
	http.HandleFunc("/statusz", func(w http.ResponseWriter, r *http.Request) {
		util.Logger.Print("got /statusz request")
		fmt.Fprintf(w, "%.1fs uptime\n", s.Uptime())
		fmt.Fprintf(w, "%d messages broadcasted\n", s.broadcasted)
		fmt.Fprintf(w, "%d peers connected\n", s.numPeersConnected())
		fmt.Fprintf(w, "current slot: %d\n", s.node.Slot())
		fmt.Fprintf(w, "DB_USER: %s\n", os.Getenv("DB_USER"))
		fmt.Fprintf(w, "public key: %s\n", s.keyPair.PublicKey())
		if s.db != nil {
			last := s.db.LastBlock()
			if last == nil {
				fmt.Fprintf(w, "last block: nil\n")
			} else {
				fmt.Fprintf(w, "last block: %s\n", last.String())
			}
			fmt.Fprintf(w, "total database size: %s\n", s.db.TotalSizeInfo())
		}
		if s.lastReceived == nil {
			fmt.Fprintf(w, "\nno messages received\n")
		} else {
			fmt.Fprintf(w, "\nlast received message, from %s:\n%s",
				s.lastReceived.Signer(), spew.Sdump(s.lastReceived.Message()))
		}
		if s.lastBroadcasted == nil {
			fmt.Fprintf(w, "\nno messages broadcasted\n")
		} else {
			fmt.Fprintf(w, "\nlast broadcasted message:\n%s", spew.Sdump(s.lastBroadcasted.Message()))
		}
	})

	// /messages/ accepts signed messages over http, with or without trailing slash
	// It returns a signed message if there is one, or an ok if there is none.
	messageHandler := func(w http.ResponseWriter, r *http.Request) {
		output := s.handleMessageRequest(r)
		if output == nil {
			output = util.KeepAlive()
		}
		w.Header().Set("Access-Control-Allow-Origin", "*")
		output.Write(w)
	}
	http.HandleFunc("/messages/", messageHandler)
	http.HandleFunc("/messages", messageHandler)

	srv := &http.Server{
		Addr: fmt.Sprintf(":%d", port),
	}
	go srv.ListenAndServe()
	go func() {
		<-s.quit
		srv.Shutdown(context.Background())
	}()
}

// Handles an http request containing a message, from a client.
// Returns the message that should be returned.
func (s *Server) handleMessageRequest(r *http.Request) *util.SignedMessage {
	reader := bufio.NewReader(r.Body)
	input, err := util.ReadSignedMessage(reader)
	if err != nil {
		return s.errorf("error in reading signed message: %s", err)
	}

	// util.Logger.Printf("handling /messages/ input: %v", input)
	output, ok := s.handleMessage(input)
	if !ok {
		return s.errorf("the server is overloaded or is shutting down")
	}

	// util.Logger.Printf("got response message: %v", output)
	return output
}

// Creates a signed error message
func (s *Server) errorf(format string, a ...interface{}) *util.SignedMessage {
	msg := &util.ErrorMessage{
		Error: fmt.Sprintf(format, a...),
	}
	return util.NewSignedMessage(msg, s.keyPair)
}

// Uptime returns uptime in seconds
func (s *Server) Uptime() float64 {
	return time.Now().Sub(s.start).Seconds()
}

func (s *Server) Stats() {
	s.Logf("server stats:")
	s.Logf("%.1fs uptime", s.Uptime())
	s.Logf("%d messages broadcasted", s.broadcasted)
	s.node.Stats()
}

func (s *Server) Port() int {
	return s.port
}

func (s *Server) Stop() {
	s.shutdown = true
	close(s.quit)

	if s.listener != nil {
		s.Logf("releasing port %d", s.port)
		s.listener.Close()
	}

	for _, peer := range s.peers {
		peer.Close()
	}

	if s.db != nil {
		DatabasesInUse.Remove(s.db.Config().String())
	}
}
