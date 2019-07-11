import KeyPair from "./KeyPair";
import Message from "./Message";

export default class SignedMessage {
  message: any;
  messageString: string;
  signer: string;
  signature: string;

  // Creates a signed message.
  // Users should generally not use this directly; use fromSigning or fromSerialized.
  // signer and signature are base64-encoded.
  constructor({ message, messageString, signer, signature }) {
    this.message = message;
    this.messageString = messageString;
    this.signer = signer;
    this.signature = signature;
  }

  // Construct a SignedMessage by signing a Message.
  static fromSigning(message, keyPair) {
    if (!message) {
      throw new Error("cannot sign a falsy message");
    }
    if (!(message instanceof Message)) {
      throw new Error("can only sign a Message");
    }
    let messageString = message.serialize();
    return new SignedMessage({
      message,
      messageString,
      signer: keyPair.getPublicKey(),
      signature: keyPair.sign(messageString)
    });
  }

  serialize() {
    return "e:" + this.signer + ":" + this.signature + ":" + this.messageString;
  }

  // Construct a SignedMessage from a serialized form
  // Throws an error if it receives an invalid message
  // Returns null if the serialization is just an "ok"
  static fromSerialized(serialized) {
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
    if (!KeyPair.verifySignature(signer, messageString, signature)) {
      throw new Error(
        "signature failed verification. msg " +
          messageString +
          " sig " +
          signature +
          " signer " +
          signer
      );
    }
    let message = Message.fromSerialized(messageString);
    return new SignedMessage({ message, messageString, signer, signature });
  }
}
