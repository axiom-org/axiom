import * as http from "http";
import * as WebSocket from "ws";
const url = require("url");

import Node from "../iso/Node";
import Peer from "../iso/Peer";
import Sequence from "../iso/Sequence";

// A PeerServer listens for websockets and exchanges enough information over them
// to construct a Peer connection.
export default class PeerServer {
  verbose: boolean;
  peerHandler: (Peer) => void;
  port: number;

  constructor(port: number, verbose: boolean) {
    this.port = port;
    this.verbose = verbose;
    this.peerHandler = null;

    let server = http.createServer((req, res) => {
      let parsed = url.parse(req.url, true);
      if (parsed.pathname === "/healthz") {
        res.write("OK\n");
        res.end();
      }
    });

    let wss = new WebSocket.Server({ server: server });
    wss.on("connection", ws => {
      let peer = new Peer({ verbose: verbose });

      peer.signals.forEach(data => {
        ws.send(JSON.stringify(data));
      });

      let incomingSignals = new Sequence<object>();
      ws.on("message", encoded => {
        try {
          let signal = JSON.parse(encoded);
          incomingSignals.push(signal);
        } catch (e) {
          console.log("websocket decoding error:", e);
        }
      });
      peer.connect(incomingSignals);

      peer.onError(err => {
        console.log("peer disconnected with error:", err.message);
      });

      if (this.peerHandler) {
        this.peerHandler(peer);
      }
    });

    server.listen(port);
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  onPeer(callback: (Peer) => void) {
    if (this.peerHandler) {
      throw new Error("onPeer can only be called once");
    }
    this.peerHandler = callback;
  }

  // Let peers connect to the provided node through this PeerServer.
  connectNode(node: Node) {
    this.onPeer(async peer => {
      await peer.waitUntilConnected();
      node.addPeer(peer);
    });
  }
}
