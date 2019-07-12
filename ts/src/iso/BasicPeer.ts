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

export default interface BasicPeer {
  onClose(callback: () => void): void;
  onConnect(callback: () => void): void;
  onData(callback: (any) => void): void;
  onError(callback: (Error) => void): void;
  onSignal(callback: (any) => void): void;
  signal(sig: any): void;
  send(data: any): void;
  destroy(): void;
  isConnected(): boolean;
}

export function createBasicPeer(initiator: boolean): BasicPeer {
  return new WebRTCBasicPeer(initiator);
}

class WebRTCBasicPeer implements BasicPeer {
  _peer: SimplePeer;

  constructor(initiator: boolean) {
    this._peer = new SimplePeer({
      initiator: initiator,
      wrtc: OPTIONAL.wrtc
    });
  }

  onClose(callback: () => void) {
    this._peer.on("close", callback);
  }

  onConnect(callback: () => void) {
    this._peer.on("connect", callback);
  }

  onData(callback: (any) => void) {
    this._peer.on("data", callback);
  }

  onError(callback: (Error) => void) {
    this._peer.on("error", callback);
  }

  onSignal(callback: (any) => void) {
    this._peer.on("signal", callback);
  }

  signal(sig: any) {
    this._peer.signal(sig);
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

  isConnected(): boolean {
    return this._peer.connected;
  }
}
