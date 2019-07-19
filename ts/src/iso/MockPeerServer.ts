import Node from "./Node";
import Peer from "./Peer";

// A MockPeerServer registers itself on a url starting with "mock:".
export default class MockPeerServer {
  node: Node;
  constructor(node: Node) {
    this.node = node;
  }
}
