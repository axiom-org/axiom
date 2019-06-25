export default class MockPeer {
  createdAt: Date;
  keyPair: KeyPair;

  // url is set for MockPeers created by Peer.connectToServer.
  // The format is mock://<public_key>
  url: string;

  peerPublicKey: string;

  partner: MockPeer;

  constructor(keyPair: KeyPair, url: boolean) {
    this.createdAt = new Date();
    this.keyPair = keyPair;

    if (url) {
      this.url = `mock://${keyPair.getPublicKey()}`;
    } else {
      this.url = null;
    }
  }
}
