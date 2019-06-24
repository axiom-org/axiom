import MockSimplePeer from "./MockSimplePeer";

export default class MockSimplePeerFactory {
  numPeers: number;
  allPeers: { [id: string]: MockSimplePeer };

  constructor() {
    this.numPeers = 0;
    this.allPeers = {};
  }

  newMockSimplePeer(initiator: boolean): MockSimplePeer {
    this.numPeers++;
    let id = "p" + this.numPeers;
    let peer = new MockSimplePeer(id, initiator);
    this.allPeers[id] = peer;
    return peer;
  }
}
