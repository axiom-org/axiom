package network

import (
	"net"
	"sync"
	"time"

	"github.com/lacker/coinkit/util"
)

func isPowerOf10(n int) bool {
	if n < 1 {
		return false
	}
	if n == 1 {
		return true
	}
	if n%10 != 0 {
		return false
	}
	return isPowerOf10(n / 10)
}

// A RedialConnection is a Connection that will automatically redial when there
// is any connection failure that would normally close the
// connection. You can close it yourself, though, and it will stay
// closed.
// Some messages might get dropped during a reconnect.
type RedialConnection struct {
	conn             *BasicConnection
	address          *Address
	inbox            chan *util.SignedMessage
	outbox           chan *util.SignedMessage
	quit             chan bool
	closed           bool
	quitOnce         sync.Once
	consecutiveDrops int
}

func NewRedialConnection(address *Address,
	inbox chan *util.SignedMessage) *RedialConnection {
	if address == nil {
		panic("address is nil")
	}
	if inbox == nil {
		inbox = make(chan *util.SignedMessage, 100)
	}
	c := &RedialConnection{
		address: address,
		outbox:  make(chan *util.SignedMessage, 100),
		inbox:   inbox,
		quit:    make(chan bool),
		closed:  false,
	}
	go c.runOutgoing()
	return c
}

func (c *RedialConnection) Close() {
	c.quitOnce.Do(func() {
		c.closed = true
		if c.conn != nil {
			c.conn.Close()
		}
		close(c.quit)
	})
}

func (c *RedialConnection) IsClosed() bool {
	return c.closed
}

func (c *RedialConnection) IsConnected() bool {
	return c.conn != nil && !c.conn.IsClosed()
}

// connect() is not threadsafe and should only be called from the
// runOutgoing thread
func (c *RedialConnection) connect() {
	if c.closed {
		// We don't really want to connect
		return
	}
	if c.conn != nil && !c.conn.IsClosed() {
		// We already have a connection
		return
	}
	failCount := 0
	for {
		conn, err := net.Dial("tcp", c.address.String())
		if err == nil {
			c.conn = NewBasicConnection(conn, c.inbox)
			return
		}

		failCount++
		timer := time.NewTimer(time.Duration(failCount) * time.Second)
		select {
		case <-c.quit:
			return
		case <-timer.C:
			// Looping again will try to reconnect
		}
	}
}

func (c *RedialConnection) runOutgoing() {
	for {
		c.connect()
		var message *util.SignedMessage
		select {
		case <-c.quit:
			// Needed to avoid a race condition where we are
			// simultaneously closing and opening a new one, and the
			// new one doesn't get closed
			if c.conn != nil {
				c.conn.Close()
			}
			return
		case message = <-c.outbox:
		}

		c.connect()
		if c.closed {
			return
		}
		c.conn.Send(message)
	}
}

// Send sends a message if the queue is not full
func (c *RedialConnection) Send(message *util.SignedMessage) bool {
	select {
	case c.outbox <- message:
		c.consecutiveDrops = 0
		return true
	default:
		c.consecutiveDrops += 1
		if isPowerOf10(c.consecutiveDrops) {
			util.Logger.Printf(
				"RedialConnection outbox to %s overloaded. %d %s dropped",
				c.address,
				c.consecutiveDrops,
				util.Pluralize("message", c.consecutiveDrops))

		}
		return false
	}
}

// Receive returns the next message that is received.
// It returns nil if the connection gets closed before a message is read.
func (c *RedialConnection) Receive() chan *util.SignedMessage {
	return recHelper(c.inbox, c.quit)
}
