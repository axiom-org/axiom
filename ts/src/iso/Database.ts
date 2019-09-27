import PouchDB from "pouchdb";

import Channel from "./Channel";
import KeyPair from "./KeyPair";
import Message from "./Message";
import Node from "./Node";
import Peer from "./Peer";
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
  // If this is set, new PouchDB databases will use this adapter.
  static adapter: any = null;

  channel: Channel;
  name: string;
  node: Node;
  keyPair: KeyPair;
  db: any;

  callbacks: DatabaseCallback[];

  constructor(name: string, channel: Channel, node?: Node, prefix?: string) {
    this.name = name;
    this.channel = channel;
    prefix = prefix || "";
    this.db = new PouchDB(prefix + name, {
      auto_compaction: true,
      adapter: Database.adapter
    });
    if (node) {
      this.node = node;
      this.keyPair = node.keyPair;
    } else {
      this.keyPair = KeyPair.fromRandom();
    }
    this.callbacks = [];

    this.load();
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

  // Create/Update/Delete ops
  // If this message updates our database, it is forwarded on.
  async handleDatabaseWrite(sm: SignedMessage): Promise<void> {
    if (!sm.message.timestamp) {
      return;
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
        return;
      }
      newDocument._rev = oldDocument._rev;
    }

    await this.db.put(newDocument);

    for (let callback of this.callbacks) {
      callback(sm);
    }

    if (this.node) {
      this.node.forwardToChannel(sm.message.channel, sm);
    }
  }

  // TODO: handle malicious messages differently
  async handleSignedMessage(peer: Peer, sm: SignedMessage): Promise<void> {
    switch (sm.message.type) {
      case "Create":
      case "Update":
      case "Delete":
        return await this.handleDatabaseWrite(sm);
      case "Query":
        return await this.handleQuery(peer, sm.message);
      default:
        throw new Error(
          `Database cannot handleSignedMessage of type ${sm.message.type}`
        );
    }
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
        database: sm.message.database,
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
      database: obj.metadata.database,
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

  // If we have data, send back a Forward containing a lot of other messages
  async handleQuery(peer: Peer, m: Message) {
    let messages = [];
    let sms = await this.allSignedMessages();
    for (let sm of sms) {
      messages.push(sm.serialize());
    }
    if (messages.length === 0) {
      return;
    }
    peer.sendMessage(
      new Message("Forward", {
        messages
      })
    );
  }

  // Assigns a random id to the object
  // Returns the random id, once it has been checked with the local database.
  async create(data: any) {
    if (data.metadata) {
      throw new Error("You can't have a field in data named metadata.");
    }
    let kp = await this.channel.getKeyPair();
    if (!kp) {
      throw new Error("You must register a keypair to create an object.");
    }
    let id = randomID();
    let message = new Message("Create", {
      channel: this.channel.name,
      database: this.name,
      timestamp: new Date().toISOString(),
      id,
      data
    });
    let sm = SignedMessage.fromSigning(message, kp);
    await this.handleDatabaseWrite(sm);
    return id;
  }

  async update(id: string, data: any) {
    if (data.metadata) {
      throw new Error("You can't have a field in data named metadata.");
    }
    let kp = await this.channel.getKeyPair();
    if (!kp) {
      throw new Error("You must register a keypair to update an object.");
    }
    let message = new Message("Update", {
      channel: this.channel.name,
      database: this.name,
      timestamp: new Date().toISOString(),
      id: id,
      data
    });
    let sm = SignedMessage.fromSigning(message, kp);
    await this.handleDatabaseWrite(sm);
  }

  load() {
    let message = new Message("Query", {
      channel: this.channel.name,
      database: this.name
    });
    if (this.node) {
      this.node.sendToChannel(this.channel.name, message);
    }
  }
}
