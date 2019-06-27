import * as SimplePeer from "simple-peer";
import WebSocket = require("isomorphic-ws");

import KeyPair from "./KeyPair";
import Message from "./Message";
import Sequence from "./Sequence";
import SignedMessage from "./SignedMessage";

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
  createdAt: Date;

  // Our keypair
  keyPair: KeyPair;

  // url is set for Peers created by connectToServer
  url: string;

  // The public key we expect to be connecting to.
  // This is null if we don't know who we are connecting to.
  // In that case, the Node fills this in, the first time we receive a message.
  peerPublicKey: string;

  // The public key of the intermediary node that is helping us connect.
  // Null if we are not connecting via intermediary.
  intermediary: string;

  // A random string that specifies this particular peer connection.
  // If it's null, don't use nonce checks.
  nonce: string;

  // The signals emitted by this peer
  signals: Sequence<object>;

  _peer: SimplePeer;

  // Creates a Peer by connecting to a PeerServer.
  // Returns immediately rather than waiting for the connection.
  static connectToServer(
    keyPair: KeyPair,
    url: string,
    verbose: boolean
  ): Peer {
    let peer = new Peer({ initiator: true, keyPair, verbose, url });
    let ws = new WebSocket(url);

    ws.onopen = () => {
      peer.signals.forEach(signal => {
        ws.send(JSON.stringify(signal));
      });
    };

    let incomingSignals = new Sequence<object>();
    ws.onmessage = event => {
      try {
        let signal = JSON.parse(event.data);
        incomingSignals.push(signal);
      } catch (e) {
        console.log("websocket decoding error:", e);
      }
    };
    peer.connect(incomingSignals);

    peer.onConnect(() => {
      ws.close();
    });

    return peer;
  }

  constructor(options: {
    keyPair?: KeyPair;
    peerPublicKey?: string;
    initiator?: boolean;
    verbose?: boolean;
    url?: string;
    intermediary?: string;
    nonce?: string;
  }) {
    this.verbose = !!options.verbose;
    this.url = options.url;
    this.createdAt = new Date();
    this.intermediary = options.intermediary;
    this.nonce = options.nonce;

    this.keyPair = options.keyPair;
    if (!this.keyPair) {
      this.keyPair = KeyPair.fromRandom();
    }
    this.peerPublicKey = options.peerPublicKey;
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

  signal(s: object) {
    this._peer.signal(s);
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

  onClose(callback: () => void) {
    this._peer.on("close", callback);
  }

  sendData(data: any) {
    // Work around https://github.com/feross/simple-peer/issues/480
    if (this._peer._channel && this._peer._channel.readyState !== "open") {
      return;
    }

    this._peer.send(data);
  }

  ping() {
    this.sendMessage(new Message("Ping"));
  }

  findNode(publicKey: string) {
    if (!KeyPair.isValidHexString(publicKey)) {
      return;
    }

    this.sendMessage(new Message("FindNode", { publicKey }));
  }

  sendMessage(message: Message) {
    let signed = SignedMessage.fromSigning(message, this.keyPair);
    this.sendData(signed.serialize());
  }

  onSignedMessage(callback: (sm: SignedMessage) => void) {
    this.onData(data => {
      let sm;
      try {
        sm = SignedMessage.fromSerialized(data);
      } catch (e) {
        this.log("error in decoding signed message:", e);
        return;
      }
      if (this.peerPublicKey && this.peerPublicKey != sm.signer) {
        this.log(
          "expected message from",
          this.peerPublicKey,
          "but received message from",
          sm.signer
        );
        return;
      }
      callback(sm);
    });
  }

  onMessage(callback: (m: Message) => void) {
    this.onSignedMessage(sm => callback(sm.message));
  }

  destroy() {
    this._peer.destroy();
    this.signals.finish();
  }

  isConnected() {
    return this._peer.connected;
  }

  async waitUntilConnected() {
    if (this.isConnected()) {
      return;
    }
    return new Promise((resolve, reject) => {
      this.onConnect(resolve);
    });
  }
}
