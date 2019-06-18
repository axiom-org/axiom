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
}
