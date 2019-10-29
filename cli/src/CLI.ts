import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const yargs = require("yargs");

import Axiom, { KeyPair } from "axiom-api";
import PeerServer from "./PeerServer";

const ARGV = yargs.option("verbose", {
  alias: "v",
  description: "Output extra logs, useful for debugging",
  type: "boolean"
}).argv;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fatal(message: string) {
  console.log(message);
  process.exit(1);
}

async function asyncMain() {
  let args = ARGV._;

  if (args.length == 0) {
    fatal("Usage: axiom <operation> <arguments>");
  }

  let op = args[0];
  let rest = args.slice(1);

  if (op === "which") {
    if (rest.length != 0) {
      fatal("Usage: axiom which");
    }
    console.log(__filename);
    return;
  }

  if (op === "version") {
    if (rest.length != 0) {
      fatal("Usage: axiom version");
    }
    let dir = __dirname;
    while (true) {
      try {
        let text = fs.readFileSync(path.join(dir, "package.json"), "utf8");
        let data = JSON.parse(text);
        console.log(data.version);
        return;
      } catch (e) {}

      let newDir = path.join(dir, "..");
      if (dir === newDir) {
        fatal("could not find package.json");
      }
      dir = newDir;
    }
  }

  if (op === "scan") {
    if (rest.length > 1) {
      fatal("Usage: axiom scan [channel]");
    }
    let channel = rest[0];
    let axiom = new Axiom({ verbose: ARGV.verbose });
    if (channel) {
      console.log("joining", channel);
      axiom.join(channel);
    }
    while (true) {
      await sleep(1000);
      console.log(axiom.statusLine());
      let names = axiom.getChannelMembers(channel).map(x => x.slice(0, 6));
      if (channel) {
        console.log(channel, "members:", names.join(","));
      }
    }
    throw new Error("programmer error: control should not get here");
    return;
  }

  if (op === "host") {
    if (rest.length != 0) {
      fatal("Usage: axiom host");
    }

    let axiom = new Axiom({ network: "prod", verbose: true });

    let server = new PeerServer(axiom.keyPair, 3500, true);
    console.log("hosting on port 3500");
    server.connectNode(axiom);
    while (true) {
      await sleep(60000);
      // TODO: output data of some sort every minute?
    }

    throw new Error("programmer error: control should not get here");
    return;
  }

  fatal("unrecognized operation: " + op);
}

export function main() {
  asyncMain()
    .then(() => {
      process.exit(0);
    })
    .catch(e => {
      console.log(e.stack);
      fatal("exiting due to error");
    });
}
