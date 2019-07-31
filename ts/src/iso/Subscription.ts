import SignedMessage from "./SignedMessage";

export default class Subscription {
  channel: string;
  callback: (SignedMessage) => void;

  constructor(channel: string, callback: (SignedMessage) => void) {
    this.channel = channel;
    this.callback = callback;
  }

  // Returns whether this is a new message
  handlePublish(sm: SignedMessage): boolean {
    // TODO: return the right thing
    return false;
  }
}
