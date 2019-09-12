# Message formats for the peer-to-peer network

There is probably a better place to document this, but here is better than nothing.

Messages are passed as a SignedMessage. So every message has a `signer` field, which
indicates the public key of the sender of the message.

Messages are listed by their type.

## Ping

Used to request a `Pong` message in response.

`nonce` is the authNonce

## Pong

Used to respond to a `Ping` message.

`nonce` is the nonce that was in the ping.

## FindNode

Used to search for a node matching some condition. Must contain one of the following:

`publicKey` contains the public key that the caller is searching for.

`channel` contains the string channel that we seek members of.

`nonce` is the authNonce

## Neighbors

Used to respond to a FindNode request.

`neighbors` contains a list of public keys. They are determined according to the
Kademlia algorithm.

`channel` contains the channel these nodes belong to, if that was a condition of the find.

`nonce` is the nonce that was in the FindNode request

## Signal

Used to exchange information to create a new peer connection.

`signal` contains the opaque object produced by the simple peer

`destination` is the public key of the peer we are trying to connect to.

`initiate` is true iff this signal is the first one of the connection.

`nonce` is a random string that is kept the same for every connection attempt.

## Forward

Used to forward other messages. Could be Signal, Publish, Create, Update, Delete.

`message` is the encoded signed message we are forwarding

`messages` is a list of multiple messages, when we're forwarding a batch.

## Join

Used to join a channel.

`channel` is a string that is the name of the channel.

## Publish

Used to publish a message to a pub/sub channel.

`channel` is the channel it is published to.

`data` is any JSON-encodable data, as defined by the application

`nonce` is a random string

## Create
## Update
## Delete

Used to create, update, or delete an object in a database channel. They share a lot
of their format:

`channel` is the channel it is published to.

`database` is which database it applies to.

`timestamp` is a toISOString() formatted timestamp of the operation. Timestamps only
have meaning per-user; the latest operation for a particular id is the one that counts.

`id` is a string identifier for the object. The id only has to be unique per-user;
different users can use the same id.

`data` is the new data for the object. (Not present for Delete.)
You can't have fields in "data" named "metadata" or "timestamp".

## Query

Used to query for objects in a database channel.

`channel` is the channel it is published to.

`database` is which database it applies to.

We'll have to extend this later.
