import Peer from "./Peer";

test("Peer basics", async () => {
  let peer1 = new Peer({ initiator: true, verbose: true });
  let peer2 = new Peer({ verbose: true });

  peer1.onSignal(data => {
    peer2.signal(data);
  });
  peer2.onSignal(data => {
    peer1.signal(data);
  });

  await peer1.waitUntilConnected();
  await peer2.waitUntilConnected();
});
