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

  // TODO: test the servers make a complete graph
  // TODO: spin up a whole network
});
