import KeyPair from "./KeyPair";
import Node from "./Node";
import Peer from "./Peer";

// A MockPeerServer registers itself on a url starting with "mock:".
export default class MockPeerServer {
  node: Node;
  url: string;

  static makeURL(index: number): string {
    return `mock://${index}`;
  }

  static makeBootstrap(n: number): string[] {
    let answer = [];
    for (let i = 0; i < n; i++) {
      answer.push(MockPeerServer.makeURL(i));
    }
    return answer;
  }

  static makeServers(bootstrap: string[]): MockPeerServer[] {
    let answer = [];
    for (let i = 0; i < bootstrap.length; i++) {
      let node = new Node({ bootstrap });
      answer.push(new MockPeerServer(node));
    }
    return answer;
  }

  constructor(node: Node) {
    this.node = node;

    this.url = MockPeerServer.makeURL(Object.keys(Peer.intercept).length);
    Peer.intercept[this.url] = peer => {
      this.connectToPeer(peer);
    };
  }

  connectToPeer(existingPeer: Peer) {
    let newPeer = new Peer({ keyPair: this.node.keyPair });
    newPeer.connect(existingPeer.signals);
    existingPeer.connect(newPeer.signals);
    this.node.addPeer(newPeer);
  }

  destroy() {
    this.node.destroy();
  }
}
