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
  let bootstrap = MockPeerServer.makeBootstrap(2);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 2; i++) {
    expect(servers[i].node.getPeers().length).toBe(1);
  }
});

test("MockPeerServer scaling", async () => {
  let bootstrap = MockPeerServer.makeBootstrap(4);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 4; i++) {
    expect(servers[i].node.getPeers().length).toBe(3);
  }

  // TODO: add n more servers
});
