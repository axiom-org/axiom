import { useMockIntervalTimer, useRealIntervalTimer } from "./IntervalTimer";
import MockPeerServer from "./MockPeerServer";
import Node from "./Node";
import { useTestEnvironment, useNormalEnvironment } from "./TestUtil";

beforeEach(useTestEnvironment);
afterEach(useNormalEnvironment);

test("MockPeerServer basics", async () => {
  let bootstrap = MockPeerServer.makeBootstrap(2);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 2; i++) {
    expect(servers[i].node.getPeers().length).toBe(1);
  }
});
