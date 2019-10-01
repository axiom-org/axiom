import SignedMessage from "./SignedMessage";

interface Metadata {
  channel: string;
  database: string;
  timestamp: Date;
  id: string;
  owner: string;
}

// An AxiomObject represents arbitrary application-specific data, plus metadata that
// lets the object be transported across the p2p network and stored at nodes.
export default class AxiomObject {
  // Metadata used by the Axiom library
  channel: string;
  database: string;
  timestamp: Date;
  id: string;
  owner: string;

  // Application-specific data
  data: any;

  constructor(metadata: Metadata, data: any) {
    this.channel = metadata.channel;
    this.database = metadata.database;
    this.timestamp = metadata.timestamp;
    this.id = metadata.id;
    this.owner = metadata.owner;
    this.data = data;
  }

  static fromSignedMessage(sm: SignedMessage): AxiomObject {
    if (!sm.message.data) {
      throw new Error("cannot create AxiomObject with missing data field");
    }
    let metadata: Metadata = {
      channel: sm.message.channel,
      database: sm.message.database,
      timestamp: new Date(sm.message.timestamp),
      id: sm.message.id,
      owner: sm.signer
    };

    return new AxiomObject(metadata, sm.message.data);
  }

  static fromDocument(obj: any): AxiomObject {
    let parts = obj._id.split(":");
    if (parts.length != 2) {
      throw new Error(`bad pouch _id: ${obj._id}`);
    }
    let [owner, id] = parts;

    let metadata: Metadata = {
      channel: obj.metadata.channel,
      database: obj.metadata.database,
      timestamp: obj.metadata.timestamp,
      id,
      owner
    };
    if (obj.metadata.type == "Delete") {
      throw new Error("cannot convert a Delete to an AxiomObject");
    }
    let data = {};
    for (let key in obj) {
      if (!key.startsWith("_") && key !== "metadata") {
        data[key] = obj[key];
      }
    }
    return new AxiomObject(metadata, data);
  }
}
