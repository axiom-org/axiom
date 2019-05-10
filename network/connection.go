package network

import (
	"time"

	"github.com/lacker/coinkit/data"
	"github.com/lacker/coinkit/util"
)

type Connection interface {
	Close()
	IsClosed() bool
	Send(message *util.SignedMessage) bool
	Receive() chan *util.SignedMessage
}

// SendAnonymousMessage uses a new random key to send a single message.
func SendAnonymousMessage(c Connection, message *data.QueryMessage) {
	kp := util.NewKeyPair()
	sm := util.NewSignedMessage(message, kp)
	c.Send(sm)
}

// WaitToClear waits for the operation with this account + sequence number to clear.
func WaitToClear(c Connection, user string, sequence uint32) *data.Account {
	for {
		start := time.Now()
		SendAnonymousMessage(c, &data.QueryMessage{Account: user})
		m := (<-c.Receive()).Message()
		elapsed := time.Now().Sub(start).Seconds()
		if elapsed > 1.0 {
			util.Logger.Printf("warning: server took %.2fs to get account info", elapsed)
		}
		dataMessage, ok := m.(*data.DataMessage)
		if ok {
			account := dataMessage.Accounts[user]
			if account != nil && account.Sequence >= sequence {
				return account
			}
		}

		time.Sleep(time.Millisecond * 100)
	}
}

func GetAccount(c Connection, user string) *data.Account {
	SendAnonymousMessage(c, &data.QueryMessage{Account: user})
	m := (<-c.Receive()).Message()
	dataMessage, ok := m.(*data.DataMessage)
	if !ok {
		util.Logger.Fatalf("expected a data message but got: %+v", m)
	}
	return dataMessage.Accounts[user]
}

func FindDocuments(c Connection, matching map[string]interface{}) []*data.Document {
	SendAnonymousMessage(c, &data.QueryMessage{
		Documents: &data.DocumentQuery{
			Data: data.NewJSONObject(matching),
		},
	})
	m := (<-c.Receive()).Message()
	dm, ok := m.(*data.DataMessage)
	if !ok {
		util.Logger.Fatalf("expected a data message but got: %+v", m)
	}
	return dm.Documents
}

func recHelper(inbox chan *util.SignedMessage, quit chan bool) chan *util.SignedMessage {
	answer := make(chan *util.SignedMessage)
	go func() {
		select {
		case m := <-inbox:
			answer <- m
		case <-quit:
			answer <- nil
		}
	}()
	return answer
}
