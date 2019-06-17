import Peer from "./Peer";

// A Node represents a member of the Axiom peer-to-peer network.
export default class Node {
  verbose: boolean;
  peers: Peer[];

  constructor(verbose: boolean) {
    this.verbose = verbose;
    this.peers = [];
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }
}
