// AxiomAPI is the public-facing API that developers will use.
// This is the entry point for the axiom-api npm module.

import AxiomObject from "./AxiomObject";
import Channel from "./Channel";
import Database from "./Database";
import KeyPair from "./KeyPair";
import NetworkConfig from "./NetworkConfig";
import Node from "./Node";
import Peer from "./Peer";
import Sequence from "./Sequence";
import SignedMessage from "./SignedMessage";

export {
  AxiomObject,
  Channel,
  Database,
  KeyPair,
  Node,
  Peer,
  Sequence,
  SignedMessage
};

export default class AxiomAPI {
  network: string;
  verbose: boolean;

  constructor(options?: { network?: string; verbose?: boolean }) {
    options = options || {};
    this.network = options.network || "prod";

    this.verbose = !!options.verbose;
  }

  createNode(): Node {
    return new Node({
      network: this.network,
      verbose: this.verbose
    });
  }
}
