import Torrent from "../iso/Torrent";
import TorrentClient from "../iso/TorrentClient";
import UntrustedClient from "./UntrustedClient";

export default class Bucket {
  network: string;
  name: string;
  owner: string;
  size: number;
  magnet: string;
  torrentClient: TorrentClient;
  untrustedClient: UntrustedClient;
  torrent: Torrent;
  files: { [filename: string]: File };

  constructor(
    network: string,
    name: string,
    owner: string,
    size: number,
    magnet: string,
    torrentClient: TorrentClient,
    untrustedClient: UntrustedClient
  ) {
    this.network = network;
    this.name = name;
    this.owner = owner;
    this.size = size;
    this.magnet = magnet;
    this.torrentClient = torrentClient;
    this.untrustedClient = untrustedClient;
    this.torrent = null;
    this.files = null;
  }

  async download() {
    if (this.isDownloaded()) {
      return;
    }
    if (!this.magnet || this.magnet === "") {
      throw new Error("cannot download without magnet");
    }
    this.torrent = this.torrentClient.download(this.magnet);
    await this.torrent.waitForDone();

    // Populate this.files
    this.files = {};
    for (let file of this.torrent.files) {
      this.files[file.name] = file;
    }
  }

  async upload() {
    throw new Error("XXX");
  }

  isDownloaded(): boolean {
    return this.torrent && this.torrent.isDone() && this.files && true;
  }

  // Returns null if there is no such file.
  // Throws an error if retrieval fails.
  getFile(filename: string): File {
    throw new Error("XXX");
  }

  getJSON(name: string): object {
    throw new Error("XXX");
  }

  setFile(name: string, file: File) {
    throw new Error("XXX");
  }

  setJSON(name: string, data: object) {
    throw new Error("XXX");
  }
}
