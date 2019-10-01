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
  }
}
