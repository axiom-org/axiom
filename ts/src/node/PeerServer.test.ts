import Node from "../iso/Node";
import Peer from "../iso/Peer";
import PeerServer from "./PeerServer";

process.on("unhandledRejection", error => {
  console.log("unhandled rejection:", (error as any).stack);
});

test("PeerServer single connection", async () => {
  let s = new PeerServer(null, 2222, true);
  let clientPeer = Peer.connectToServer(null, "ws://localhost:2222", true);

  let serverPeer: Peer = await new Promise((resolve, reject) => {
    s.onPeer(peer => resolve(peer));
  });
  await serverPeer.waitUntilConnected();
  await clientPeer.waitUntilConnected();
});

test("PeerServer bootstrapping", async () => {
  let urls = ["ws://localhost:2223", "ws://localhost:2224"];
  let verbose = true;

  let node1 = new Node(null, urls, verbose);
  let node2 = new Node(null, urls, verbose);
  let node3 = new Node(null, urls, verbose);

  let server1 = new PeerServer(null, 2223, verbose);
  let server2 = new PeerServer(null, 2224, verbose);

  server1.connectNode(node1);
  server2.connectNode(node2);

  let check = () => {
    expect(node1.numPeers()).toBeLessThan(3);
    expect(node2.numPeers()).toBeLessThan(3);
    expect(node3.numPeers()).toBeLessThan(3);
  };
  node1.onEveryMessage(check);
  node2.onEveryMessage(check);
  node3.onEveryMessage(check);

  node1.bootstrap();
  node2.bootstrap();
  node3.bootstrap();

  await node1.waitUntil(() => node1.numPeers() === 2);
  await node2.waitUntil(() => node1.numPeers() === 2);
  await node3.waitUntil(() => node1.numPeers() === 2);

  node1.destroy();
  node2.destroy();
  node3.destroy();
});
