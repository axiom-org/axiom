import ChainClient from "../iso/ChainClient";
import { sleep } from "../iso/Util";

// The ProviderListener continuously tracks information relevant to a single provider.
// This is designed to be the source of information for a hosting server.
export default class ProviderListener {
  client: ChainClient;
  bucketsCallback: (buckets: string[]) => any;
  verbose: boolean;

  constructor(network: string, verbose: boolean) {
    this.client = new ChainClient(null, network);
    this.client.verbose = verbose;
    this.verbose = verbose;
    this.bucketsCallback = null;
  }

  log(...args) {
    if (this.verbose) {
      console.log(...args);
    }
  }

  // Takes an async callback
  onBuckets(f) {
    this.bucketsCallback = f;
  }

  async handleBuckets(buckets) {
    if (this.bucketsCallback) {
      await this.bucketsCallback(buckets);
    }
  }

  // Listens forever
  async listen(id) {
    if (!id || id < 1) {
      throw new Error("cannot listen to invalid provider id: " + id);
    }

    // buckets maps bucket name to information about the bucket
    let buckets = {};

    while (true) {
      console.log("XXX 1");
      let bucketList = await this.client.getBuckets({ provider: id });
      console.log("XXX 2");
      await this.handleBuckets(bucketList);
      console.log("XXX 3");
      await sleep(2000);
      console.log("XXX 4");
    }
  }
}
