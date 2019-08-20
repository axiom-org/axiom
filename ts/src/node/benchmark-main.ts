import { mockTick, useMockIntervalTimer } from "../iso/IntervalTimer";
import MockPeerServer from "../iso/MockPeerServer";
import Node from "../iso/Node";
import { useMockNetworking, useRealNetworking } from "../iso/TestUtil";
import TimeTracker from "../iso/TimeTracker";

function checkEqual(x, y, message) {
  if (x !== y) {
    throw new Error(`${x} !== ${y}: ${message}`);
  }
}

async function benchmark() {
  useMockNetworking();
  useMockIntervalTimer();

  let start = new Date();
  let logTime = (name: string) => {
    let end = new Date();
    let elapsed = end.getTime() - start.getTime();
    console.log(`${elapsed / 1000}s elapsed in ${name}`);
    start = end;
  };

  let bootstrap = MockPeerServer.makeBootstrap(4);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 4; i++) {
    checkEqual(servers[i].node.getPeers().length, 3, `server ${i}`);
  }

  // Add n more servers
  let n = 30;
  console.log(`creating a network of ${n} nodes`);
  let nodes = [];
  for (let i = 0; i < n; i++) {
    let node = new Node(null, bootstrap, false);
    nodes.push(node);
  }

  logTime("network creation");

  for (let node of nodes) {
    node.subscribe("test", null);
    node.publish("test", "hello");
  }

  logTime("publishing");
}

benchmark().then(() => {
  TimeTracker.show();
});
