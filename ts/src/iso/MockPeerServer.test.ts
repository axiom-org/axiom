import KeyPair from "./KeyPair";
import MockPeerServer from "./MockPeerServer";
import Node from "./Node";
import { useMockNetworking, useRealNetworking } from "./TestUtil";

beforeEach(() => {
  useMockNetworking();
});

afterEach(() => {
  useRealNetworking();
});

test("MockPeerServer basics", async () => {
  let node1 = new Node(KeyPair.fromRandom(), [], false);
  let server1 = new MockPeerServer(node1);

  // TODO: spin up a whole network
});
