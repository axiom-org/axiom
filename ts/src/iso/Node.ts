import { isEmpty } from "./Util";
import KeyPair from "./KeyPair";
import MemberSet from "./MemberSet";
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

  // The Peers that are being connected via server but aren't connected yet.
  // The key is WebSocket url, the value is the Peer.
  // Once the peer connects, the value is replaced with a null.
  // This way the keys with null values are things we can retry.
  pendingByURL: { [url: string]: Peer };

  // The Peers that we are interested in connecting to, via other
  // nodes.
  // Each peer in this map should have peer.intermediary set.
  pendingByPublicKey: { [publicKey: string]: Peer };

  // Callbacks that will run on the next message received
  nextMessageCallbacks: ((SignedMessage) => void)[];

  // Callbacks that will run on every message received
  everyMessageCallbacks: ((SignedMessage) => void)[];

  // Whether this Node has been destroyed
  destroyed: boolean;

  // Maps each channel to a MemberSet describing the members of that channel
  // Storage is according to Kademlia
  channelMembers: { [channel: string]: MemberSet };

  // The channels we have joined, along with their last time of announcement
  joined: { [channel: string]: Date };

  keyPair: KeyPair;

  // An interval timer that gets called repeatedly while this node is alive
  ticker: any;

  constructor(keyPair: KeyPair, urls: string[], verbose: boolean) {
    this.keyPair = keyPair;
    if (!this.keyPair) {
      this.keyPair = KeyPair.fromRandom();
    }

    this.pendingByURL = {};
    for (let url of urls) {
      this.pendingByURL[url] = null;
    }

    this.pendingByPublicKey = {};

    this.destroyed = false;
    this.verbose = verbose;
    this.peers = {};
    this.nextMessageCallbacks = [];
    this.everyMessageCallbacks = [];
    this.channelMembers = {};
    this.joined = {};

    this.ticker = setInterval(() => {
      this.handleTick();
    }, 2000);

    this.bootstrap();

    this.log(`creating node`);
  }

  log(...args) {
    if (this.verbose) {
      console.log(`${this.keyPair.getPublicKey().slice(0, 6)}:`, ...args);
    }
  }

  // Returns one line of printable status
  statusLine() {
    let keys = this.peerKeys();
    let line = `connected to ${keys.length} peer${
      keys.length === 1 ? "" : "s"
    }`;
    if (keys.length > 0) {
      line += ": " + keys.map(x => x.slice(0, 6)).join(", ");
    }
    return line;
  }

  // Returns many lines of printable status
  statusLines(): string[] {
    let lines = [
      `public key: ${this.keyPair.getPublicKey()}`,
      this.statusLine()
    ];
    for (let peer of this.getPeers()) {
      lines.push(`Peer ${peer.humanID()}:`);
      lines = lines.concat(peer.statusLines());
    }
    for (let peer of this.getPendingPeers()) {
      lines.push(`Pending Peer ${peer.humanID()}:`);
      lines = lines.concat(peer.statusLines());
    }
    return lines;
  }

  show() {
    for (let line of this.statusLines()) {
      console.log(line);
    }
  }

  handleTick() {
    let subticks = 0;
    for (let peer of this.getPeers()) {
      peer.handleTick();
      subticks++;
    }
    for (let peer of this.getPendingPeers()) {
      peer.handleTick();
      subticks++;
    }
    for (let channel in this.channelMembers) {
      this.channelMembers[channel].handleTick();
    }
    if (subticks === 0) {
      this.bootstrap();
    }

    // Rejoin every 25 seconds
    let now = new Date();
    let channels = Object.keys(this.joined);
    for (let channel of channels) {
      if (now.getTime() - this.joined[channel].getTime() > 25000) {
        this.join(channel);
      }
    }
  }

  peerKeys(): string[] {
    let answer = [];
    for (let key in this.peers) {
      answer.push(key);
    }
    return answer;
  }

  // Returns the number of peers for which we have identified their public key
  numPeers(): number {
    return this.peerKeys().length;
  }

  // Starts to connect to any peer that we aren't already in the process of
  // connecting to
  bootstrap() {
    if (this.destroyed) {
      return;
    }
    for (let url in this.pendingByURL) {
      this.connectToServer(url);
    }
  }

  onNextMessage(callback: (SignedMessage) => void) {
    this.nextMessageCallbacks.push(callback);
  }

  onEveryMessage(callback: (SignedMessage) => void) {
    this.everyMessageCallbacks.push(callback);
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

  // Returns the channel members we know about locally
  getChannelMembers(channel: string): string[] {
    let mset = this.channelMembers[channel];
    if (!mset) {
      return [];
    }
    return mset.getMembers();
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
    this.log(`connected to ${peer.peerPublicKey.slice(0, 6)}`);
    return true;
  }

  // Starts connecting to a new peer whose public key we know, via an intermediary that
  // we're already connected to.
  // Does nothing if we already connected or started connecting.
  connectToPeer(
    publicKey: string,
    intermediary: Peer,
    initiator: boolean,
    nonce: string
  ) {
    if (this.peers[publicKey] || this.pendingByPublicKey[publicKey]) {
      // A connection is already in progress
      return;
    }

    if (!KeyPair.isValidPublicKey(publicKey)) {
      return;
    }

    this.log(
      initiator ? "connecting to" : "accepting connection from",
      publicKey.slice(0, 6),
      "via",
      intermediary.peerPublicKey.slice(0, 6)
    );

    let peer = new Peer({
      keyPair: this.keyPair,
      peerPublicKey: publicKey,
      initiator: initiator,
      verbose: this.verbose,
      intermediary: intermediary.peerPublicKey,
      nonce: nonce
    });
    this.pendingByPublicKey[publicKey] = peer;

    peer.onConnect(() => {
      this.addPeer(peer);
    });
    peer.onClose(() => {
      this.handlePeerClose(peer);
    });

    let initiate = initiator;
    peer.signals.forEach(signal => {
      let message = new Message("Signal", {
        signal: signal,
        destination: peer.peerPublicKey,
        nonce: peer.nonce,
        initiate: initiate
      });
      initiate = false;
      intermediary.sendMessage(message);
    });
  }

  // Returns immediately rather than waiting for the connection
  connectToServer(url: string) {
    if (this.destroyed) {
      return;
    }
    if (!(url in this.pendingByURL)) {
      throw new Error("cannot connect to new url: " + url);
    }
    if (this.pendingByURL[url]) {
      // A connection to this url is already in progress
      return;
    }
    let peer = Peer.connectToServer(this.keyPair, url, this.verbose);
    this.pendingByURL[url] = peer;

    peer.onConnect(() => {
      this.addPeer(peer);
    });
    peer.onClose(() => {
      this.handlePeerClose(peer);
    });
  }

  handlePing(peer: Peer, sm: SignedMessage) {
    peer.sendMessage(new Message("Pong"));
  }

  handlePong(peer: Peer, sm: SignedMessage) {}

  handleFindNode(peer: Peer, sm: SignedMessage) {
    if (sm.message.channel) {
      let members = this.channelMembers[sm.message.channel];
      if (members) {
        let response = new Message("Neighbors", {
          channel: sm.message.channel,
          neighbors: members.getMembers()
        });
        peer.sendMessage(response);
        return;
      }
    }

    // Find all the neighbors besides the one talking to us
    // TODO: use Kademlia heuristics on sm.message.publicKey
    let neighbors = [];
    for (let pk in this.peers) {
      if (pk !== peer.peerPublicKey) {
        neighbors.push(pk);
      }
    }
    let response = new Message("Neighbors", {
      neighbors: neighbors
    });
    peer.sendMessage(response);
  }

  handleNeighbors(peer: Peer, sm: SignedMessage) {
    // TODO: don't necessarily connect to all neighbors, use
    // Kademlia heuristics
    for (let publicKey of sm.message.neighbors) {
      this.connectToPeer(publicKey, peer, true, "nonce" + Math.random());
    }
  }

  handleSignal(peer: Peer, sm: SignedMessage) {
    // Signals should be forwarded to their destination
    let destination = this.peers[sm.message.destination];
    if (!destination) {
      return;
    }
    let forward = new Message("Forward", {
      message: sm.serialize()
    });
    destination.sendMessage(forward);
  }

  handleForward(intermediary: Peer, sm: SignedMessage) {
    let nested;
    try {
      nested = SignedMessage.fromSerialized(sm.message.message);
    } catch (e) {
      this.log("bad forward:", e);
      return;
    }
    if (nested.message.type !== "Signal") {
      return;
    }
    if (nested.message.destination !== this.keyPair.getPublicKey()) {
      return;
    }
    if (this.peers[nested.signer]) {
      return;
    }
    let peer = this.pendingByPublicKey[nested.signer];
    if (!peer) {
      if (!nested.message.initiate) {
        // We don't have a pending connection so we can't use this signal
        return;
      }

      // A new peer is attempting to connect to us. Let's connect
      this.connectToPeer(
        nested.signer,
        intermediary,
        false,
        nested.message.nonce
      );
      peer = this.pendingByPublicKey[nested.signer];
    }

    if (!peer) {
      // New connection failed for some reason
      return;
    }

    if (nested.message.nonce !== peer.nonce) {
      // This must be a message intended for a different connection
      return;
    }

    // Pass this signal to the peer
    peer.signal(nested.message.signal);
  }

  handleJoin(sm: SignedMessage) {
    let channel = sm.message.channel;
    if (!this.channelMembers[channel]) {
      this.channelMembers[channel] = new MemberSet();
    }
    this.channelMembers[channel].handleJoin(sm);
  }

  join(channel: string) {
    this.joined[channel] = new Date();
    let message = new Message("Join", { channel: channel });
    let signed = SignedMessage.fromSigning(message, this.keyPair);
    this.handleJoin(signed);
    let peers = this.getPeers();
    for (let peer of peers) {
      peer.sendMessage(message);
    }
  }

  handleSignedMessage(peer: Peer, sm: SignedMessage) {
    if (peer.peerPublicKey && this.peers[peer.peerPublicKey] !== peer) {
      // We received a message from a peer that we previously removed
      return;
    }

    if (!peer.peerPublicKey) {
      // We have just learned the identity of this peer
      if (sm.signer === this.keyPair.getPublicKey()) {
        // Oops, we connected to ourselves.
        delete this.pendingByURL[peer.url];
        peer.destroy();
        return;
      }
      peer.peerPublicKey = sm.signer;
      this.indexPeer(peer);
    }

    switch (sm.message.type) {
      case "Ping":
        this.handlePing(peer, sm);
        break;
      case "Pong":
        this.handlePong(peer, sm);
        break;
      case "FindNode":
        this.handleFindNode(peer, sm);
        break;
      case "Neighbors":
        this.handleNeighbors(peer, sm);
        break;
      case "Signal":
        this.handleSignal(peer, sm);
        break;
      case "Forward":
        this.handleForward(peer, sm);
        break;
      case "Join":
        this.handleJoin(sm);
        break;
      default:
        this.log("unexpected message type:", sm.message.type);
    }

    let nextCallbacks = this.nextMessageCallbacks;
    this.nextMessageCallbacks = [];
    let everyCallbacks = [...this.everyMessageCallbacks];
    for (let callback of nextCallbacks) {
      callback(sm);
    }
    for (let callback of everyCallbacks) {
      callback(sm);
    }
  }

  // Should be called whenever a peer closes.
  // Could be an already-connected Peer, or one that is still pending.
  handlePeerClose(peer: Peer) {
    if (this.destroyed) {
      return;
    }

    if (this.peers[peer.peerPublicKey] === peer) {
      delete this.peers[peer.peerPublicKey];
      this.log(`disconnected from ${peer.peerPublicKey.slice(0, 6)}`);
    }

    if (this.pendingByPublicKey[peer.peerPublicKey] === peer) {
      delete this.pendingByPublicKey[peer.peerPublicKey];
      this.log(`failed to connect to ${peer.peerPublicKey.slice(0, 6)}`);
    }

    if (this.pendingByURL[peer.url] === peer) {
      this.pendingByURL[peer.url] = null;
      this.log(`failed to connect to ${peer.url}`);
    }
  }

  // Ownership of the peer passes to this Node.
  addPeer(peer: Peer) {
    if (this.destroyed) {
      peer.destroy();
      return;
    }

    if (!peer.isConnected()) {
      // A race condition where this peer connected and then
      // disconnected before we could handle the connection.
      peer.destroy();
      return;
    }

    if (peer.url) {
      if (this.pendingByURL[peer.url] !== peer) {
        // A race condition where this peer connected, but the node
        // already abandoned it and started trying a new one.
        peer.destroy();
        return;
      }
      this.pendingByURL[peer.url] = null;
    }

    if (peer.peerPublicKey) {
      if (this.pendingByPublicKey[peer.peerPublicKey]) {
        delete this.pendingByPublicKey[peer.peerPublicKey];
      }

      if (peer.peerPublicKey == this.keyPair.getPublicKey()) {
        // This is a self-connection
        peer.destroy();
        return;
      }

      if (!this.indexPeer(peer)) {
        return;
      }
    }

    peer.onClose(() => this.handlePeerClose(peer));

    peer.onSignedMessage(sm => {
      this.handleSignedMessage(peer, sm);
    });

    // If we haven't figured out the public key of this peer, this findNode call will
    // find it as a side effect
    peer.findNode(this.keyPair.getPublicKey());
  }

  getPeers(): Peer[] {
    let answer = [];
    for (let key in this.peers) {
      answer.push(this.peers[key]);
    }
    return answer;
  }

  getPendingPeers(): Peer[] {
    let answer = [];
    for (let url in this.pendingByURL) {
      let peer = this.pendingByURL[url];
      if (peer) {
        answer.push(peer);
      }
    }
    for (let pk in this.pendingByPublicKey) {
      answer.push(this.pendingByPublicKey[pk]);
    }
    return answer;
  }

  destroy() {
    clearInterval(this.ticker);
    this.destroyed = true;
    for (let peer of this.getPeers()) {
      peer.destroy();
    }
  }
}
