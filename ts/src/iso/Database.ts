import KeyPair from "./KeyPair";
import Message from "./Message";
import Node from "./Node";
import * as PouchDB from "pouchdb";
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
  db: any;

  callbacks: DatabaseCallback[];

  constructor(channel: string, node?: Node) {
    this.channel = channel;
    this.db = new PouchDB(channel, { auto_compaction: true });
    if (node) {
      this.node = node;
      this.keyPair = node.keyPair;
    } else {
      this.keyPair = KeyPair.fromRandom();
    }
    this.callbacks = [];
  }

  async allSignedMessages(): Promise<SignedMessage[]> {
    let answer = [];
    let result = await this.db.allDocs({ include_docs: true });
    for (let row of result.rows) {
      let sm = this.documentToSignedMessage(row.doc);
      answer.push(sm);
    }
    return answer;
  }

  // You don't have to await this.
  // TODO: make this use queries or something smarter
  async onMessage(callback: DatabaseCallback) {
    let sms = await this.allSignedMessages();
    for (let sm of sms) {
      callback(sm);
    }
    this.callbacks.push(callback);
  }

  // Returns true if this message updated our database, and the message should be
  // forwarded on.
  // Returns false if this was an old or invalid message.
  // TODO: handle malicious messages differently
  async handleSignedMessage(sm: SignedMessage): Promise<boolean> {
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

    let newDocument = this.signedMessageToDocument(sm);
    let objectKey = `${sm.signer}:${sm.message.id}`;
    let oldDocument;

    try {
      oldDocument = await this.db.get(objectKey);
    } catch (e) {
      if (e.name !== "not_found") {
        throw e;
      }
    }
    if (oldDocument) {
      let oldMessage = this.documentToSignedMessage(oldDocument);
      if (oldMessage && sm.message.timestamp <= oldMessage.message.timestamp) {
        return false;
      }
      newDocument._rev = oldDocument._rev;
    }

    await this.db.put(newDocument);

    for (let callback of this.callbacks) {
      callback(sm);
    }

    return true;
  }

  // Convert a SignedMessage to a form storable in PouchDB
  // TODO: Throw an error if the message is invalid
  signedMessageToDocument(sm: SignedMessage): any {
    let obj = {
      ...sm.message.data,
      _id: `${sm.signer}:${sm.message.id}`,
      metadata: {
        timestamp: sm.message.timestamp,
        type: sm.message.type,
        channel: sm.message.channel,
        signature: sm.signature
      }
    };

    // Check the signature verifies, so we don't get bad data stuck in our database
    this.documentToSignedMessage(obj);

    return obj;
  }

  // Convert a PouchDB object to a SignedMessage
  // Throws an error if the signature does not match
  documentToSignedMessage(obj: any): SignedMessage {
    let parts = obj._id.split(":");
    if (parts.length != 2) {
      throw new Error(`bad pouch _id: ${obj._id}`);
    }
    let [signer, id] = parts;

    let messageContent: any = {
      channel: obj.metadata.channel,
      timestamp: obj.metadata.timestamp,
      id
    };
    if (obj.metadata.type !== "Delete") {
      messageContent.data = {};
      for (let key in obj) {
        if (!key.startsWith("_")) {
          messageContent.data[key] = obj[key];
        }
      }
      delete messageContent.data._id;
      delete messageContent.data.metadata;
    }
    let message = new Message(obj.metadata.type, messageContent);

    let sm = new SignedMessage({
      message,
      messageString: message.serialize(),
      signer,
      signature: obj.metadata.signature,
      verified: false
    });
    sm.verify();
    return sm;
  }

  // Responds to a Query with a Forward containing a lot of other messages
  // Returns null if there's nothing to say
  async handleQuery(m: Message): Promise<Message> {
    let messages = [];
    let sms = await this.allSignedMessages();
    for (let sm of sms) {
      messages.push(sm.serialize());
    }
    if (messages.length === 0) {
      return null;
    }
    return new Message("Forward", {
      messages
    });
  }

  // Assigns a random id to the object
  // Returns once it has been checked with the local database.
  async create(data: any) {
    if (data.metadata) {
      throw new Error("You can't have a field in data named metadata.");
    }
    let message = new Message("Create", {
      channel: this.channel,
      timestamp: new Date().toISOString(),
      id: randomID(),
      data
    });
    let sm = SignedMessage.fromSigning(message, this.keyPair);
    await this.handleSignedMessage(sm);
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
