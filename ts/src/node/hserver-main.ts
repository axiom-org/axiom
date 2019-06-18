// This is the entry point for the hosting server.

import * as http from "http";
import * as os from "os";
import * as path from "path";

import * as args from "args";
import * as diskusage from "diskusage";

import BlackHoleProxy from "./BlackHoleProxy";
import HostingServer from "./HostingServer";
import Message from "../iso/Message";
import PeerServer from "./PeerServer";
import Tracker from "./Tracker";

args
  .option("tracker", "The port on which the tracker will be running", 4000)
  .option("proxy", "The port on which the proxy will be running", 3000)
  .option("peer", "The port on which the peer server will be running", 3500)
  .option("id", "The provider id to host files for", 0)
  .option("keypair", "File containing keys for the user to host files for", "")
  .option("capacity", "Amount of space in megabytes to host", 0)
  .option("network", "Which network to connect to", "local")
  .option(
    "directory",
    "The directory to store files in",
    path.join(os.homedir(), "hostfiles")
  );

const flags = args.parse(process.argv);

process.on("warning", e => console.warn(e.stack));

if (flags.capacity <= 0) {
  console.log("to host files you must set --capacity");
  process.exit(1);
}

if (flags.id < 1 && flags.keypair.length < 1) {
  console.log(
    flags.id,
    "you must specify a provider with either --id or --keypair"
  );
  process.exit(1);
}

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

let options = {
  id: undefined,
  keyPair: undefined,
  capacity: flags.capacity,
  directory: flags.directory,
  verbose: true,
  network: flags.network
};
if (flags.id >= 1) {
  options.id = flags.id;
} else {
  options.keyPair = flags.keypair;
}

let host = new HostingServer(options);
host.serve();

// Run a black hole proxy
let proxy = new BlackHoleProxy(flags.proxy);

// Run a tracker
let tracker = new Tracker(flags.tracker);

tracker.onMagnet = magnet => host.seedMagnet(magnet);

// Run a PeerServer
let peerServer = new PeerServer(flags.peer, true);
console.log("PeerServer listening on port", flags.peer);
peerServer.onPeer(peer => {
  // For compatibility with CLI 0.0.25
  peer.onData(data => {
    let s = data.toString();
    console.log("peerserver got data:", s);
    if (s === "ping") {
      peer.sendData("pong");
    }
  });

  // Handles CLI 0.0.26 and beyond
  peer.onMessage(message => {
    if (message.type === "Ping") {
      console.log("peerserver got ping");
      peer.sendMessage(new Message("Pong"));
    }
  });
});
