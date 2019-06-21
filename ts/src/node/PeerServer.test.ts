import Node from "../iso/Node";
import Peer from "../iso/Peer";
import PeerServer from "./PeerServer";

test("PeerServer basics", async () => {
  let s = new PeerServer(null, 2222, true);
  let clientPeer = Peer.connectToServer(null, "ws://localhost:2222", true);

  let serverPeer: Peer = await new Promise((resolve, reject) => {
    s.onPeer(peer => resolve(peer));
  });
  await serverPeer.waitUntilConnected();
  await clientPeer.waitUntilConnected();
});

test("PeerServer bootstrapping with Nodes", async () => {
  let urls = [
    "ws://localhost:2223",
    "ws://localhost:2224",
    "ws://localhost:2225"
  ];
  let verbose = true;

  let node1 = new Node(null, urls, verbose);
  let node2 = new Node(null, urls, verbose);
  let node3 = new Node(null, urls, verbose);

  console.log("node1:", node1.keyPair.getPublicKey());
  console.log("node2:", node2.keyPair.getPublicKey());
  console.log("node3:", node3.keyPair.getPublicKey());

  let server1 = new PeerServer(null, 2223, verbose);
  let server2 = new PeerServer(null, 2224, verbose);
  let server3 = new PeerServer(null, 2225, verbose);

  server1.connectNode(node1);
  server2.connectNode(node2);
  server3.connectNode(node3);

  node1.bootstrap();
  node2.bootstrap();
  node3.bootstrap();

  await node1.waitUntil(() => node1.numPeers() === 3);
  console.log(
    "node1 connected to:",
    node1.getPeers().map(p => p.peerPublicKey)
  );

  await node2.waitUntil(() => node1.numPeers() === 3);
  console.log(
    "node2 connected to:",
    node1.getPeers().map(p => p.peerPublicKey)
  );

  await node3.waitUntil(() => node1.numPeers() === 3);
  console.log(
    "node3 connected to:",
    node1.getPeers().map(p => p.peerPublicKey)
  );

  node1.destroy();
  node2.destroy();
  node3.destroy();
});
