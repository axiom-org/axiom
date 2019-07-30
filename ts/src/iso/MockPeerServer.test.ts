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
  let bootstrap = MockPeerServer.makeBootstrap(4);
  let servers = MockPeerServer.makeServers(bootstrap);

  // The servers should form a complete graph
  expect(servers[0].node.numPeers()).toBe(3);
  expect(servers[1].node.numPeers()).toBe(3);
  expect(servers[2].node.numPeers()).toBe(3);
  expect(servers[3].node.numPeers()).toBe(3);

  // TODO: spin up a whole network
});
