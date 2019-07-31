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

Used to search for a node matching some condition. Must contain one of the following:

`publicKey` contains the public key that the caller is searching for.

`channel` contains the string channel that we seek members of.

## Neighbors

Used to respond to a FindNode request.

`neighbors` contains a list of public keys. They are determined according to the
Kademlia algorithm.

`channel` contains the channel these nodes belong to, if that was a condition of the find.

## Signal

Used to exchange information to create a new peer connection.

`signal` contains the opaque object produced by the simple peer

`destination` is the public key of the peer we are trying to connect to.

`initiate` is true iff this signal is the first one of the connection.

`nonce` is a random string that is kept the same for every connection attempt.

## Forward

Used to forward Signal messages to the intended recipient.

`message` is the encoded signed message we are forwarding

## Join

Used to join a channel.

`channel` is a string that is the name of the channel.

## Publish

Used to publish a message to a pub/sub channel.
