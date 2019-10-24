#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

const yargs = require("yargs");

import CLIConfig from "./CLIConfig";
import KeyPair from "../iso/KeyPair";
import Message from "../iso/Message";
import Node from "../iso/Node";

const ARGV = yargs
      .option("verbose", {
	alias: "v",
	description: "Output extra logs, useful for debugging",
	type: "boolean",
      })
      .argv;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fatal(message) {
  console.log(message);
  process.exit(1);
}

function getNetwork(): string {
  let config = new CLIConfig();
  return config.getNetwork();
}

// Asks the CLI user a question, asynchronously returns the response.
async function ask(question, hideResponse): Promise<string> {
  let r = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  }) as any;

  let p = new Promise((resolve, reject) => {
    r.question(question, answer => {
      r.close();
      resolve(answer);
    });
    if (hideResponse) {
      r.stdoutMuted = true;
      r._writeToOutput = () => {
        r.output.write("*");
      };
    }
  });

  let answer = (await p) as string;
  if (hideResponse) {
    console.log();
  }
  return answer;
}

async function generate() {
  let kp = await login();
  console.log(kp.serialize());
  console.log("key pair generation complete");
}

// Ask the user for a passphrase to log in.
// Returns the keypair
async function login() {
  let config = new CLIConfig();
  let kp = config.getKeyPair();
  if (kp) {
    console.log(
      "logged into",
      config.getNetwork(),
      "network as",
      kp.getPublicKey()
    );
    return kp;
  }
  console.log("logging into", config.getNetwork(), "network...");
  let phrase = await ask("please enter your passphrase: ", true);
  kp = KeyPair.fromSecretPhrase(phrase);
  console.log("hello. your public key is", kp.getPublicKey());
  config.setKeyPair(kp);
  return kp;
}

async function main() {
  let args = ARGV._;

  if (args.length == 0) {
    fatal("Usage: axiom <operation> <arguments>");
  }

  let op = args[0];
  let rest = args.slice(1);

  if (op === "generate") {
    if (rest.length != 0) {
      fatal("Usage: axiom generate");
    }

    await generate();
    return;
  }

  if (op === "login") {
    if (rest.length != 0) {
      fatal("Usage: axiom login");
    }
    await login();
    return;
  }

  if (op === "logout") {
    if (rest.length != 0) {
      fatal("Usage: axiom logout");
    }
    let config = new CLIConfig();
    config.logout();
    console.log("logged out of", config.getNetwork(), "network");
    return;
  }

  if (op === "config") {
    if (rest.length != 1) {
      fatal("Usage: axiom config [network]");
    }
    let network = rest[0];
    let config = new CLIConfig();
    config.setNetwork(network);
    console.log("your CLI is now configured to use the", network, "network");
    return;
  }

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

  if (op === "get-private-key") {
    if (rest.length != 0) {
      fatal("Usage: axiom get-private-key");
    }
    let config = new CLIConfig();
    let kp = config.getKeyPair();
    if (kp) {
      console.log(kp.getPrivateKey());
    } else {
      console.log("you are not logged in");
    }
    return;
  }

  if (op === "scan") {
    if (rest.length != 1 && rest.length != 2) {
      fatal("Usage: axiom scan <url> <channel>");
    }
    let url = rest[0];
    let channel = rest[1];
    let node = new Node(null, [url], ARGV.verbose);
    if (channel) {
      console.log("joining", channel);
      node.join(channel);
    }
    while (true) {
      await sleep(1000);
      console.log(node.statusLine());
      let names = node.getChannelMembers(channel).map(x => x.slice(0, 6));
      if (channel) {
	console.log(channel, "members:", names.join(","));
      }
    }
    throw new Error("programmer error: control should not get here");
    return;
  }
  
  fatal("unrecognized operation: " + op);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(e => {
    console.log(e.stack);
    fatal("exiting due to error");
  });
