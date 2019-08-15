import MockPeerServer from "../iso/MockPeerServer";
import Node from "../iso/Node";
import { useMockNetworking, useRealNetworking } from "../iso/TestUtil";

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

  let end = new Date();
  let elapsed = end.getTime() - start.getTime();
  console.log(`${elapsed / 1000}s elapsed`);
  for (let server of servers) {
    server.destroy();
  }
}
