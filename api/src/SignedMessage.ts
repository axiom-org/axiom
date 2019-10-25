import KeyPair from "./KeyPair";
import Message from "./Message";
import TimeTracker from "./TimeTracker";

export default class SignedMessage {
  message: any;
  messageString: string;
  signer: string;
  signature: string;
  verified: boolean;

  // Creates a signed message.
  // Users should generally not use this directly; use fromSigning or fromSerialized.
  // signer and signature are base64-encoded.
  constructor(args: {
    message: Message;
    messageString: string;
    signer: string;
    signature: string;
    verified: boolean;
  }) {
    this.message = args.message;
    this.messageString = args.messageString;
    this.signer = args.signer;
    this.signature = args.signature;
    this.verified = args.verified;
  }

  // Construct a SignedMessage by signing a Message.
  static fromSigning(
    message: Message,
    keyPair: KeyPair,
    signature?: string
  ): SignedMessage {
    if (!message) {
      throw new Error("cannot sign a falsy message");
    }
    if (!(message instanceof Message)) {
      throw new Error("can only sign a Message");
    }
    TimeTracker.start();
    let messageString = message.serialize();
    if (!signature) {
      signature = keyPair.sign(messageString);
    }
    let sm = new SignedMessage({
      message,
      messageString,
      signer: keyPair.getPublicKey(),
      signature: signature,
      verified: true
    });
    TimeTracker.end(`signing ${message.type}`);
    return sm;
  }

  serialize(): string {
    return "e:" + this.signer + ":" + this.signature + ":" + this.messageString;
  }

  verify(): void {
    if (this.verified) {
      return;
    }
    TimeTracker.start();
    if (
      !KeyPair.verifySignature(this.signer, this.messageString, this.signature)
    ) {
      throw new Error(
        "signature failed verification. msg " +
          this.messageString +
          " sig " +
          this.signature +
          " signer " +
          this.signer
      );
    }
    this.verified = true;
    TimeTracker.end(`verifying ${this.message.type}`);
  }

  // Construct a SignedMessage from a serialized form
  // Throws an error if it receives an invalid message
  // Returns null if the serialization is just an "ok"
  static fromSerialized(serialized: any, skipVerify: boolean): SignedMessage {
    let s = typeof serialized === "string" ? serialized : serialized.toString();

    if (s == "ok") {
      return null;
    }

    let parts = s.split(":");
    if (parts.length < 4) {
      console.error("serialized:", serialized);
      throw new Error("could not find 4 parts");
    }
    let [version, signer, signature] = parts.slice(0, 3);
    let messageString = parts.slice(3).join(":");
    if (version != "e") {
      console.error("serialized:", serialized);
      throw new Error("unrecognized version");
    }
    let message = Message.fromSerialized(messageString);
    let sm = new SignedMessage({
      message,
      messageString,
      signer,
      signature,
      verified: false
    });

    if (!skipVerify) {
      sm.verify();
    }
    return sm;
  }
}
