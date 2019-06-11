import SimplePeer from "simple-peer";

// Optional dependencies.
// TODO: solve this at compile-time rather than at runtime
let OPTIONAL = {
  http: null,
  wrtc: null
};
declare var window: any;
declare var global: any;
declare var require: any;
if (typeof global === "object" && typeof window === "undefined") {
  // Looks like a node environment
  OPTIONAL.wrtc = require("wrtc");
  OPTIONAL.http = require("http");
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
    if (OPTIONAL.wrtc) {
      options.wrtc = OPTIONAL.wrtc;
    }

    this.peer = new SimplePeer(options);
    this.peer.on("signal", data => {
      console.log(`init = ${initiator}, got signal data: ${data}`);
    });
    return this.peer;
  }

  async connect(url: string) {
    this.makePeer(true);
    // TODO
  }

  async listen(port: number) {
    if (!OPTIONAL.http) {
      throw new Error(
        "cannot listen on a port because this environment has no http server"
      );
    }
    console.log("listening on port", port);
    this.makePeer(false);
    OPTIONAL.http
      .createServer((req, res) => {
        throw new Error("TODO: implement");
      })
      .listen(port);
  }
}
