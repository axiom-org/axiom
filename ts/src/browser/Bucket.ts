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
  }

  async download() {
    if (!this.magnet || this.magnet === "") {
      throw new Error("cannot download without magnet");
    }
    this.torrent = this.torrentClient.download(this.magnet);
    await this.torrent.waitForDone();
  }

  async upload() {
    throw new Error("XXX");
  }

  isDownloaded(): boolean {
    return this.torrent && this.torrent.isDone();
  }

  getFile(name: string): File {
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
