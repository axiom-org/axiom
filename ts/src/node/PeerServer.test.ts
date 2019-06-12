import Peer from "../iso/Peer";
import PeerServer from "./PeerServer";

test("PeerServer basics", async () => {
  let s = new PeerServer(2222, true);
  let clientPeer = Peer.connect(
    "ws://localhost:2222",
    true
  );

  let serverPeer: Peer = await new Promise((resolve, reject) => {
    s.onPeer(peer => resolve(peer));
  });
  console.log("XXX got serverPeer");
  await serverPeer.waitUntilConnected();
  console.log("XXX serverPeer connected");
  await clientPeer.waitUntilConnected();
  console.log("XXX clientPeer connected");
});
