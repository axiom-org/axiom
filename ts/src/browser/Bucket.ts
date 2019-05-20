import Torrent from "../iso/Torrent";
import TorrentClient from "../iso/TorrentClient";
import UntrustedClient from "./UntrustedClient";

async function readAsText(file: File, encoding?: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    file.getBlob((err, blob) => {
      if (err) {
        reject(err);
      }
      let reader = new FileReader();
      reader.onload = e => {
        resolve((e.target as any).result);
      };
      reader.readAsText(blob, encoding);
    });
  });
}

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

  // Throws an error if we haven't downloaded this bucket.
  getFilenames(): string[] {
    if (!this.isDownloaded()) {
      throw new Error("cannot call getFile before the bucket is downloaded");
    }
    let answer = [];
    for (let fname in this.files) {
      answer.push(fname);
    }
    return answer;
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
  // This has to be async because the browser file-reading APIs are async.
  // Encoding defaults to utf8.
  async getText(filename: string, encoding?: string): string {
    let file = this.getFile(filename);
    if (!file) {
      return file;
    }

    return await readAsText(file, encoding);
  }

  // Returns undefined if there is no such file.
  // Throws an error if we haven't downloaded this bucket.
  // This has to be async because the browser file-reading APIs are async.
  async getJSON(filename: string): any {
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
