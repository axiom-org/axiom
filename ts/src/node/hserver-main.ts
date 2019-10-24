// This is the entry point for the hosting server.

import * as http from "http";
import * as os from "os";
import * as path from "path";

import * as args from "args";
import * as diskusage from "diskusage";

import NetworkConfig from "../iso/NetworkConfig";
import Node from "../iso/Node";
import PeerServer from "./PeerServer";
import { loadKeyPair } from "./FileUtil";

args
  .option("port", "The port on which the bootstrapper will be running", 3500)
  .option("keypair", "File containing keys", "")
  .option("network", "Which network to connect to", "local")
  .option(
    "directory",
    "The directory to store files in",
    path.join(os.homedir(), "hostfiles")
  );

const flags = args.parse(process.argv);

process.on("warning", e => console.warn(e.stack));

// Just for logging, check how much available disk space there is
try {
  let info = diskusage.checkSync(flags.directory);
  console.log(
    "available space at",
    flags.directory,
    "is",
    Math.floor(info.available / 1024 / 1024),
    "MiB"
  );
} catch (err) {
  console.log("disk check error:", err);
}

let keyPair = loadKeyPair(flags.keypair);

// Run a PeerServer
let peerServer = new PeerServer(keyPair, flags.peer, true);
console.log("PeerServer listening on port", flags.peer);

let config = new NetworkConfig(flags.network);
let node = new Node(keyPair, config.bootstrap, true);

peerServer.connectNode(node);
