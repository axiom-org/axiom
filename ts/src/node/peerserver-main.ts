// This is the entry point for a standalone peerserver.

const yargs = require("yargs");

import KeyPair from "../iso/KeyPair";
import Node from "../iso/Node";
import PeerServer from "./PeerServer";

const ARGV = yargs
  .option("port", {
    description: "What port to listen for websockets on",
    type: "number"
  })
  .option("bootstrap", {
    description: "What ports to bootstrap by opening",
    type: "string"
  })
  .option("verbose", {
    description: "Whether to show a lot of debug info",
    default: true,
    type: "boolean"
  }).argv;

if (!ARGV.port && !ARGV.bootstrap) {
  throw new Error("must specify at least one of --port and --bootstrap");
}

let kp = KeyPair.fromRandom();
let bootstrap = [];
if (ARGV.bootstrap) {
  let portStrings = ARGV.bootstrap.split(",");
  for (let str of portStrings) {
    let port = parseInt(str);
    if (port) {
      let url = `ws://localhost:${port}`;
      console.log("bootstrapping with", url);
      bootstrap.push(url);
    } else {
      throw new Error("bad port: " + str);
    }
  }
}

let node = new Node(kp, bootstrap, ARGV.verbose);

if (ARGV.port) {
  console.log("listening on port", ARGV.port);
  let peerServer = new PeerServer(kp, ARGV.port, ARGV.verbose);
  peerServer.connectNode(node);
}
