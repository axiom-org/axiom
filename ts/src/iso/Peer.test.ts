import Peer from "./Peer";

test("Peer basics", async () => {
  let peer1 = new Peer({ initiator: true, verbose: true });
  let peer2 = new Peer({ verbose: true });

  peer1.connect(peer2.signals);
  peer2.connect(peer1.signals);

  await peer1.waitUntilConnected();
  await peer2.waitUntilConnected();
});
