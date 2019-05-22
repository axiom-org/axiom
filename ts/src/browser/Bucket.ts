import Torrent from "../iso/Torrent";
import TorrentClient from "../iso/TorrentClient";
import UntrustedClient from "./UntrustedClient";

// Converts a file from WebTorrent file object to browser File object
async function convertFile(file: any, encoding?: string): Promise<File> {
  return await new Promise((resolve, reject) => {
    file.getBlob((err, blob) => {
      if (err) {
        reject(err);
      }
      resolve(new File([blob], file.name));
    });
  });
}

async function readAsText(file: File, encoding?: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = e => {
      resolve((e.target as any).result);
    };
    reader.readAsText(file, encoding);
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
  torrent?: Torrent;
  torrentFiles?: { [path: string]: any };
  files: { [path: string]: File };
  downloadPending: boolean;

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

    this.torrentFiles = null;

    // this.files is lazily instantiated from this.torrentFiles
    // If it does have an entry, however, that entry takes priority
    // over the torrentFiles entry.
    // This means we can set files locally while we are still waiting
    // for a bucket download
    this.files = {};

    // A bucket that is instantiated with a valid magnet is considered
    // to have its download pending.
    // A bucket that has no magnet, there's nothing to download.
    // Buckets only download once at most, so once the download is no
    // longer pending, it never will be.
    // If you need to refresh bucket data, make a new Bucket object.
    this.downloadPending = this.hasValidMagnet();
  }

  hasValidMagnet(): boolean {
    return this.magnet && this.magnet !== "";
  }

  // Downloads the entire contents of a bucket.
  // If a download is not needed this is a no-op, so it's safe to just
  // await this.download() at the start of data access functions.
  // For now this is the only way to get bucket contents, but for
  // efficiency this API could be extended to only download some of
  // the bucket.
  async download() {
    if (!this.downloadPending) {
      return;
    }
    this.torrent = this.torrentClient.download(this.magnet);
    await this.torrent.waitForDone();

    // We don't need to index the files twice if this is racey
    if (!this.downloadPending) {
      return;
    }
    this.torrentFiles = {};
    for (let file of this.torrent.torrent.files) {
      this.torrentFiles[file.path] = file;
    }
    this.downloadPending = false;
  }

  async upload() {
    // Get permission first so that the UI is snappy
    await this.untrustedClient.requestUpdateBucketPermission(this.name);

    // Finish any downloading before making a new torrent
    await this.download();

    // Get a list of all our files.
    // This also makes sure all data is cached in this.files, so we can drop torrentFiles
    let fileList: File[] = [];
    let paths = await this.getPaths();
    for (let p of paths) {
      fileList.push(await this.getFile(p));
    }

    // Stop using the old download-centric torrent
    if (this.torrent) {
      this.torrent.destroy();
      this.torrent = null;
    }
    this.torrentFiles = null;

    // Start a new torrent
    this.torrent = await this.torrentClient.seed(fileList, this.name);

    // Update the magnet on the blockchain
    await this.untrustedClient.updateBucket(this.name, this.torrent.magnet);

    // Wait for a hosting provider to seed
    await this.torrent.waitForSeeds(1);
  }

  async getPaths(): Promise<string[]> {
    await this.download();
    let answer = [];
    for (let fname in this.files) {
      answer.push(fname);
    }
    if (this.torrentFiles) {
      for (let fname in this.torrentFiles) {
        if (!(fname in this.files)) {
          answer.push(fname);
        }
      }
    }
    answer.sort();
    return answer;
  }

  // Returns null if there is no such file.
  async getFile(path: string): Promise<File> {
    await this.download();
    if (path in this.files) {
      return this.files[path];
    }
    if (this.torrentFiles && path in this.torrentFiles) {
      this.files[path] = await convertFile(this.torrentFiles[path]);
      return this.files[path];
    }
    return null;
  }

  // Returns null if there is no such file.
  async getText(path: string, encoding?: string): Promise<string> {
    let file = await this.getFile(path);
    if (!file) {
      return null;
    }

    return await readAsText(file, encoding);
  }

  // Returns null if there is no such file.
  // Throws an error if we haven't downloaded this bucket.
  // This has to be async because the browser file-reading APIs are async.
  async getJSON(path: string): Promise<any> {
    let text = await this.getText(path);
    return JSON.parse(text);
  }

  setFile(path: string, file: File) {
    this.files[path] = file;
  }

  // Only supports utf-8
  setText(path: string, text: string) {
    let file = new File([text], path);
    this.setFile(path, file);
  }

  setJSON(path: string, data: any) {
    let text = JSON.stringify(data);
    this.setText(path, text);
  }
}
