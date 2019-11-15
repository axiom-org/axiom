import Database from "./Database";
import SignedMessage from "./SignedMessage";

interface Metadata {
  database: Database;
  timestamp: Date;
  name: string;
  owner: string;
}

// An AxiomObject represents arbitrary application-specific data, plus metadata that
// lets the object be transported across the p2p network and stored at nodes.
export default class AxiomObject {
  // Metadata used by the Axiom library
  database: Database;
  timestamp: Date;

  // name is unique per-user, but different users can have objects with the same name.
  name: string;

  // id is unique per-type. Different types of object and different applications can have
  // objects with the same id, but not the same Database.
  // This is used as the primary key in the database.
  id: string;

  owner: string;

  // Application-specific data
  data: any;

  constructor(metadata: Metadata, data: any) {
    this.database = metadata.database;
    this.timestamp = metadata.timestamp;
    this.name = metadata.name;
    this.owner = metadata.owner;
    this.id = `${this.owner}:${this.name}`;
    this.data = data;
  }

  async forget() {
    await this.database.forget(this.owner, this.name);
  }

  toString(): string {
    let meta = `${this.id} at ${this.timestamp}`;
    return `${meta} ${JSON.stringify(this.data, null, 2)}`;
  }
}
