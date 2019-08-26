import Message from "./Message";
import Node from "./Node";
import SignedMessage from "./SignedMessage";

let CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
function randomID(): string {
  let id = "";
  for (let i = 0; i < 10; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

// A Database represents a set of data that is being synced by a node in the Axiom
// peer-to-peer network.
export default class Database {
  channel: string;
  node: Node;

  // The key is <signer>:<id>
  objects: { [key: string]: SignedMessage };

  constructor(channel: string, node: Node) {
    this.channel = channel;
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

  // Responds to a Query with a Forward containing a lot of other messages
  handleQuery(m: Message): Message {
    let messages = [];
    for (let key in this.objects) {
      messages.push(this.objects[key].serialize());
    }
    return new Message("Forward", {
      messages
    });
  }

  // Assigns a random id to the object
  create(data: any) {
    let message = new Message("Create", {
      channel: this.channel,
      timestamp: new Date().toISOString(),
      id: randomID(),
      data
    });
    let sm = SignedMessage.fromSigning(message, node.keyPair);
    this.handleSignedMessage(sm);
    node.forwardToChannel(this.channel, sm);
  }
}
