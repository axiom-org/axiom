import * as SimplePeer from "simple-peer";
import WebSocket = require("isomorphic-ws");

import Sequence from "./Sequence";

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

  // The signals emitted by this peer
  signals: Sequence<object>;

  _peer: SimplePeer;

  // Creates a Peer by connecting to a PeerServer
  static connectToServer(url: string, verbose: boolean): Peer {
    let peer = new Peer({ initiator: true, verbose: verbose });
    let ws = new WebSocket(url);

    ws.onopen = () => {
      peer.signals.forEach(signal => {
        console.log("XXX client sending signal:", signal);
        ws.send(JSON.stringify(signal));
      });
    };

    ws.onclose = () => {
      console.log("XXX client onclose");
    };

    let incomingSignals = new Sequence<object>();
    ws.onmessage = data => {
      console.log("XXX client got signal:", data);
      try {
        incomingSignals.push(JSON.parse(data));
      } catch (e) {
        console.log("XXX data parsing error:", e);
      }
    };
    peer.connect(incomingSignals);

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

    this.signals = new Sequence<object>();
    this._peer.on("signal", obj => {
      this.signals.push(obj);
    });
  }

  connect(signals: Sequence<object>) {
    signals.forEach(obj => {
      this._peer.signal(obj);
    });
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
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

  send(data: any) {
    this._peer.send(data);
  }

  destroy() {
    this._peer.destroy();
    this.signals.finish();
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
