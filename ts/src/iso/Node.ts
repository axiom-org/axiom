import Peer from "./Peer";

// A Node represents a member of the Axiom peer-to-peer network.
export default class Node {
  verbose: boolean;

  // When a new peer connects, it is added to peers.
  // When a peer disconnects, it is destroyed.
  // A node should only store one Peer per public key.
  peers: { [publicKey: string]: Peer };

  constructor(verbose: boolean) {
    this.verbose = verbose;
    this.peers = {};
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  handleMessage(publicKey, peer, message) {
    if (this.peers[publicKey] !== peer) {
      // We received a message from a peer that we removed
      return;
    }

    if (message.type === "Ping") {
      peer.sendMessage(new Message("Pong"));
    } else if (message.type === "Pong") {
      // Ignore
    } else {
      this.log("unexpected message type:", message.type);
    }

    throw new Error("XXX");
  }

  // Ownership of the peer passes to this Node.
  addPeer(peer: Peer) {
    let pk = peer.peerPublicKey;
    if (!pk) {
      throw new Error("only peers with a public key can be added to a Node");
    }

    if (!peer.isConnected()) {
      throw new Error("only call addPeer once a peer connects");
    }

    if (this.peers[pk]) {
      // We already have a peer connection open to this node.
      peer.destroy();
      return;
    }

    this.peers[pk] = peer;

    peer.onClose(() => {
      if (this.peers[pk] === peer) {
        delete this.peers[pk];
      }
    });

    peer.onMessage(message => {
      this.handleMessage(pk, peer, message);
    });
  }
}
