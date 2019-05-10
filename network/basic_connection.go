package network

import (
	"bufio"
	"net"
	"sync"
	"time"

	"github.com/lacker/coinkit/util"
)

// How frequently in seconds to send keepalive pings
const keepalive = 10

// A BasicConnection represents a two-way message channel.
// You can close it at any point, and it will close itself if it detects
// network problems.
type BasicConnection struct {
	conn     net.Conn
	handler  func(*util.SignedMessage)
	outbox   chan *util.SignedMessage
	inbox    chan *util.SignedMessage
	quit     chan bool
	closed   bool
	quitOnce sync.Once
	start    time.Time
	stop     time.Time
}

// NewBasicConnection creates a new logical connection given a network connection.
// inbox is the channel to send messages to.
func NewBasicConnection(conn net.Conn, inbox chan *util.SignedMessage) *BasicConnection {
	c := &BasicConnection{
		conn:   conn,
		outbox: make(chan *util.SignedMessage, 100),
		inbox:  inbox,
		quit:   make(chan bool),
		closed: false,
		start:  time.Now(),
	}
	go c.runIncoming()
	go c.runOutgoing()
	return c
}

func (c *BasicConnection) Close() {
	c.quitOnce.Do(func() {
		c.closed = true
		c.stop = time.Now()
		close(c.quit)
	})
}

func (c *BasicConnection) IsClosed() bool {
	return c.closed
}

func (c *BasicConnection) runIncoming() {
	reader := bufio.NewReader(c.conn)
	for {
		// Wait for 2x the keepalive period
		c.conn.SetReadDeadline(time.Now().Add(2 * keepalive * time.Second))
		response, err := util.ReadSignedMessage(reader)
		if c.closed {
			break
		}
		if err != nil {
			util.Logger.Printf("could not ReadSignedMessage: %+v", err)
			c.Close()
			break
		}
		if response == nil {
			panic("connections should not receive nil")
		}
		if !response.IsKeepAlive() {
			c.inbox <- response
		}
	}
}

func (c *BasicConnection) runOutgoing() {
	for {
		var message *util.SignedMessage
		timer := time.NewTimer(time.Duration(keepalive * time.Second))
		select {
		case <-c.quit:
			return
		case <-timer.C:
			// Send a keepalive ping
			message = util.KeepAlive()
		case message = <-c.outbox:
			if message == nil {
				panic("should not send nil messages")
			}
		}

		message.Write(c.conn)
	}
}

// Send sends a message, but only if the queue is not full.
// It returns whether the message entered the outbox.
func (c *BasicConnection) Send(message *util.SignedMessage) bool {
	if c == nil {
		panic("cannot send to a nil BasicConnection")
	}
	if message == nil {
		panic("should not send nil messages")
	}
	select {
	case c.outbox <- message:
		return true
	default:
		util.Logger.Printf("Connection outbox overloaded, dropping message")
		return false
	}
}

// Receive returns the next message that is received.
// It returns nil iff the connection gets closed before a message is read.
func (c *BasicConnection) Receive() chan *util.SignedMessage {
	return recHelper(c.inbox, c.quit)
}
