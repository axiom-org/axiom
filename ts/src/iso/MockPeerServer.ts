import KeyPair from "./KeyPair";
import Node from "./Node";
import Peer from "./Peer";

// A MockPeerServer registers itself on a url starting with "mock:".
export default class MockPeerServer {
  node: Node;
  url: string;

  constructor(node: Node) {
    this.node = node;

    this.url = "mock://" + Object.keys(Peer.intercept).length + 1;
    Peer.intercept[this.url] = peer => {
      this.connectToPeer(peer);
    };
  }

  connectToPeer(existingPeer: Peer) {
    let newPeer = new Peer({ keyPair: this.node.keyPair });
    newPeer.connect(existingPeer.signals);
    existingPeer.connect(newPeer.signals);
  }
}
