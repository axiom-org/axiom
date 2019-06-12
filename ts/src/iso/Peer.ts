import * as SimplePeer from "simple-peer";
import WebSocket = require("isomorphic-ws");

// Optional dependencies.
// TODO: solve this at compile-time rather than at runtime
let OPTIONAL = {
  wrtc: null
};
declare var global: any;
declare var require: any;
if (typeof global === "object") {
  // Looks like a node environment.
  // TODO: could it be the jest pretending-to-be-a-browser-but-really-node environment?
  // That will be required to make any jest-browser tests use this file.
  OPTIONAL.wrtc = require("wrtc");
}

// A Peer represents a connection to a single other node in the Axiom peer-to-peer
// network.
export default class Peer {
  verbose: boolean;
  _peer: SimplePeer;

  // Connects to a PeerServer
  static connect(url: string, verbose: boolean): Peer {
    let peer = new Peer({ initiator: true, verbose: verbose });
    let ws = new WebSocket(url);

    // Whether the websocket is opened
    let opened = false;

    // Most recent encoded signal data
    let encoded = null;

    ws.onopen = () => {
      opened = true;
      if (encoded) {
        console.log("XXX client sending signal:", encoded);
        ws.send(encoded);
      }
    };

    ws.onclose = () => {
      console.log("XXX onclose");
    };

    ws.onmessage = data => {
      console.log("XXX client got signal:", data);
      peer.signal(data);
    };

    peer.onSignal(signal => {
      encoded = JSON.stringify(signal);
      if (opened) {
        console.log("XXX client sending signal:", encoded);
        ws.send(encoded);
      }
    });

    peer.onConnect(() => {
      console.log("XXX client sees connection");
      ws.close();
    });

    peer.onError(err => {
      console.log("XXX client error:", err);
    });

    return peer;
  }

  constructor(options: { initiator?: boolean; verbose?: boolean }) {
    this.verbose = !!options.verbose;
    this._peer = new SimplePeer({
      initiator: !!options.initiator,
      wrtc: OPTIONAL.wrtc
    });
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  onSignal(callback: (data: object) => void) {
    this._peer.on("signal", callback);
  }

  onConnect(callback: () => void) {
    this._peer.on("connect", callback);
  }

  onData(callback: (data: any) => void) {
    this._peer.on("data", callback);
  }

  onError(callback: (Error) => void) {
    this._peer.on("error", callback);
  }

  signal(data: object) {
    this._peer.signal(data);
  }

  send(data: any) {
    this._peer.send(data);
  }

  destroy() {
    this._peer.destroy();
  }

  async waitUntilConnected() {
    if (this._peer.connected) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.onConnect(resolve);
    });
  }
}
