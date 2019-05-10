// A wrapper around WebTorrent's "torrent" object with an async API.
import { sleep } from "./Util";

export default class Torrent {
  torrent: any;
  magnet: string;
  infoHash: number;
  verbose: boolean;

  // This constructor should be cheap, since we often construct many Torrent objects from
  // the same underlying torrent.
  constructor(torrent, verbose?) {
    this.torrent = torrent;
    this.magnet = torrent.magnetURI;
    this.infoHash = torrent.infoHash;
    this.verbose = !!verbose;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  isDone() {
    return this.torrent.progress == 1;
  }

  // Returns the number of seeders, not counting this client.
  // If we aren't sure, we are pessimistic and assume a peer is not a seeder.
  // In particular if we don't have metadata yet we return 0 because we are confident in
  // zero seeders.
  // This also doesn't pick up seeds that already have all the data, and so do we, but the
  // peer wasn't connected to the network at the time we created this
  // torrent, because we have never had any need to communicate with those peers.
  numPeerSeeders() {
    let numPieces = this.torrent.pieces.length;
    if (numPieces == 0) {
      return 0;
    }

    let answer = 0;
    for (let wire of this.torrent.wires) {
      if (wire.peerPieces.buffer.length != numPieces) {
        // No need to iterate, this isn't a seed
        continue;
      }

      let wireIsSeed = true;
      for (let i = 0; i < numPieces; i++) {
        if (!wire.peerPieces.get(i)) {
          wireIsSeed = false;
          break;
        }
      }
      if (wireIsSeed) {
        answer++;
      }
    }
    return answer;
  }

  async monitorProgress() {
    while (!this.isDone()) {
      console.log("progress:", this.torrent.progress);
      await sleep(1000);
    }
    console.log(
      "progress complete.",
      this.torrent.downloaded,
      "bytes downloaded"
    );
  }

  // If you call this before metadata it will just return 0
  totalBytes() {
    let answer = 0;
    for (let file of this.torrent.files) {
      answer += file.length;
    }
    return answer;
  }

  // Always returns null
  async waitForMetadata() {
    if (this.torrent.files.length > 0) {
      return null;
    }

    let promise = new Promise((resolve, reject) => {
      this.torrent.on("metadata", () => {
        resolve(null);
      });
    });
    return await promise;
  }

  // Always returns null
  async waitForDone() {
    this.log("progress:", this.torrent.progress);
    if (this.isDone()) {
      this.log("waitForDone is done because we are already done");
      return null;
    }
    let promise = new Promise((resolve, reject) => {
      this.log("waiting for 'done' event");
      this.torrent.on("done", () => {
        resolve(null);
      });
    });
    return await promise;
  }

  // Waits until there are n seeds for this torrent
  async waitForSeeds(n) {
    while (this.numPeerSeeders() < n) {
      await sleep(1000);
    }
  }

  // Shuts down this torrent
  async destroy() {
    let promise = new Promise((resolve, reject) => {
      this.torrent.destroy(() => {
        resolve(null);
      });
    });
    return await promise;
  }

  // Returns a map from filename to data
  async readAll() {
    // TODO
  }
}
