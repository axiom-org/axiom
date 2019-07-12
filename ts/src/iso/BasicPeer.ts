// BasicPeer is a small wrapper around the SimplePeer provided by the
// simple-peer npm module that makes it easier to use, mock, and typecheck.

import SimplePeer = require("simple-peer");

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

export default class BasicPeer {
  _peer: SimplePeer;

  constructor(initiator: boolean) {
    this._peer = new SimplePeer({
      initiator: initiator,
      wrtc: OPTIONAL.wrtc
    });
  }

  onSignal(callback: (any) => void) {
    this._peer.on("signal", callback);
  }

  onError(callback: (Error) => void) {
    this._peer.on("error", callback);
  }

  onClose(callback: () => void) {
    this._peer.on("close", callback);
  }

  signal(sig: any) {
    this._peer.signal(sig);
  }

  onConnect(callback: () => void) {
    this._peer.on("connect", callback);
  }

  onData(callback: (data: any) => void) {
    this._peer.on("data", callback);
  }

  // We want this to be a no-op if the underlying webrtc channel is invalid.
  // It isn't well-documented how to check if a simple-peer is valid.
  // See https://github.com/feross/simple-peer/issues/480 for example.
  // So we check some weird internal variables of this._peer._peer
  send(data: any) {
    if (!this._peer._channel) {
      return;
    }

    if (this._peer._channel.readyState !== "open") {
      return;
    }

    this._peer.send(data);
  }

  destroy() {
    this._peer.destroy();
  }

  isConnected() {
    return this._peer.connected;
  }
}
