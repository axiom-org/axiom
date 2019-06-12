import Peer from "../iso/Peer";
import PeerServer from "./PeerServer";

test("PeerServer basics", async () => {
  let s = new PeerServer(2222, true);
  let clientPeer = Peer.connectToServer("ws://localhost:2222", true);

  let serverPeer: Peer = await new Promise((resolve, reject) => {
    s.onPeer(peer => resolve(peer));
  });
  await serverPeer.waitUntilConnected();
  await clientPeer.waitUntilConnected();
});
