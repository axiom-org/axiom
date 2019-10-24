import { KeyPair, Node, Peer } from "axiom-api";
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

  clientPeer.destroy();
  serverPeer.destroy();
  await s.close();
});

test.skip("PeerServer bootstrapping", async () => {
  let urls = ["ws://localhost:2223"];
  let verbose = false;

  let kp1 = KeyPair.fromRandom();
  let node1 = new Node(kp1, urls, verbose);

  let node2 = new Node(null, urls, verbose);
  let node3 = new Node(null, urls, verbose);

  let server = new PeerServer(kp1, 2223, verbose);

  server.connectNode(node1);

  let check = () => {
    expect(node1.numPeers()).toBeLessThan(3);
    expect(node2.numPeers()).toBeLessThan(3);
    expect(node3.numPeers()).toBeLessThan(3);
  };
  node1.onEveryMessage(check);
  node2.onEveryMessage(check);
  node3.onEveryMessage(check);

  await node1.waitUntil(() => node1.numPeers() === 2);
  await node2.waitUntil(() => node2.numPeers() === 2);
  await node3.waitUntil(() => node3.numPeers() === 2);

  node1.destroy();
  node2.destroy();
  node3.destroy();
});
