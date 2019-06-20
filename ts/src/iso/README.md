# Message formats for the peer-to-peer network

There is probably a better place to document this, but here is better than nothing.

Messages are passed as a SignedMessage. So every message has a `signer` field, which
indicates the public key of the sender of the message.

Messages are listed by their type.

## Ping

Used to request a `Pong` message in response. No fields besides the type.

## Pong

Used to respond to a `Ping` message. No fields besides the type.
