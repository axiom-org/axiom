import Message from "./Message";
import Peer from "./Peer";

test("Peer basics", async () => {
  let peer1 = new Peer({ initiator: true, verbose: true });
  let peer2 = new Peer({ verbose: true });

  peer1.connect(peer2.signals);
  peer2.connect(peer1.signals);

  await peer1.waitUntilConnected();
  await peer2.waitUntilConnected();

  let mp = new Promise((resolve, reject) => {
    peer2.onMessage(resolve);
  });
  peer1.sendMessage(new Message("Ping"));
  let message = (await mp) as Message;
  expect(message.type).toBe("Ping");
});
