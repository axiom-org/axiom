import WebSocket = require("isomorphic-ws");

import BasicPeer, { createBasicPeer } from "./BasicPeer";
import KeyPair from "./KeyPair";
import Message from "./Message";
import Sequence from "./Sequence";
import SignedMessage from "./SignedMessage";

// A Peer represents a connection to a single other node in the Axiom peer-to-peer
// network.
export default class Peer {
  verbose: boolean;
  createdAt: Date;

  // When the last message was received
  lastReceived: Date;

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

  _peer: BasicPeer;

  // Each Peer can only have a single close handler
  closeHandler: () => void;

  // Server URLs to intercept with a handler function
  static intercept: { [url: string]: (Peer) => void } = {};

  // Creates a Peer by connecting to a PeerServer.
  // Returns immediately rather than waiting for the connection.
  static connectToServer(
    keyPair: KeyPair,
    url: string,
    verbose: boolean
  ): Peer {
    let peer = new Peer({ initiator: true, keyPair, verbose, url });

    if (Peer.intercept[url]) {
      Peer.intercept[url](peer);
      return peer;
    }

    if (url.startsWith("mock:")) {
      peer.destroy();
      return peer;
    }

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

    let peerConnected = false;
    peer.onConnect(() => {
      peerConnected = true;
      ws.close();
    });

    ws.onerror = event => {
      peer.log(`websocket error: ${event.message}`);
    };

    ws.onclose = event => {
      if (!peerConnected) {
        peer.log(`${url} closed the socket before connecting`);
        peer.destroy();
      }
    };

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
    this.lastReceived = null;
    this.intermediary = options.intermediary;
    this.nonce = options.nonce;
    this.closeHandler = null;

    this.keyPair = options.keyPair;
    if (!this.keyPair) {
      this.keyPair = KeyPair.fromRandom();
    }
    this.peerPublicKey = options.peerPublicKey;

    this._peer = createBasicPeer(!!options.initiator);

    this.signals = new Sequence<object>();
    this._peer.onSignal(obj => {
      this.signals.push(obj);
    });
    this._peer.onError(err => {
      this.log(`error in connection to ${this.humanID()}: ${err.message}`);
    });
    this._peer.onClose(() => {
      if (this.closeHandler) {
        this.closeHandler();
      }
    });
  }

  humanID(): string {
    if (this.url) {
      if (this.peerPublicKey) {
        return `${this.peerPublicKey.slice(0, 6)} (${this.url})`;
      }
      return this.url;
    }

    if (this.peerPublicKey) {
      return this.peerPublicKey.slice(0, 6);
    }

    return "unknown peer";
  }

  connect(signals: Sequence<object>) {
    signals.forEach(obj => {
      this.signal(obj);
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
    this._peer.onConnect(callback);
  }

  onData(callback: (data: any) => void) {
    this._peer.onData(callback);
  }

  onError(callback: (Error) => void) {
    this._peer.onError(callback);
  }

  onClose(callback: () => void) {
    this.closeHandler = callback;
  }

  sendData(data: any) {
    this._peer.send(data);
  }

  ping() {
    if (this.isConnected()) {
      this.sendMessage(new Message("Ping"));
    }
  }

  // Returns the milliseconds of time this has been inactive
  inactive(): number {
    return (
      new Date().getTime() - (this.lastReceived || this.createdAt).getTime()
    );
  }

  statusLines(): string[] {
    return [
      `created at ${this.createdAt.toString()}`,
      `last received a message at ${this.lastReceived.toString()}`
    ];
  }

  handleTick() {
    let ms = this.inactive();
    if (ms > 10000) {
      this.log(`destroying inactive connection to ${this.humanID()}`);
      this.destroy();
      return;
    }
    if (ms > 5000) {
      this.ping();
      return;
    }
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
      this.lastReceived = new Date();
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
    return this._peer.isConnected();
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
