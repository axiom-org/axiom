import KeyPair from "../iso/KeyPair";
import MockPeerServer from "../iso/MockPeerServer";
import Node from "../iso/Node";
import { useTestEnvironment } from "../iso/TestUtil";
import TimeTracker from "../iso/TimeTracker";
import { sleep } from "../iso/Util";

function checkEqual(x, y, message?: String) {
  if (x !== y) {
    throw new Error(`${x} !== ${y}: ${message}`);
  }
}

async function waitFor(f) {
  let start = new Date().getTime();
  while (new Date().getTime() - start < 1000) {
    if (f()) {
      return;
    }
    await sleep(1);
  }
  throw new Error("waiting never finished");
}

// It's a little frustrating that this integration test isn't a Jest test.
// The main problem is that the encryption libraries are about 10x slower in the Jest environment.
// I haven't been able to track down why this is.
// Since the p2p nodes encrypt a lot, this makes it quite slow to test them with Jest.
// Maybe if we replace tweetnacl with node-sodium it'll work better.
async function runIntegrationTest() {
  useTestEnvironment();
  let start = new Date().getTime();

  let bootstrap = MockPeerServer.makeBootstrap(2);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Connect a couple nodes to the network
  let node1 = new Node(null, bootstrap, false);
  let chan1 = node1.channel("testapp", "prefix1");
  chan1.setKeyPair(KeyPair.fromRandom());
  let db1 = chan1.database("docs");
  await db1.create({ name: "bob" });

  let node2 = new Node(null, bootstrap, false);
  let chan2 = node2.channel("testapp", "prefix2");
  let db2 = chan2.database("docs");

  // Check that a write to db1 should end up in db2
  let counter = 0;
  let callback = () => {
    counter++;
  };
  await db2.onMessage(callback);
  checkEqual(counter, 0);
  await waitFor(() => counter === 1);
  console.log(`time elapsed: ${new Date().getTime() - start} ms`);
}

runIntegrationTest().then(() => {
  TimeTracker.show();
});
