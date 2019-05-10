package network

import (
	"time"

	"github.com/lacker/coinkit/util"
)

// The convention for handling a Request is that you send the response
// to the response channel.
// This happens even if it is a nil response.
type Request struct {
	Message *util.SignedMessage

	Response chan *util.SignedMessage

	Timeout time.Duration
}
