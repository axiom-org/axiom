// AxiomAPI is the public-facing API that developers will use.
// This is the entry point for the axiom-api npm module.

import Bucket from "./Bucket";
import ChainClient from "../iso/ChainClient";
import TorrentClient from "../iso/TorrentClient";
import UntrustedClient from "./UntrustedClient";

export default class AxiomAPI {
  network: string;
  chainClient: ChainClient;
  torrentClient: TorrentClient;
  untrustedClient: UntrustedClient;

  constructor(options?: { network?: string }) {
    options = options || {};
    this.network = options.network || "alpha";

    this.torrentClient = new TorrentClient(this.network);
    this.untrustedClient = new UntrustedClient();
    this.chainClient = new ChainClient(null, this.network);
  }

  // Asks the user for permission to share their public key.
  // Throws an error if the user denies permission.
  async getPublicKey() {
    return this.untrustedClient.getPublicKey();
  }

  // Returns null if there is no such bucket.
  async getBucket(name): Promise<Bucket> {
    throw new Error("XXX");
  }

  // Throws an error if permission is rejected, or if the bucket creation fails.
  async createBucket(application, name, size): Promise<Bucket> {
    throw new Error("XXX");
  }
}
