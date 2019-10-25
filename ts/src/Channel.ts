import Database from "./Database";
import KeyPair from "./KeyPair";
import Message from "./Message";
import Node from "./Node";
import Peer from "./Peer";
import SignedMessage from "./SignedMessage";

// A single Channel can support multiple databases.
export default class Channel {
  name: string;
  node: Node;

  // This is the "data keypair".
  // If we are not logged in, this keypair is null.
  // TODO: document the "networking keypair" more clearly
  keyPair: KeyPair | null;

  databases: { [name: string]: Database };

  // Pass this prefix to our databases so they don't overlap with other channels
  prefix: string;

  constructor(name: string, node: Node, prefix?: string) {
    this.name = name;
    this.node = node;
    if (prefix) {
      this.prefix = prefix;
    } else {
      this.prefix = name + "_";
    }
    this.databases = {};
    this.keyPair = null;
  }

  async handleSignedMessage(peer: Peer, sm: SignedMessage) {
    let db = this.databases[sm.message.database];
    if (!db) {
      return;
    }
    return await db.handleSignedMessage(peer, sm);
  }

  // This function is called when we see a new peer in our channel
  async handleNewPeer(peer: Peer) {
    for (let dbname in this.databases) {
      let message = new Message("Query", {
        channel: this.name,
        database: dbname
      });
      peer.sendMessage(message);
    }
  }

  // Returns undefined if we are not logged in
  async getKeyPair(): Promise<KeyPair | null> {
    return this.keyPair;
  }

  setKeyPair(kp: KeyPair | null) {
    this.keyPair = kp;
  }

  database(name: string): Database {
    if (!this.databases[name]) {
      this.databases[name] = new Database(name, this, this.node, this.prefix);
    }
    return this.databases[name];
  }
}
