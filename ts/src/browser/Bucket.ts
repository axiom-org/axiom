import UntrustedClient from "./UntrustedClient";

export default class Bucket {
  network: string;
  name: string;
  owner: string;
  size: number;
  magnet: string;
  untrustedClient: UntrustedClient;

  constructor(
    network: string,
    name: string,
    owner: string,
    size: number,
    magnet: string,
    untrustedClient: UntrustedClient
  ) {
    this.network = network;
    this.name = name;
    this.owner = owner;
    this.size = size;
    this.magnet = magnet;
    this.untrustedClient = untrustedClient;
  }

  async download() {
    throw new Error("XXX");
  }
  async upload() {
    throw new Error("XXX");
  }

  isDownloaded(): boolean {
    throw new Error("XXX");
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
