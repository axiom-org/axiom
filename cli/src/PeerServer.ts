import * as http from "http";
import * as WebSocket from "ws";
const url = require("url");

import Axiom, { KeyPair, Peer, Sequence } from "axiom-api";

// A PeerServer listens for websockets and exchanges enough information over them
// to construct a Peer connection.
export default class PeerServer {
  verbose: boolean;
  peerHandler: (p: Peer) => void;
  keyPair: KeyPair;
  port: number;
  node: Axiom;
  cleanup: () => Promise<void>;

  constructor(keyPair: KeyPair, port: number, verbose: boolean) {
    this.keyPair = keyPair;
    if (!this.keyPair) {
      this.keyPair = KeyPair.fromRandom();
    }
    if (!port || port < 1) {
      throw new Error(`bad port: ${port}`);
    }
    this.port = port;
    this.verbose = verbose;
    this.peerHandler = null;
    this.node = null;

    let server = http.createServer(async (req, res) => {
      let parsed = url.parse(req.url, true);
      if (parsed.pathname === "/healthz") {
        res.write("OK\n");
        res.end();
        return;
      }

      if (parsed.pathname === "/statusz") {
        let status = await this.status();
        for (let line of status) {
          res.write(line + "\n");
        }
        res.end();
        return;
      }
    });

    let wss = new WebSocket.Server({ server: server });
    wss.on("connection", ws => {
      let peer = new Peer({ keyPair: this.keyPair, verbose: verbose });

      peer.signals.forEach(data => {
        ws.send(JSON.stringify(data));
      });

      let incomingSignals = new Sequence<object>();
      ws.on("message", encoded => {
        let signal;
        try {
          signal = JSON.parse(encoded.toString());
        } catch (e) {
          console.log("websocket decoding error:", e);
          return;
        }
        incomingSignals.push(signal);
      });
      peer.connect(incomingSignals);

      if (this.peerHandler) {
        this.peerHandler(peer);
      }
    });

    this.cleanup = async () => {
      await new Promise((resolve, reject) => {
        server.close(resolve);
      });
      await new Promise((resolve, reject) => {
        wss.close(resolve);
      });
    };

    server.listen(port);
  }

  log(...args: any[]) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  async status(): Promise<string[]> {
    if (this.node) {
      return await this.node.statusLines();
    }

    return ["this.node == null"];
  }

  onPeer(callback: (p: Peer) => void) {
    if (this.peerHandler) {
      throw new Error("onPeer can only be called once");
    }
    this.peerHandler = callback;
  }

  // Let peers connect to the provided node through this PeerServer.
  connectNode(node: Axiom) {
    if (this.node) {
      throw new Error("can only connectNode once");
    }
    this.node = node;
    if (this.keyPair.getPublicKey() !== this.node.keyPair.getPublicKey()) {
      throw new Error("keys from PeerServer and Node must match");
    }
    this.onPeer(async peer => {
      await peer.waitUntilConnected();
      this.node.addPeer(peer);
    });
  }

  async close(): Promise<void> {
    await this.cleanup();
  }
}
