import KeyPair from "./KeyPair";
import Message from "./Message";
import SignedMessage from "./SignedMessage";

test("SignedMessage basic behavior", () => {
  let m = new Message("Test", { Number: 4 });
  let kp = KeyPair.fromSecretPhrase("foo");
  let sm = SignedMessage.fromSigning(m, kp);
  let serialized = sm.serialize();
  let sm2 = SignedMessage.fromSerialized(serialized);
  expect(sm2).toEqual(sm);
});

test("SignedMessage from ok", () => {
  let sm = SignedMessage.fromSerialized("ok");
  expect(sm).toEqual(null);
});
