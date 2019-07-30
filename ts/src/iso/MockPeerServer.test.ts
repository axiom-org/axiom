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

  // TODO: investigate what is going wrong here
  for (let i = 0; i < 4; i++) {
    console.log(`Node ${i}:`);
    servers[i].node.show();
  }
});
