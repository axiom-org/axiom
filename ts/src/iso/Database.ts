import KeyPair from "./KeyPair";
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

type DatabaseCallback = (sm: SignedMessage) => void;

// A Database represents a set of data that is being synced by a node in the Axiom
// peer-to-peer network.
export default class Database {
  channel: string;
  node: Node;
  keyPair: KeyPair;

  // The key is <signer>:<id>
  objects: { [key: string]: SignedMessage };

  callbacks: DatabaseCallback[];

  constructor(channel: string, node?: Node) {
    this.channel = channel;
    if (node) {
      this.node = node;
      this.keyPair = node.keyPair;
    } else {
      this.keyPair = KeyPair.fromRandom();
    }
    this.objects = {};
    this.callbacks = [];
  }

  // TODO: make this use queries or something smarter
  onMessage(callback: DatabaseCallback) {
    for (let key in this.objects) {
      let sm = this.objects[key];
      callback(sm);
    }
    this.callbacks.push(callback);
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
    if (oldMessage && sm.message.timestamp <= oldMessage.message.timestamp) {
      return false;
    }

    this.objects[objectKey] = sm;
    for (let callback of this.callbacks) {
      callback(sm);
    }

    return true;
  }

  // Convert a SignedMessage to a form storable in PouchDB
  // TODO: Throw an error if the message is invalid
  signedMessageToPouchObject(sm: SignedMessage): any {
    let obj = {
      _id: `${sm.signer}:${sm.message.id}`,
      _timestamp: sm.message.timestamp,
      _type: sm.message.type,
      _channel: sm.message.channel,
      _signature: sm.signature
    };
    for (let key in sm.message.data) {
      obj[key] = sm.message.data[key];
    }

    // Check the signature verifies, so we don't get bad data stuck in our database
    this.pouchObjectToSignedMessage(obj);

    return obj;
  }

  // Convert a PouchDB object to a SignedMessage
  // Throws an error if the signature does not match
  pouchObjectToSignedMessage(obj: any): SignedMessage {
    let parts = obj._id.split(":");
    if (parts.length != 2) {
      throw new Error(`bad pouch _id: ${obj._id}`);
    }
    let data = {};
    for (let key in obj) {
      if (!key.startsWith("_")) {
        data[key] = obj[key];
      }
    }
    let message = new Message(obj._type, {
      channel: obj._channel,
      timestamp: obj._timestamp,
      id: parts[1],
      data
    });
    let sm = new SignedMessage({
      message,
      messageString: message.serialize(),
      signer: parts[0],
      signature: obj._signature,
      verified: false
    });
    sm.verify();
    return sm;
  }

  // Responds to a Query with a Forward containing a lot of other messages
  // Returns null if there's nothing to say
  handleQuery(m: Message): Message {
    let messages = [];
    for (let key in this.objects) {
      messages.push(this.objects[key].serialize());
    }
    if (messages.length === 0) {
      return null;
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
    let sm = SignedMessage.fromSigning(message, this.keyPair);
    this.handleSignedMessage(sm);
    this.sendToChannel(message);
  }

  sendToChannel(message: Message) {
    if (this.node) {
      this.node.sendToChannel(this.channel, message);
    }
  }

  load() {
    let message = new Message("Query", {
      channel: this.channel
    });
    this.sendToChannel(message);
  }
}
