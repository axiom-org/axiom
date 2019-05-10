import KeyPair from "../iso/KeyPair";
import Message from "../iso/Message";
import MockLocalStorage from "./MockLocalStorage";
import SignedMessage from "../iso/SignedMessage";
import Storage from "./Storage";
import TrustedClient from "./TrustedClient";

test("Operation message signing", async () => {
  let local = new MockLocalStorage();
  let storage = new Storage(local);
  let kp = KeyPair.fromSecretPhrase("blorp");
  await storage.setPasswordAndData("monkey", kp, {});
  let client = new TrustedClient(storage, "test");
  let unsigned = new Message("Operation", {
    operations: [
      {
        type: "CreateDocument",
        operation: {
          sequence: 1,
          fee: 1,
          data: {
            foo: "bar"
          }
        }
      }
    ]
  });
  let message = client.signOperationMessage(unsigned);
  let signed = SignedMessage.fromSigning(message, kp);

  // See tests of this string in operation_message_test.go
  expect(signed.serialize()).toEqual(
    'e:0x5b8f312caed13ac35805c69e889d24bbd3df7d6285fbca173cce47e7402a5d0bddf3:/zpIpa4ZZ/1AVAvP7mnwlr1D+XAfYX+UNeFx+UvIlv0UTYUFXnRuTveao4ULm/O8tWrOzKLHP8BgAJEN05JUCg:{"message":{"operations":[{"operation":{"data":{"foo":"bar"},"fee":1,"sequence":1,"signer":"0x5b8f312caed13ac35805c69e889d24bbd3df7d6285fbca173cce47e7402a5d0bddf3"},"signature":"powQVmQmIPLMs8InVatDw0MY3Olc4G3P8p6CE/ikgVElad6cXW0jCpFC9pD0bIOAHZmXS80U9RPKUupZSA92BQ","type":"CreateDocument"}]},"type":"Operation"}'
  );
});
