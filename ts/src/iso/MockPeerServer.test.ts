import { useMockIntervalTimer, useRealIntervalTimer } from "./IntervalTimer";
import MockPeerServer from "./MockPeerServer";
import Node from "./Node";
import { useTestEnvironment, useNormalEnvironment } from "./TestUtil";
import { sleep } from "./Util";

beforeEach(useTestEnvironment);
afterEach(useNormalEnvironment);

test("Mock network construction", async () => {
  let bootstrap = MockPeerServer.makeBootstrap(2);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 2; i++) {
    expect(servers[i].node.getPeers().length).toBe(1);
  }
});

// TODO: why is this slow
test("Mock db usage", async () => {
  let bootstrap = MockPeerServer.makeBootstrap(2);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Connect a couple nodes to the network
  let node1 = new Node(null, bootstrap, false);
  node1.prefix = "node1";
  let db1 = node1.database("testdb");
  let node2 = new Node(null, bootstrap, false);
  node2.prefix = "node2";
  let db2 = node2.database("testdb");

  // Check that a write to db1 should end up in db2
  let callback = jest.fn();
  await db2.onMessage(callback);
  expect(callback.mock.calls.length).toBe(0);
  await db1.create({ name: "bob" });

  // TODO: implement autoloading so that userspace doesn't have to manually load
  db2.load();

  // TODO: implement some "wait for all Node work to complete" to avoid sleeps
  await sleep(1000);

  expect(callback.mock.calls.length).toBe(1);
});
