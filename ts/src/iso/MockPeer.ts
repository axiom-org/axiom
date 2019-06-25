import KeyPair from "./KeyPair";

export default class MockPeer {
  createdAt: Date;
  keyPair: KeyPair;
  peerPublicKey: string;
  nextRequestID: number;

  // url is set for MockPeers created by Peer.connectToServer.
  // The format is mock://<public_key>
  url: string;

  partner: MockPeer;

  constructor(keyPair: KeyPair, url: boolean) {
    this.createdAt = new Date();
    this.keyPair = keyPair;
    this.nextRequestID = 1;

    if (url) {
      this.url = `mock://${keyPair.getPublicKey()}`;
    } else {
      this.url = null;
    }
  }
}
