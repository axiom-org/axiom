import SignedMessage from "./SignedMessage";

export default class Subscription {
  channel: string;
  callback: (sender: string, data: any) => void;
  oldMessages: { [signature: string]: boolean };

  constructor(channel: string, callback: (SignedMessage) => void) {
    this.channel = channel;
    this.callback = callback;
    this.oldMessages = {};
  }

  // Returns whether this is a new message
  handlePublish(sm: SignedMessage): boolean {
    if (this.oldMessages[sm.signature]) {
      return false;
    }

    this.oldMessages[sm.signature] = true;
    this.callback(sm.signer, sm.message.data);
    return true;
  }
}
