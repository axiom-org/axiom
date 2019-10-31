import { Peer } from "axiom-api";
import PeerServer from "./PeerServer";

// This test works, but it prevents Jest from exiting.
// --detectOpenHandles detects nothing.
test.skip("PeerServer single connection", async () => {
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
