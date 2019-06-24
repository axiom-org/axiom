export default class MockSimplePeer {
  id: string;
  initiator: boolean;
  partner: MockSimplePeer;

  constructor(id: string, initiator: boolean) {
    this.id = id;
    this.initiator = initiator;
    this.partner = null;
  }
}
