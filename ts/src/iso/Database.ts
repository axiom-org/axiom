import Node from "./Node";

// A Database represents a set of data that is being synced by a node in the Axiom
// peer-to-peer network.
export default class Database {
  node: Node;

  constructor(node: Node) {
    this.node = node;
  }
}
