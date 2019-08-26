import Node from "./Node";
import SignedMessage from "./SignedMessage";

// A Database represents a set of data that is being synced by a node in the Axiom
// peer-to-peer network.
export default class Database {
  node: Node;

  // The key is <signer>:<id>
  objects: { [key: string]: SignedMessage };

  constructor(node: Node) {
    this.node = node;
    this.objects = {};
  }

  // Returns true if this message updated our database, and the message should be
  // forwarded on.
  // Returns false if this was an old or invalid message.
  // TODO: handle malicious messages differently
  handleSignedMessage(sm: SignedMessage): boolean {
    switch (sm.message.type) {
      case "Create":
      case "Update":
      case "Delete":
        break;
      default:
        throw new Error(
          `Database cannot handleSignedMessage of type ${sm.message.type}`
        );
    }

    if (!sm.message.timestamp) {
      return false;
    }

    let objectKey = `${sm.signer}:${sm.message.id}`;
    let oldMessage = this.objects[objectKey];
    if (sm.message.timestamp <= oldMessage.message.timestamp) {
      return false;
    }

    this.objects[objectKey] = sm;
    return true;
  }
}
