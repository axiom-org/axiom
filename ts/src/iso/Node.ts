import Peer from "./Peer";
import SignedMessage from "./SignedMessage";

// A Node represents a member of the Axiom peer-to-peer network.
export default class Node {
  verbose: boolean;

  // Every connection in peers should already be connected.
  // When a peer disconnects, it is destroyed.
  // A node should only store one Peer per public key.
  // If we do not know the public key of a Peer yet, it is not stored in peers.
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

  // Destroys the peer if it is redundant
  // Returns whether the peer was indexed
  indexPeer(peer: Peer): boolean {
    if (this.peers[peer.peerPublicKey]) {
      // We already have a peer connection open to this node
      peer.destroy();
      return false;
    }

    this.peers[peer.peerPublicKey] = peer;
    return true;
  }

  handleSignedMessage(peer: Peer, sm: SignedMessage) {
    if (peer.peerPublicKey && this.peers[peer.peerPublicKey] !== peer) {
      // We received a message from a peer that we previously removed
      return;
    }

    if (!peer.peerPublicKey) {
      // We have just learned the identity of this peer
      peer.peerPublicKey = sm.signer;
      this.indexPeer(peer);
    }

    if (message.type === "Ping") {
      peer.sendMessage(new Message("Pong"));
    } else if (message.type === "Pong") {
      // Ignore
    } else {
      this.log("unexpected message type:", message.type);
    }
  }

  // Ownership of the peer passes to this Node.
  addPeer(peer: Peer) {
    if (!peer.isConnected()) {
      throw new Error("only connected peers can be added to a Node");
    }

    if (peer.peerPublicKey) {
      if (!this.indexPeer) {
        return;
      }
    }

    peer.onClose(() => {
      if (this.peers[peer.peerPublicKey] === peer) {
        delete this.peers[peer.peerPublicKey];
      }
    });

    peer.onSignedMessage(sm => {
      this.handleSignedMessage(peer, sm);
    });
  }
}
