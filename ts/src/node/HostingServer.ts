// The node hosting server that miners run to store files.

import * as fs from "fs";
import * as path from "path";

const rimraf = require("rimraf");

import ChainClient from "../iso/ChainClient";
import KeyPair from "../iso/KeyPair";
import NetworkConfig from "../iso/NetworkConfig";
import ProviderListener from "./ProviderListener";
import Torrent from "../iso/Torrent";
import TorrentClient from "../iso/TorrentClient";
import { sleep } from "../iso/Util";
import { isDirectory, isFile, loadKeyPair } from "./FileUtil";

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
    this.client.verbose = this.verbose;

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

  async cleanUpFiles() {
    let files = fs.readdirSync(this.directory);
    let hashes = {};
    for (let file of files) {
      let hash = file.split(".")[0];
      if (!hash || hash.length == 0) {
        continue;
      }
      hashes[hash] = true;
    }

    let kept = 0;
    let deleted = 0;
    for (let hash in hashes) {
      let tfile = this.subdirectory(hash) + ".torrent";
      if (!isFile(tfile)) {
        this.log(`${hash} data is incomplete. removing it`);
        await this.deleteTorrentFiles(hash);
        deleted += 1;
      } else {
        kept += 1;
      }
    }

    this.log(`kept ${kept} cached torrents, deleted ${deleted}`);
  }

  async deleteTorrentFiles(infoHash) {
    let dir = this.subdirectory(infoHash);
    let tfile = dir + ".torrent";

    // Delete the .torrent file
    if (isFile(tfile)) {
      fs.unlinkSync(tfile);
    }

    // Delete all the content
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

  // Also cleans up the files on disk.
  // You can call this twice on an infoHash.
  async remove(infoHash) {
    if (infoHash.length < 5) {
      this.log("infoHash suspiciously short:", infoHash);
      return null;
    }
    this.log("removing data for hash", infoHash);
    if (this.client.hasTorrent(infoHash)) {
      await this.client.remove(infoHash);
    }
    return await this.deleteTorrentFiles(infoHash);
  }

  // Starts seeding based on a magnet url.
  // This can be called when we don't necessarily want this data to persist.
  // In particular, this won't write a .torrent file.
  // Logs but does not throw on errors.
  async seedMagnet(magnet): Promise<Torrent> {
    console.log("XXX start seedMagnet");
    let infoHash;
    try {
      infoHash = getInfoHash(magnet);
    } catch (e) {
      this.log("bad magnet:", magnet);
      return;
    }

    if (this.client.hasTorrent(infoHash)) {
      this.log(`already seeding hash ${infoHash}`);
      return this.client.getTorrent(infoHash);
    }

    let dir = this.subdirectory(infoHash);
    let tfile = dir + ".torrent";

    if (isFile(tfile) && isDirectory(dir)) {
      let t = this.client.seedWithTorrentFile(tfile, dir);
      await t.waitForDone();
      this.log(`seeding ${infoHash} from preexisting files`);
      console.log("XXX end seedMagnet");
      return t;
    }

    this.log(`downloading hash ${infoHash}`);
    let torrent = this.client.download(magnet, dir);
    console.log("XXX end seedMagnet");
    return torrent;
  }

  // Starts downloading, checks if the torrent is too large, and cancels it if so.
  async seedBucket(bucket) {
    let infoHash = getInfoHash(bucket.magnet);
    this.log(`seeding bucket ${bucket.name} with hash ${infoHash}`);

    let torrent = await this.seedMagnet(bucket.magnet);

    // Check to make sure that this torrent isn't too large
    await torrent.waitForMetadata();
    let bucketBytes = bucket.size * 1024 * 1024;
    let torrentBytes = torrent.totalBytes();

    if (torrentBytes > bucketBytes) {
      // The torrent *is* too large.
      this.log(
        `hash ${infoHash} contains ${torrentBytes} bytes, but bucket ${
          bucket.name
        } only holds ${bucketBytes} bytes`
      );
      await this.remove(infoHash);
    }

    await torrent.waitForDone();
    let dir = this.subdirectory(infoHash);
    let tfile = dir + ".torrent";
    if (!isFile(tfile)) {
      let buffer = torrent.getTorrentFileBuffer();
      this.log("download complete. saving torrent file to", tfile);
      fs.writeFileSync(tfile, buffer);
    }
  }

  async handleBuckets(buckets) {
    console.log("XXX handleBuckets");
    // Figure out the new info map
    let newInfoMap = {};
    for (let bucket of buckets) {
      let infoHash;
      try {
        infoHash = getInfoHash(bucket.magnet);
      } catch (e) {
        // TODO: I want to log bad magnets in some way, but just once
        // rather than every time we go through this code.
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
        let bucket = newInfoMap[infoHash];

        // Don't await. If we do await, a delay in downloading metadata can stall
        // this whole thread.
        this.seedBucket(bucket);
      }
    }

    this.infoMap = newInfoMap;
    console.log("XXX done with handleBuckets");
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
    await this.cleanUpFiles();
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
