import SimplePeer from "simple-peer";

// TODO: solve this at compile-time rather than at runtime
let DEPS = { wrtc: null };
declare var window: any;
declare var global: any;
declare var require: any;
if (typeof global === "object" && typeof window === "undefined") {
  // Looks like a node environment
  DEPS.wrtc = require("wrtc");
}

// The Node connects to the Axiom peer-to-peer network.
export default class Node {
  verbose: boolean;
  peer: SimplePeer;

  constructor(verbose: boolean) {
    this.verbose = verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  makePeer(initiator: boolean): SimplePeer {
    if (this.peer) {
      throw new Error("cannot makePeer twice");
    }

    let options = { initiator: initiator, wrtc: undefined };
    if (DEPS.wrtc) {
      options.wrtc = DEPS.wrtc;
    }

    this.peer = new SimplePeer(options);
    return this.peer;
  }

  async connect(url: string) {
    // TODO
  }

  async serve(port: number) {
    console.log("serving on port", port);
    // TODO
  }
}
