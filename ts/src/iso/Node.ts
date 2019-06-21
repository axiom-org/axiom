import { isEmpty } from "./Util";
import KeyPair from "./KeyPair";
import Message from "./Message";
import Peer from "./Peer";
import SignedMessage from "./SignedMessage";

// A Node represents a member of the Axiom peer-to-peer network.
// See the README in this directory for a description of message formats.
export default class Node {
  verbose: boolean;

  // Every connection in peers should already be connected.
  // When a peer disconnects, it is destroyed.
  // A node should only store one Peer per public key.
  // If we do not know the public key of a Peer yet, it is not stored in peers.
  peers: { [publicKey: string]: Peer };

  // The Peers that are being connected but aren't connected yet.
  // The key is WebSocket url, the value is the Peer.
  // Once the peer connects, the value is replaced with a null.
  // This way the keys with null values are things we can retry.
  pending: { [url: string]: Peer };

  // Callbacks that will run on the next message received
  nextMessageCallbacks: ((SignedMessage) => void)[];

  // Whether this Node has been destroyed
  destroyed: boolean;

  keyPair: KeyPair;

  // A Node doesn't start connecting to the network until you call bootstrap()
  constructor(keyPair: KeyPair, urls: string[], verbose: boolean) {
    this.keyPair = keyPair;
    if (!this.keyPair) {
      this.keyPair = KeyPair.fromRandom();
    }

    this.pending = {};
    for (let url of urls) {
      this.pending[url] = null;
    }

    this.destroyed = false;
    this.verbose = verbose;
    this.peers = {};
    this.nextMessageCallbacks = [];
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  // Returns the number of peers for which we have identified their public key
  numPeers(): number {
    let answer = 0;
    for (let key in this.peers) {
      answer++;
    }
    return answer;
  }

  // Starts to connect to any peer that we aren't already in the process of
  // connecting to
  bootstrap() {
    for (let url in this.pending) {
      this.connectToServer(url);
    }
  }

  onNextMessage(callback: (SignedMessage) => void) {
    this.nextMessageCallbacks.push(callback);
  }

  // Returns the next time we receive a SignedMessage
  async waitForMessage(): Promise<SignedMessage> {
    return new Promise((resolve, reject) => {
      this.onNextMessage(resolve);
    });
  }

  // Calls f both right now and after every received message.
  // Once it is true, this function completes.
  async waitUntil(f: () => boolean) {
    while (!f()) {
      await this.waitForMessage();
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

  // Returns immediately rather than waiting for the connection
  connectToServer(url: string) {
    if (this.destroyed) {
      return;
    }
    if (!(url in this.pending)) {
      throw new Error("cannot connect to new url: " + url);
    }
    if (this.pending[url]) {
      // A connection to this url is already in progress
      return;
    }
    let peer = Peer.connectToServer(this.keyPair, url, this.verbose);
    peer.onConnect(() => {
      this.addPeer(peer);
    });
    this.pending[url] = peer;
  }

  handleSignedMessage(peer: Peer, sm: SignedMessage) {
    if (peer.peerPublicKey && this.peers[peer.peerPublicKey] !== peer) {
      // We received a message from a peer that we previously removed
      return;
    }

    if (!peer.peerPublicKey) {
      // We have just learned the identity of this peer
      if (sm.signer === this.keyPair.getPublicKey()) {
        // Oops, we connected to ourselves. Hang up
        peer.destroy();
        return;
      }
      peer.peerPublicKey = sm.signer;
      this.indexPeer(peer);
    }

    let message = sm.message;
    if (message.type === "Ping") {
      peer.sendMessage(new Message("Pong"));
    } else if (message.type === "Pong") {
      // Ignore
    } else {
      this.log("unexpected message type:", message.type);
    }

    let callbacks = this.nextMessageCallbacks;
    this.nextMessageCallbacks = [];
    for (let callback of callbacks) {
      callback(sm);
    }
  }

  // Ownership of the peer passes to this Node.
  addPeer(peer: Peer) {
    if (this.destroyed) {
      return;
    }
    if (!peer.isConnected()) {
      throw new Error("only connected peers can be added to a Node");
    }

    if (peer.url) {
      if (this.pending[peer.url] !== peer) {
        throw new Error("bad pending");
      }
      this.pending[peer.url] = null;
    }

    if (peer.peerPublicKey) {
      if (peer.peerPublicKey == this.keyPair.getPublicKey()) {
        return;
      }
      if (!this.indexPeer(peer)) {
        return;
      }
    } else {
      peer.ping();
    }

    peer.onClose(() => {
      if (this.peers[peer.peerPublicKey] === peer) {
        delete this.peers[peer.peerPublicKey];
      }

      if (isEmpty(this.peers) && !this.destroyed) {
        this.log("lost connection to every node. rebootstrapping...");
        this.bootstrap();
      }
    });

    peer.onSignedMessage(sm => {
      this.handleSignedMessage(peer, sm);
    });
  }

  getPeers(): Peer[] {
    let answer = [];
    for (let key in this.peers) {
      answer.push(this.peers[key]);
    }
    return answer;
  }

  destroy() {
    this.destroyed = true;
    for (let peer of this.getPeers()) {
      peer.destroy();
    }
  }
}
