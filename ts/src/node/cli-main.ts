#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

import axios from "axios";
const checksum = require("checksum");

import ChainClient from "../iso/ChainClient";
import CLIConfig from "./CLIConfig";
import KeyPair from "../iso/KeyPair";
import Message from "../iso/Message";
import NetworkConfig from "../iso/NetworkConfig";
import ProviderListener from "./ProviderListener";
import TorrentClient from "../iso/TorrentClient";

function fatal(message) {
  console.log(message);
  process.exit(1);
}

function getNetwork(): string {
  let config = new CLIConfig();
  return config.getNetwork();
}

function newChainClient(kp?: KeyPair): ChainClient {
  let client = new ChainClient(kp, getNetwork());
  return client;
}

// Makes a validated bucket name from a user-provided one
function makeBucketName(input): string {
  let parts = input.split(":");
  if (parts.length > 2) {
    throw new Error("bucket name has too many parts: " + input)
  }
  if (parts.length == 0) {
    throw new Error("bucket name (\"" + input + "\") is empty");
  }
  if (parts.length == 1) {
    parts.unshift("www");
  }

  // Validate the parts. Make sure this regex matches the one in bucket.go
  let regex = RegExp("^[-a-zA-Z0-9]+$")
  for (let i = 0; i < 2; i++) {
    if (i == 0 && parts[0] == "www") {
      continue;
    }
    if (!regex.test(parts[i])) {
      throw new Error("bucket name has an invalid part: " + parts[i]);
    }
  }

  return parts.join(":");
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

// Fetches, displays, and returns the account data for a user.
async function status(user) {
  let client = newChainClient();
  let account = await client.getAccount(user);
  if (!account) {
    console.log("no account found for user", user);
    return null;
  }

  console.log("account data:");
  console.log(account);
  return account;
}

// Asks for a login then displays the status
async function ourStatus() {
  let kp = await login();
  await status(kp.getPublicKey());
}

async function generate() {
  let kp = await login();
  console.log(kp.serialize());
  console.log("key pair generation complete");
}

async function getProvider(id) {
  let client = newChainClient();
  let provider = await client.getProvider(id);
  if (provider) {
    console.log(provider);
  } else {
    console.log("no provider with id", id);
  }
}

async function getProviders(query) {
  let client = newChainClient();
  let providers = await client.getProviders(query);
  let word = providers.length === 1 ? "provider" : "providers";
  console.log(providers.length + " " + word + " found");
  for (let p of providers) {
    console.log(p);
  }
}

async function createProvider(capacity) {
  let kp = await login();
  let client = newChainClient(kp);
  let provider = await client.createProvider(capacity);
  console.log("created provider:");
  console.log(provider);
}

async function getBucket(name) {
  let client = newChainClient();
  let bucket = await client.getBucket(name);
  if (bucket) {
    console.log(bucket);
  } else {
    console.log("no bucket with name " + name);
  }
}

async function getBuckets(query) {
  let client = newChainClient();
  let buckets = await client.getBuckets(query);
  let word = buckets.length === 1 ? "bucket" : "buckets";
  console.log(buckets.length + " " + word + " found");
  for (let b of buckets) {
    console.log(b);
  }
}

// Just creates a bucket
async function createBucket(name, size) {
  let kp = await login();
  let client = newChainClient(kp);
  let bucket = await client.createBucket(name, size);
  console.log("created bucket:");
  console.log(bucket);
}

// First creates a bucket, then allocates it to some providers.
async function newBucket(name, size) {
  let kp = await login();
  let client = newChainClient(kp);

  // Aim for as much replication as we are configured with trackers
  let config = new NetworkConfig(getNetwork());
  let replication = config.trackers.length;

  // Find some providers with available space
  let providers = await client.getProviders({ available: size });
  if (providers.length < replication) {
    throw new Error(
      "only " +
        providers.length +
        " providers have " +
        size +
        " available space"
    );
  }

  let bucket = await client.createBucket(name, size);
  console.log("created bucket:", name);
  for (let i = 0; i < replication; i++) {
    await client.allocate(name, providers[i].id);
    console.log("allocated bucket to", i + 1, "provider" + (i == 0 ? "" : "s"));
  }
}

async function deleteBucket(name) {
  let kp = await login();
  let client = newChainClient(kp);
  let bucket = await client.deleteBucket(name);
  console.log("deleted bucket:", name);
}

async function setMagnet(bucketName, magnet) {
  if (!magnet || !magnet.startsWith("magnet:")) {
    throw new Error("" + magnet + " is not a valid magnet URI");
  }
  let kp = await login();
  let client = newChainClient(kp);
  let bucket = await client.updateBucket(bucketName, magnet);
  console.log("updated bucket:");
  console.log(bucket);
}

async function allocate(bucketName, providerID) {
  let kp = await login();
  let client = newChainClient(kp);
  await client.allocate(bucketName, providerID);
  console.log("allocated", bucketName, "bucket to provider", providerID);
}

async function deallocate(bucketName, providerID) {
  let kp = await login();
  let client = newChainClient(kp);
  await client.deallocate(bucketName, providerID);
  console.log("deallocated", bucketName, "bucket from provider", providerID);
}

async function deploy(directory, bucketName) {
  let dir = path.resolve(directory);
  let client = new TorrentClient(getNetwork());
  console.log("creating torrent...");
  let torrent = await client.seed(dir);
  console.log("serving torrent", torrent.infoHash, "via", torrent.magnet);
  await setMagnet(bucketName, torrent.magnet);
  console.log("chain updated. waiting for host to sync torrent...");
  await torrent.waitForSeeds(1);
  console.log("deploy complete. cleaning up...");
  await client.destroy();
}

async function download(bucketName, directory) {
  let dir = path.resolve(directory);
  if (fs.existsSync(dir)) {
    fatal(dir + " already exists");
  }
  let cc = newChainClient();
  let bucket = await cc.getBucket(bucketName);
  if (!bucket || !bucket.magnet || !bucket.magnet.startsWith("magnet")) {
    fatal("bucket has no magnet: " + JSON.stringify(bucket));
  }
  console.log("downloading", bucket.magnet, "to", dir);
  let tc = new TorrentClient(getNetwork());
  let torrent = tc.download(bucket.magnet, dir);
  await torrent.waitForDone();
  await tc.destroy();
}

async function signup(email) {
  // Check if this email is signed up for the newsletter
  let response = await axios.get(
    "https://faucet.lacker.now.sh/?email=" + email
  );

  if (response.data != "OK") {
    console.log(
      email,
      "is not a recognized email. please visit axiom.org/newsletter to register."
    );
    return;
  }

  console.log("Sending", email, "an authentication token....");
  console.log("Please check your email. this may take a few minutes.");
  let token = await ask("Enter the authentication token: ", true);

  // TODO: move validation logic on-chain with an asymmetric hash
  let parts = token.split(":");
  if (parts.length != 2 || checksum("bluurf" + parts[0]) !== parts[1]) {
    console.log("Sorry, but this is not a valid authentication token.");
    return;
  }

  // Check if the account exists yet
  let passphrase = parts[1];
  let target = KeyPair.fromSecretPhrase(passphrase);
  let source = KeyPair.fromSecretPhrase("mint");
  let client = newChainClient(source);
  let account = await client.getAccount(target.getPublicKey());
  if (account) {
    console.log("An account for", email, "has already signed up.");
    return;
  }

  // Claim faucet money
  await client.send(target.getPublicKey(), 300000);

  console.log(
    "A developer account has been populated for you. Your passphrase is:"
  );
  console.log(passphrase);
  console.log(
    "Please store this passphrase safely. You can then log in using 'axiom login'."
  );
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
  console.log("hello. your username is", kp.getPublicKey());
  config.setKeyPair(kp);
  return kp;
}

// Sends currency
async function send(to: string, amount: number) {
  let kp = await login();
  let client = newChainClient(kp);
  await client.send(to, amount);
}

async function main() {
  let args = process.argv.slice(2);

  if (args.length == 0) {
    fatal("Usage: axiom <operation> <arguments>");
  }

  let op = args[0];
  let rest = args.slice(1);

  if (op === "status") {
    if (rest.length > 1) {
      fatal("Usage: axiom status [publickey]");
    }
    if (rest.length === 0) {
      await ourStatus();
    } else {
      await status(rest[0]);
    }
    return;
  }

  if (op === "generate") {
    if (rest.length != 0) {
      fatal("Usage: axiom generate");
    }

    await generate();
    return;
  }

  if (op === "create-provider") {
    if (rest.length != 1) {
      fatal("Usage: axiom create-provider <capacity>");
    }

    let capacity = parseInt(rest[0]);
    if (!capacity) {
      fatal("bad argument: " + rest[0]);
    }
    await createProvider(capacity);
    return;
  }

  if (op === "get-provider") {
    if (rest.length != 1) {
      fatal("Usage: axiom get-provider <id>");
    }
    let id = parseInt(rest[0]);
    if (!id) {
      fatal("bad provider id argument: " + rest[0]);
    }
    await getProvider(id);
    return;
  }

  if (op === "get-providers") {
    if (rest.length > 2) {
      fatal(
        "Usage: axiom get-providers [owner=<id>] [bucket=<name>] [available=<amount]"
      );
    }
    let query = {} as any;
    for (let arg of rest) {
      if (arg.startsWith("owner=")) {
        query.owner = arg.split("=")[1];
      } else if (arg.startsWith("bucket=")) {
        query.bucket = arg.split("=")[1];
      } else if (arg.startsWith("available=")) {
        let s = arg.split("=")[1];
        query.available = parseInt(s);
        if (!query.available) {
          fatal("bad available argument: " + s);
        }
      } else {
        fatal("unrecognized arg: " + arg);
      }
    }
    if (rest.length === 0) {
      let kp = await login();
      console.log("fetching your providers");
      query.owner = kp.getPublicKey();
    }
    await getProviders(query);
    return;
  }

  if (op === "new-bucket") {
    if (rest.length != 2) {
      fatal("Usage: axiom new-bucket <name> <size>");
    }
    let name = makeBucketName(rest[0]);
    let size = parseInt(rest[1]);
    if (!size) {
      fatal("bad size:" + rest[1]);
    }
    await newBucket(name, size);
    return;
  }

  if (op === "create-bucket") {
    if (rest.length != 2) {
      fatal("Usage: axiom create-bucket <name> <size>");
    }
    let name = makeBucketName(rest[0]);
    let size = parseInt(rest[1]);
    if (!size) {
      fatal("bad size:" + rest[1]);
    }
    await createBucket(name, size);
    return;
  }

  if (op === "delete-bucket") {
    if (rest.length != 1) {
      fatal("Usage: axiom delete-bucket <name>");
    }
    let name = makeBucketName(rest[0]);
    await deleteBucket(name);
    return;
  }

  if (op === "get-bucket") {
    if (rest.length != 1) {
      fatal("Usage: axiom get-bucket <name>");
    }
    await getBucket(makeBucketName(rest[0]));
    return;
  }

  if (op === "get-buckets") {
    if (rest.length > 2) {
      fatal("Usage: axiom get-buckets [owner=<id>] [provider=<id>]");
    }
    let query = {} as any;
    for (let arg of rest) {
      if (arg.startsWith("owner=")) {
        query.owner = arg.split("=")[1];
      } else if (arg.startsWith("provider=")) {
        let rhs = arg.split("=")[1];
        let id = parseInt(rhs);
        if (!id) {
          fatal("bad provider id: " + rhs);
        }
        query.provider = id;
      } else {
        fatal("unrecognized arg: " + arg);
      }
    }
    if (rest.length === 0) {
      let kp = await login();
      console.log("fetching your buckets");
      query.owner = kp.getPublicKey();
    }
    await getBuckets(query);
    return;
  }

  if (op === "set-magnet") {
    if (rest.length != 2) {
      fatal("Usage: axiom set-magnet [bucketName] [magnet]");
    }

    let [bucketName, magnet] = rest;
    bucketName = makeBucketName(bucketName);
    await setMagnet(bucketName, magnet);
    return;
  }

  if (op === "listen") {
    if (rest.length != 1) {
      fatal("Usage: axiom listen [providerID]");
    }

    let id = parseInt(rest[0]);
    if (!id) {
      fatal("bad id: " + rest[0]);
    }
    let listener = new ProviderListener(getNetwork(), true);
    await listener.listen(id);
    return;
  }

  if (op === "alloc" || op === "allocate") {
    if (rest.length != 2) {
      fatal("Usage: axiom " + op + " [bucketName] [providerID]");
    }

    let [bucketName, idstr] = rest;
    bucketName = makeBucketName(bucketName);    
    let providerID = parseInt(idstr);
    if (!providerID) {
      fatal("bad id: " + idstr);
    }
    await allocate(bucketName, providerID);
    return;
  }

  if (op === "deploy") {
    if (rest.length != 2) {
      fatal("Usage: axiom deploy [directory] [bucketName]");
    }

    let directory = rest[0];
    let bucketName = makeBucketName(rest[1]);
    await deploy(directory, bucketName);
    return;
  }

  if (op === "download") {
    if (rest.length != 2) {
      fatal("Usage: axiom download [bucketName] [directory]");
    }

    let bucketName = makeBucketName(rest[0]);
    let directory = rest[1];
    await download(bucketName, directory);
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

  if (op === "signup") {
    if (rest.length != 1) {
      fatal("Usage: axiom signup [your-email-address]");
    }
    let email = rest[0];
    await signup(email);
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

  if (op === "send") {
    if (rest.length != 2) {
      fatal("Usage: axiom send [recipient] [amount]");
    }
    let [to, amountStr] = rest;
    let amount = parseInt(amountStr);
    if (!amount || amount < 0) {
      fatal("bad amount: " + amount);
    }
    await send(to, amount);
    return;
  }

  if (op === "which") {
    if (rest.length != 0) {
      fatal("Usage: axiom which");
    }
    console.log(__filename);
    return;
  }

  fatal("unrecognized operation: " + op);
}

main()
  .then(() => {
    // console.log("done");
  })
  .catch(e => {
    console.log(e.stack);
    fatal("exiting due to error");
  });
