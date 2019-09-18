import KeyPair from "./KeyPair";
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
  let chan1 = node1.channel("testapp", "prefix1");
  chan1.setKeyPair(KeyPair.fromRandom());
  let db1 = chan1.database("docs");

  let node2 = new Node(null, bootstrap, false);
  let chan2 = node2.channel("testapp", "prefix2");
  let db2 = chan2.database("docs");

  // Check that a write to db1 should end up in db2
  let callback = jest.fn();
  await db2.onMessage(callback);
  expect(callback.mock.calls.length).toBe(0);
  await db1.create({ name: "bob" });

  // TODO: fix this stuff after autoloading
  db2.load();
  await sleep(500);

  expect(callback.mock.calls.length).toBe(1);
});
