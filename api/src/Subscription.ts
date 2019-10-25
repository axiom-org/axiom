import SignedMessage from "./SignedMessage";

export default class Subscription {
  channel: string;
  callback: (sender: string, data: any) => void;
  oldMessages: { [signature: string]: boolean };

  constructor(channel: string, callback: (sender: string, data: any) => void) {
    this.channel = channel;
    this.callback = callback;
    this.oldMessages = {};
  }

  isNew(sm: SignedMessage): boolean {
    return !this.oldMessages[sm.signature];
  }

  // Returns whether this is a new message
  handlePublish(sm: SignedMessage): boolean {
    if (!this.isNew(sm)) {
      return false;
    }

    this.oldMessages[sm.signature] = true;
    if (this.callback) {
      this.callback(sm.signer, sm.message.data);
    }
    return true;
  }
}
