import MockPeerServer from "../iso/MockPeerServer";
import Node from "../iso/Node";
import { useTestEnvironment } from "../iso/TestUtil";
import TimeTracker from "../iso/TimeTracker";

function checkEqual(x, y, message) {
  if (x !== y) {
    throw new Error(`${x} !== ${y}: ${message}`);
  }
}

async function benchmark() {
  useTestEnvironment();

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
  checkEqual(callback.mock.calls.length, 0);
  await db1.create({ name: "bob" });
  db2.load();

  // TODO: wait for db2 to get the create
}

benchmark().then(() => {
  TimeTracker.show();
});
