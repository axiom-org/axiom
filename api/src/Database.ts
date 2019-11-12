import PouchDB from "pouchdb";
import PouchDBFind from "pouchdb-find";
PouchDB.plugin(PouchDBFind);

import AxiomObject from "./AxiomObject";
import Channel from "./Channel";
import KeyPair from "./KeyPair";
import Message from "./Message";
import Node from "./Node";
import Peer from "./Peer";
import SignedMessage from "./SignedMessage";

let CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";
let NAME_REGEX = RegExp("^[a-z0-9]+$");
function randomName(): string {
  let name = "";
  for (let i = 0; i < 10; i++) {
    name += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return name;
}

interface Query {
  selector: object;
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
  filterer: (obj: AxiomObject) => boolean;

  callbacks: DatabaseCallback[];

  // How many Dataset messages this database has received.
  // Useful as a heuristic to guess whether we are done loading, for the UI.
  datasets: number;

  // A list of callbacks for when we are done with the initial load.
  // Null if we already loaded.
  onLoad: (() => void)[] | null;

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
    this.filterer = null;
    this.datasets = 0;
    this.onLoad = [];

    this.load();
  }

  log(...args: any[]) {
    this.node.log(...args);
  }

  // Sets a filter to be applied to new objects.
  // A filter returns true for objects that are to be kept.
  setFilter(filterer: (obj: AxiomObject) => boolean): void {
    this.filterer = filterer;
  }

  // Applies a filter to objects already in the database.
  // Returns when we are done filtering.
  async applyFilter(filterer: (obj: AxiomObject) => boolean): Promise<void> {
    let objects = await this.find({ selector: {} });
    let forgettable = objects.filter(x => !filterer(x));
    await Promise.all(forgettable.map(obj => obj.forget()));
  }

  // Applies a filter to both objects already in the database, and new objects.
  async useFilter(filterer: (obj: AxiomObject) => boolean): Promise<void> {
    this.setFilter(filterer);
    await this.applyFilter(filterer);
  }

  async statusLine(): Promise<string> {
    let info = await this.db.info();
    return (
      `${this.name} db has ${info.doc_count} docs. ` +
      `seq = ${info.update_seq}`
    );
  }

  async allSignedMessages(): Promise<SignedMessage[]> {
    let answer = [];
    let result = await this.db.allDocs({ include_docs: true });
    for (let row of result.rows) {
      try {
        let sm = this.documentToSignedMessage(row.doc);
        answer.push(sm);
      } catch (e) {
        // There's something invalid in the database.
        console.error("invalid database document:", row.doc);
        console.error(e);
      }
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

    if (this.filterer) {
      try {
        let obj = this.signedMessageToObject(sm);
        if (!this.filterer(obj)) {
          return;
        }
      } catch (e) {
        // A malformed db write message
        return;
      }
    }

    let newDocument = this.signedMessageToDocument(sm);
    let oldDocument = await this.getDocument(sm.signer, sm.message.name);

    if (oldDocument) {
      let oldMessage = this.documentToSignedMessage(oldDocument);
      if (oldMessage && sm.message.timestamp <= oldMessage.message.timestamp) {
        return;
      }
      newDocument._rev = oldDocument._rev;
    }

    try {
      await this.db.put(newDocument);
    } catch (e) {
      if (e.status === 409) {
        // Another write to this same object beat us to it.
        // Just try again.
        return await this.handleDatabaseWrite(sm);
      }
      throw e;
    }

    for (let callback of this.callbacks) {
      callback(sm);
    }

    if (this.node) {
      this.node.forwardToChannel(sm.message.channel, sm);
    }
  }

  async handleDataset(sm: SignedMessage): Promise<void> {
    for (let serialized of sm.message.messages) {
      let nested;
      try {
        nested = SignedMessage.fromSerialized(serialized, true);
      } catch (e) {
        console.log("bad dataset:", e);
        return;
      }
      if (
        nested.message.channel != this.channel.name ||
        nested.message.database != this.name
      ) {
        console.log("inconsistent dataset");
        return;
      }
      switch (nested.message.type) {
        case "Create":
        case "Update":
        case "Delete":
          await this.handleDatabaseWrite(nested);
          break;
        default:
          console.log("weird dataset message type:", nested.message.type);
          return;
      }
    }
    this.datasets++;
    if (this.onLoad && this.datasets >= 2) {
      this.log(`${this.name} db loaded`);
      let copy = this.onLoad;
      this.onLoad = null;
      for (let callback of copy) {
        callback();
      }
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
      case "Dataset":
        return await this.handleDataset(sm);
      default:
        throw new Error(
          `Database cannot handleSignedMessage of type ${sm.message.type}`
        );
    }
  }

  // Convert a SignedMessage to a form storable in PouchDB.
  // Of the top-level fields, most of them are the user-generated data.
  // There is also _id, which is the object id, aka
  // "owner:objectName".
  // There is also metadata, which we reserve the right to add junk to in the future.
  // TODO: Throw an error if the message is invalid
  signedMessageToDocument(sm: SignedMessage): any {
    if (sm.message.type !== "Delete" && !sm.message.data) {
      throw new Error(
        `cannot store ${sm.message.type} with missing data field`
      );
    }
    if (!NAME_REGEX.test(sm.message.name)) {
      throw new Error(`bad name: ${sm.message.name}`);
    }
    let doc = {
      ...sm.message.data,
      _id: `${sm.signer}:${sm.message.name}`,
      metadata: {
        timestamp: sm.message.timestamp,
        type: sm.message.type,
        signature: sm.signature
      }
    };

    // Check the signature verifies, so we don't get bad data stuck in our database
    try {
      this.documentToSignedMessage(doc);
    } catch (e) {
      throw new Error(`failure formatting SignedMessage for storage: ${e}`);
    }

    return doc;
  }

  // Convert a SignedMessage to an AxiomObject
  signedMessageToObject(sm: SignedMessage): AxiomObject {
    if (!sm.message.data) {
      throw new Error("cannot create AxiomObject with missing data field");
    }
    if (this.name !== sm.message.database) {
      throw new Error("database mismatch");
    }
    if (this.channel.name !== sm.message.channel) {
      throw new Error("channel mismatch");
    }
    let metadata = {
      database: this,
      timestamp: new Date(sm.message.timestamp),
      name: sm.message.name,
      owner: sm.signer
    };

    return new AxiomObject(metadata, sm.message.data);
  }

  // Convert a PouchDB document to a SignedMessage
  // Throws an error if the signature does not match
  documentToSignedMessage(doc: any): SignedMessage {
    let parts = doc._id.split(":");
    if (parts.length != 2) {
      throw new Error(`bad pouch _id: ${doc._id}`);
    }
    let [signer, name] = parts;

    let messageContent: any = {
      channel: this.channel.name,
      database: this.name,
      timestamp: doc.metadata.timestamp,
      name
    };
    if (doc.metadata.type !== "Delete") {
      messageContent.data = {};
      for (let key in doc) {
        if (!key.startsWith("_") && key !== "metadata") {
          messageContent.data[key] = doc[key];
        }
      }
    }
    let message = new Message(doc.metadata.type, messageContent);

    let sm = new SignedMessage({
      message,
      messageString: message.serialize(),
      signer,
      signature: doc.metadata.signature,
      verified: false
    });
    sm.verify();
    return sm;
  }

  // Convert a PouchDB document to an AxiomObject
  documentToObject(doc: any): AxiomObject {
    let parts = doc._id.split(":");
    if (parts.length != 2) {
      throw new Error(`bad pouch _id: ${doc._id}`);
    }
    let [owner, name] = parts;

    let metadata = {
      database: this,
      timestamp: new Date(doc.metadata.timestamp),
      name,
      owner
    };
    if (doc.metadata.type == "Delete") {
      throw new Error("cannot convert a Delete to an AxiomObject");
    }
    let data: any = {};
    for (let key in doc) {
      if (!key.startsWith("_") && key !== "metadata") {
        data[key] = doc[key];
      }
    }
    return new AxiomObject(metadata, data);
  }

  // If we have data, send back a Dataset containing a lot of other messages
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
      new Message("Dataset", {
        channel: this.channel.name,
        database: this.name,
        messages
      })
    );
  }

  // Assigns a random name to the object if none is provided.
  // Returns the newly-created AxiomObject.
  async create(data: any, name?: string): Promise<AxiomObject> {
    if (data.metadata) {
      throw new Error("You can't have a field in data named metadata.");
    }
    let kp = await this.channel.getKeyPair();
    if (!kp) {
      throw new Error("You must register a keypair to create an object.");
    }
    name = name || randomName();
    let message = new Message("Create", {
      channel: this.channel.name,
      database: this.name,
      timestamp: new Date().toISOString(),
      name,
      data
    });
    let sm = SignedMessage.fromSigning(message, kp);
    await this.handleDatabaseWrite(sm);
    return this.signedMessageToObject(sm);
  }

  async update(name: string, data: any) {
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
      name: name,
      data
    });
    let sm = SignedMessage.fromSigning(message, kp);
    await this.handleDatabaseWrite(sm);
  }

  // Returns a pouch document, or null if there is none.
  // Throws on unrecoverable errors.
  async getDocument(owner: string, name: string): Promise<any> {
    let objectKey = `${owner}:${name}`;
    let oldDocument;
    try {
      oldDocument = await this.db.get(objectKey);
    } catch (e) {
      if (e.name !== "not_found") {
        throw e;
      }
    }
    return oldDocument || null;
  }

  // Removes an object from the local database, but doesn't try to delete it across the
  // network.
  // Future updates to this object will arrive in our database again, so this method alone
  // won't prevent an object from arriving in our database.
  async forget(owner: string, name: string) {
    let doc = await this.getDocument(owner, name);
    if (!doc) {
      return;
    }
    let objectKey = `${owner}:${name}`;
    await this.db.remove(objectKey, doc._rev);
  }

  // Forgets the entire contents of this database.
  async clear(): Promise<void> {
    let objects = await this.find({ selector: {} });
    for (let obj of objects) {
      await obj.forget();
    }
  }

  async delete(name: string) {
    let kp = await this.channel.getKeyPair();
    if (!kp) {
      throw new Error("You must register a keypair to delete an object.");
    }
    let message = new Message("Delete", {
      channel: this.channel.name,
      database: this.name,
      timestamp: new Date().toISOString(),
      name: name
    });
    let sm = SignedMessage.fromSigning(message, kp);
    await this.handleDatabaseWrite(sm);
  }

  async createIndex(blob: any) {
    await this.db.createIndex(blob);
  }

  // Returns a list of AxiomObject
  async find(query: Query): Promise<AxiomObject[]> {
    let response = await this.db.find(query);
    let answer = [];
    for (let doc of response.docs) {
      if (doc.metadata.type === "Delete") {
        continue;
      }
      answer.push(this.documentToObject(doc));
    }
    return answer;
  }

  // TODO: let this use queries somehow
  load() {
    this.log(`loading ${this.name} db`);
    let message = new Message("Query", {
      channel: this.channel.name,
      database: this.name
    });
    if (this.node) {
      this.node.sendToChannel(this.channel.name, message);
    }
  }

  async waitForLoad(): Promise<void> {
    if (!this.onLoad) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.onLoad.push(resolve);
    });
  }
}
