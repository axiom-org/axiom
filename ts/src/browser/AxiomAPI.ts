// AxiomAPI is the public-facing API that developers will use.
// This is the entry point for the axiom-api npm module.

import Bucket from "./Bucket";
import ChainClient from "../iso/ChainClient";
import TorrentClient from "../iso/TorrentClient";
import UntrustedClient from "./UntrustedClient";

import { makeBucketName } from "../iso/Util";

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

  _makeBucket(data): Bucket {
    return new Bucket(
      this.network,
      data.name,
      data.owner,
      data.size,
      data.magnet,
      this.torrentClient,
      this.untrustedClient
    );
  }

  // Asks the user for permission to share their public key.
  // Throws an error if the user denies permission.
  async getPublicKey() {
    return this.untrustedClient.getPublicKey();
  }

  // Fetches the account with the given user, or null if there is no such account.
  async getAccount(user): Promise<any> {
    return await this.chainClient.getAccount(user);
  }

  // Returns null if there is no such bucket.
  async getBucket(application: string, name: string): Promise<Bucket> {
    let fullName = makeBucketName(application + ":" + name);
    let data = await this.chainClient.getBucket(fullName);
    if (!data) {
      return null;
    }
    return this._makeBucket(data);
  }

  // Throws an error if permission is rejected, or if the bucket creation fails.
  async createBucket(
    application: string,
    name: string,
    size: number
  ): Promise<Bucket> {
    if (!size || size < 0) {
      throw new Error(`cannot create a bucket of size ${size}`);
    }
    let data = await this.untrustedClient.createBucket(application, name, size);
    return this._makeBucket(data);
  }
}
