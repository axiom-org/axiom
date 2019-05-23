// A wrapper around WebTorrent's "torrent" object with an async API.
import { sleep } from "./Util";

export default class Torrent {
  torrent: any;
  magnet: string;
  infoHash: string;
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

  getProgress(): number {
    return this.torrent.progress;
  }

  // Returns the number of seeders, not counting this client.
  // If we aren't sure, we are pessimistic and assume a peer is not a seeder.
  // In particular if we don't have metadata yet we return 0 because we are
  // not confident in any seeders.
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
    let delay = 1000;
    while (!this.isDone()) {
      await sleep(delay);
      delay = Math.min(2 * delay, 1000 * 60 * 60);
      this.log(this.infoHash, "progress:", this.torrent.progress);
    }
    this.log(
      this.infoHash,
      "download complete.",
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

  getTorrentFileBuffer() {
    return this.torrent.torrentFile;
  }

  // Always returns null
  async waitForMetadata() {
    if (this.isDone()) {
      return null;
    }
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
    if (this.isDone()) {
      return null;
    }
    let promise = new Promise((resolve, reject) => {
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
}
