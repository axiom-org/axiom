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
    for (let file of this.torrent.torrent.files) {
      this.files[file.name] = file;
    }
  }

  async upload() {
    throw new Error("XXX");
  }

  isDownloaded(): boolean {
    return this.files && true;
  }

  // Returns undefined if there is no such file.
  // Throws an error if we haven't downloaded this bucket.
  getFile(filename: string): File {
    if (!this.isDownloaded()) {
      throw new Error("cannot call getFile before the bucket is downloaded");
    }
    return this.files[filename];
  }

  // Returns undefined if there is no such file.
  // Throws an error if we haven't downloaded this bucket.
  getJSON(filename: string): object {
    let file = this.getFile(filename);
    if (!file) {
      return file;
    }

    throw new Error("XXX");
  }

  // Throws an error if we haven't downloaded this bucket.
  setFile(name: string, file: File) {
    if (!this.isDownloaded()) {
      throw new Error("cannot call setFile before the bucket is downloaded");
    }
    throw new Error("XXX");
  }

  // Throws an error if we haven't downloaded this bucket.
  setJSON(name: string, data: object) {
    throw new Error("XXX");
  }
}
