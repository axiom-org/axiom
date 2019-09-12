import Database from "./Database";
import Node from "./Node";
import Peer from "./Peer";
import SignedMessage from "./SignedMessage";

// A single Channel can support multiple databases.
export default class Channel {
  name: string;
  node: Node;

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
  }

  async handleSignedMessage(peer: Peer, sm: SignedMessage) {
    let db = this.databases[sm.message.database];
    if (!db) {
      return;
    }
    return await db.handleSignedMessage(peer, sm);
  }

  database(name: string): Database {
    if (!this.databases[name]) {
      this.databases[name] = new Database(
        name,
        this.name,
        this.node,
        this.prefix
      );
    }
    return this.databases[name];
  }
}
