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
}
