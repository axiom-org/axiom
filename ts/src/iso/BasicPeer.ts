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

class MockBasicPeer implements BasicPeer {
  partner: MockBasicPeer;
  id: number;
  static allPeers: MockBasicPeer[] = [];
  connected: boolean;
  destroyed: boolean;
  initiator: boolean;
  closeCallback: () => void;
  connectCallback: () => void;
  dataCallback: (any) => void;

  static clear() {
    MockBasicPeer.allPeers = [];
  }

  constructor(initiator: boolean) {
    this.initiator = initiator;
    this.connected = false;
    this.destroyed = false;
    this.id = MockBasicPeer.allPeers.length;
    MockBasicPeer.allPeers.push(this);
  }

  onClose(callback: () => void) {
    if (this.closeCallback) {
      throw new Error("multiple closeCallback");
    }
    this.closeCallback = callback;
  }

  onConnect(callback: () => void) {
    if (this.connectCallback) {
      throw new Error("multiple connectCallback");
    }
    this.connectCallback = callback;
    if (this.connected) {
      callback();
    }
  }

  onData(callback: (any) => void) {
    if (this.dataCallback) {
      throw new Error("multiple dataCallback");
    }
    this.dataCallback = callback;
  }

  onError(callback: (Error) => void) {}

  onSignal(callback: (any) => void) {
    callback(this.id);
  }

  signal(sig: any) {
    if (this.destroyed) {
      return;
    }
    if (this.connected) {
      return;
    }
    let possiblePartnerID = sig as number;
    if (this.partner) {
      if (this.partner.id === possiblePartnerID) {
        // Resignaling is ok
        return;
      }
      throw new Error("already have a partner");
    }
    let partner = MockBasicPeer.allPeers[possiblePartnerID];
    if (!partner) {
      throw new Error("got signal from bad partner");
    }
    if (partner.partner && partner.partner !== this) {
      throw new Error("bad partner.partner");
    }
    if (partner.id === this.id) {
      throw new Error(`cannot self-connect. id = ${this.id}`);
    }
    if (partner.connected) {
      throw new Error("cannot connect to already-connected partner");
    }

    // Connect
    console.log("XXX MBP connecting", this.id, partner.id);
    this.connected = true;
    this.partner = partner;
    partner.connected = true;
    partner.partner = this;
    this.connectCallback && this.connectCallback();
    partner.connectCallback && partner.connectCallback();
  }

  send(data: any) {
    if (this.destroyed || !this.connected || !this.partner) {
      return;
    }
    this.partner.dataCallback && this.partner.dataCallback(data);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.connected = false;
    this.destroyed = true;
    this.closeCallback && this.closeCallback();
    if (this.partner) {
      this.partner.destroy();
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}

interface BasicPeerConstructor {
  new (initiator: boolean): BasicPeer;
}

let GLOBALS: { peerConstructor: BasicPeerConstructor } = {
  peerConstructor: WebRTCBasicPeer
};

export function createBasicPeer(initiator: boolean): BasicPeer {
  return new GLOBALS.peerConstructor(initiator);
}

export function useMockBasicPeer() {
  GLOBALS.peerConstructor = MockBasicPeer;
}

export function useWebRTCBasicPeer() {
  GLOBALS.peerConstructor = WebRTCBasicPeer;
}
