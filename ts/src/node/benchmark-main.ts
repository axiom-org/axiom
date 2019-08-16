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
  let start = new Date();
  let bootstrap = MockPeerServer.makeBootstrap(4);
  let servers = MockPeerServer.makeServers(bootstrap);

  // Check the graph is complete
  for (let i = 0; i < 4; i++) {
    checkEqual(servers[i].node.getPeers().length, 3, `server ${i}`);
  }

  // Add n more servers
  let n = 40;
  let nodes = [];
  for (let i = 0; i < n; i++) {
    let node = new Node(null, bootstrap, false);
    nodes.push(node);
  }

  let end = new Date();
  let elapsed = end.getTime() - start.getTime();

  console.log(`${elapsed / 1000}s elapsed in network creation`);

  for (let server of servers) {
    server.destroy();
  }
  for (let node of nodes) {
    node.destroy();
  }
}

benchmark().then(() => {
  TimeTracker.show();
});
