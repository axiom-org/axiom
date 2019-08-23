import Node from "./Node";
import SignedMessage from "./SignedMessage";

// A Database represents a set of data that is being synced by a node in the Axiom
// peer-to-peer network.
export default class Database {
  node: Node;

  constructor(node: Node) {
    this.node = node;
  }

  // Returns true if this message updated our database, and the message should be
  // forwarded on.
  // Returns false if this was an old message.
  // TODO: handle malicious messages
  handleSignedMessage(sm: SignedMessage): boolean {
    // XXX
    return false;
  }
}
