// AxiomAPI is the public-facing API that developers will use.
// This is the entry point for the axiom-api npm module.

import AxiomObject from "../iso/AxiomObject";
import Channel from "../iso/Channel";
import Database from "../iso/Database";
import KeyPair from "../iso/KeyPair";
import NetworkConfig from "../iso/NetworkConfig";
import Node from "../iso/Node";
import SignedMessage from "../iso/SignedMessage";

export { AxiomObject, Channel, Database, KeyPair, SignedMessage };

export default class AxiomAPI {
  network: string;
  verbose: boolean;

  constructor(options?: { network?: string; verbose?: boolean }) {
    options = options || {};
    this.network = options.network || "alpha";

    this.verbose = !!options.verbose;
  }

  createNode(): Node {
    let config = new NetworkConfig(this.network);
    return new Node(null, config.bootstrap, this.verbose);
  }
}
