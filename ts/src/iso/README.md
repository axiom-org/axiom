# Message formats for the peer-to-peer network

There is probably a better place to document this, but here is better than nothing.

Messages are passed as a SignedMessage. So every message has a `signer` field, which
indicates the public key of the sender of the message.

Messages are listed by their type.

## Ping

Used to request a `Pong` message in response. No fields besides the type.

## Pong

Used to respond to a `Ping` message. No fields besides the type.

## FindNode

Used to search for a particular public key on the network.

`publicKey` contains the public key that the caller is searching for.

`requestID` contains a number that is used to match request and response.

## Neighbors

Used to respond to a FindNode request.

`neighbors` contains a list of public keys. They are determined according to the
Kademlia algorithm.

`responseID` contains the request id of request that caused this response.
