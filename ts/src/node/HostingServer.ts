// The node hosting server that miners run to store files.

import * as fs from "fs";
import * as path from "path";

const rimraf = require("rimraf");

import ChainClient from "../iso/ChainClient";
import KeyPair from "../iso/KeyPair";
import NetworkConfig from "../iso/NetworkConfig";
import ProviderListener from "./ProviderListener";
import TorrentClient from "../iso/TorrentClient";
import { sleep } from "../iso/Util";
import { isDirectory, loadKeyPair } from "./FileUtil";

// Throws an error if the magnet url is an unknown format
function getInfoHash(magnet) {
  let prefix = "magnet:?xt=urn:btih:";
  if (!magnet.startsWith(prefix)) {
    throw new Error("unknown magnet format: " + magnet);
  }

  let rest = magnet.replace(prefix, "");
  return rest.split("&")[0];
}

export default class HostingServer {
  capacity: number;
  id: number;
  directory: string;
  verbose: boolean;
  client: TorrentClient;
  infoMap: { [infoHash: string]: any };
  listener: ProviderListener;
  keyPair: KeyPair;
  network: string;

  // options must contain exactly one way to specify the provider:
  // id - the id of the provider
  // keyPair - the filename containing keys for the owner
  // other options:
  // capacity - how much space we have to store files, in megabytes
  // directory - where to store the hosted files
  // verbose - defaults to false
  // network - required
  constructor(options) {
    if (options.id && options.keyPair) {
      throw new Error(
        "only one of the id and keyPair options can be set for HostingServer"
      );
    }

    if (!isDirectory(options.directory)) {
      throw new Error(options.directory + " is not a directory");
    } else {
      this.log("hosting files in", options.directory);
    }

    let config = new NetworkConfig(options.network);
    this.network = options.network;

    if (options.keyPair) {
      this.keyPair = loadKeyPair(options.keyPair);
    }

    this.capacity = options.capacity;
    this.id = options.id;
    this.directory = options.directory;
    this.verbose = !!options.verbose;
    this.client = new TorrentClient(options.network);

    // These messages are things like "x got uninterested. y is choking us."
    // If we have network-level troubles we might want to expose these.
    // this.client.verbose = this.verbose;

    // Maps info hash to bucket object
    this.infoMap = {};

    this.listener = new ProviderListener(options.network, this.verbose);
    this.listener.onBuckets(buckets => this.handleBuckets(buckets));
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  subdirectory(infoHash) {
    return path.join(this.directory, infoHash);
  }

  // Also cleans up the files on disk
  async remove(infoHash) {
    if (infoHash.length < 5) {
      this.log("infoHash suspiciously short:", infoHash);
      return null;
    }
    this.log("no longer hosting hash", infoHash);
    if (this.client.hasTorrent(infoHash)) {
      await this.client.remove(infoHash);
    }
    let promise = new Promise((resolve, reject) => {
      rimraf(this.subdirectory(infoHash), { disableGlob: true }, err => {
        if (err) {
          this.log("rimraf error:", err.message);
        }
        resolve(null);
      });
    });
    return await promise;
  }

  async handleBuckets(buckets) {
    // Figure out the new info map
    let newInfoMap = {};
    for (let bucket of buckets) {
      let infoHash;
      try {
        infoHash = getInfoHash(bucket.magnet);
      } catch (e) {
        // TODO: I want to log bad magnets in some way, but just once rather than every time
        // we go through this code.
        continue;
      }
      newInfoMap[infoHash] = bucket;
    }

    // Handle data that is being deleted
    for (let infoHash in this.infoMap) {
      if (!newInfoMap[infoHash]) {
        let bucket = this.infoMap[infoHash];
        this.log(`bucket ${bucket.name} is no longer using hash ${infoHash}`);
        await this.remove(infoHash);
      }
    }

    // Handle data that is being added
    for (let infoHash in newInfoMap) {
      if (!this.infoMap[infoHash]) {
        // Start seeding this torrent. If the directory is already there from a previous run,
        // this should reuse it.
        let dir = this.subdirectory(infoHash);
        let bucket = newInfoMap[infoHash];

        let torrent = this.client.download(bucket.magnet, dir);

        // Check to make sure that this torrent isn't too large
        await torrent.waitForMetadata();
        let bucketBytes = bucket.size * 1024 * 1024;
        let torrentBytes = torrent.totalBytes();

        this.log(
          `downloading ${torrentBytes} bytes with hash ${infoHash} for bucket ${
            bucket.name
          }`
        );

        if (torrentBytes > bucketBytes) {
          // The torrent *is* too large.
          this.log(
            "torrent",
            infoHash,
            "contains",
            torrentBytes,
            "bytes but bucket",
            bucket.name,
            "only holds",
            bucketBytes,
            "bytes"
          );
          await this.remove(infoHash);
        }
      }
    }

    this.infoMap = newInfoMap;
  }

  // Makes sure that this.id is set, creating a new provider if need be.
  async acquireProviderID() {
    if (this.id) {
      return this.id;
    }

    this.log("checking to see if we already have a provider created...");
    let client = new ChainClient(this.keyPair, this.network);
    let providers = await client.getProviders({
      owner: this.keyPair.getPublicKey()
    });
    if (providers.length > 1) {
      throw new Error(
        "HostingServer doesn't know how to handle a user that owns multiple providers"
      );
    }
    if (providers.length == 1) {
      let provider = providers[0];
      if (provider.capacity > this.capacity) {
        throw new Error(
          "the chain says we need " +
            provider.capacity +
            " capacity but we only have " +
            this.capacity
        );
      }
      this.id = provider.id;
      this.log("found provider id:", this.id);
      return this.id;
    }

    // Create a provider
    this.log("no provider found. creating one...");
    let provider = await client.createProvider(this.capacity);
    this.id = provider.id;
    this.log("created a new provider with id:", this.id);
    return this.id;
  }

  // Checks that our keypair is valid if we have one.
  // If it isn't valid, we just wait. This lets servers get started up
  // before the keypairs have affiliated accounts created yet.
  async checkKeyPair() {
    if (!this.keyPair) {
      return;
    }
    let client = new ChainClient(this.keyPair, this.network);
    client.verbose = this.verbose;
    let user = this.keyPair.getPublicKey();
    while (true) {
      let account = await client.getAccount(user);
      if (account) {
        console.log("found our user account:", JSON.stringify(account));
        return;
      }

      console.log("user", user, "does not exist. please create it");
      await sleep(10000);
    }
  }

  async serve() {
    await this.checkKeyPair();
    try {
      await this.acquireProviderID();
    } catch (e) {
      console.log("failed to acquire provider id: " + e.message);
      process.exit(1);
    }
    await this.listener.listen(this.id);
  }
}
