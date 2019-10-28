import { md } from "node-forge";

import KeyPair from "./KeyPair";

// Testing that our JavaScript libraries work like our Go libraries
test("KeyPair crypto basics", () => {
  let hash = md.sha512.sha256.create();
  let sum = hash.digest().getBytes();
  if (sum.charCodeAt(0) != 198) {
    throw new Error("first byte of hashed nothing should be 198");
  }

  hash = md.sha512.sha256.create();
  hash.update("qq", "utf8");
  sum = hash.digest().getBytes();
  expect(sum.charCodeAt(0)).toBe(59);

  let bytes =
    String.fromCharCode(1) +
    String.fromCharCode(2) +
    String.fromCharCode(3) +
    String.fromCharCode(4);
  hash = md.sha512.sha256.create();
  hash.update(bytes);
  sum = hash.digest().getBytes();
  expect(sum.charCodeAt(0)).toBe(254);
});

test("KeyPair.decodePublicKey", () => {
  expect(() => {
    KeyPair.decodePublicKey("blah");
  }).toThrow();
  expect(() => {
    KeyPair.decodePublicKey("0xblahblahblah");
  }).toThrow();
  expect(() => {
    KeyPair.decodePublicKey(
      "0x12345678901234567890123456789012345678901234567890123456789012345678"
    );
  }).toThrow();

  let validHex =
    "0x5cb9ad1487197f63a69f5c51c8bc53fefe6f55f7d01e5509dd0ad055d44eff4f9a86";
  let pk = KeyPair.decodePublicKey(validHex);
  expect(KeyPair.encodePublicKey(pk)).toBe(validHex);
});

test("KeyPair can be constructed from a private key", () => {
  let kp = KeyPair.fromPrivateKey(
    "1YBC5qpaM14DrVdsap5DtBWRv9IHf3Leyd95MOSSBV1cua0Uhxl/Y6afXFHIvFP+/m9V99AeVQndCtBV1E7/Tw"
  );
  expect(kp.publicKey).toBeDefined();
  expect(kp.privateKey).toBeDefined();
});

test("KeyPair specific signatures", () => {
  let serialized = `{
  "public": "0x5cb9ad1487197f63a69f5c51c8bc53fefe6f55f7d01e5509dd0ad055d44eff4f9a86",
  "private": "1YBC5qpaM14DrVdsap5DtBWRv9IHf3Leyd95MOSSBV1cua0Uhxl/Y6afXFHIvFP+/m9V99AeVQndCtBV1E7/Tw"
}
`;
  let kp = KeyPair.fromSerialized(serialized);
  expect(kp.serialize()).toBe(serialized);

  let sig = kp.sign("hello, hello");
  expect(sig).toBe(
    "7cvpEprNqYCkSuf8rgyV+ESSyziubcCCQpCVtp61FxMff6A3eRVPgFiKnJkH6DfIB0uMEwOr65GFVWnd8n9JAw"
  );
});

test("KeyPair rejects garbage signatures", () => {
  let key =
    "0x5cb9ad1487197f63a69f5c51c8bc53fefe6f55f7d01e5509dd0ad055d44eff4f9a86";
  expect(KeyPair.verifySignature(key, "message", "garbagesig")).toBe(false);
});

test("KeyPair.fromRandom", () => {
  let kp = KeyPair.fromRandom();
  let pub = kp.getPublicKey();

  let message1 =
    "This is my message. There are many like it, but this one is mine.";
  let sig1 = kp.sign(message1);
  let message2 = "Another message";
  let sig2 = kp.sign(message2);

  expect(KeyPair.verifySignature(pub, message1, sig1)).toBe(true);
  expect(KeyPair.verifySignature(pub, message2, sig2)).toBe(true);
  expect(KeyPair.verifySignature(pub, message1, sig2)).toBe(false);
  expect(KeyPair.verifySignature(pub, message2, sig1)).toBe(false);
});

test("KeyPair.fromSecretPhrase", () => {
  let kp1 = KeyPair.fromSecretPhrase("monkey");
  let pub = kp1.getPublicKey();
  let kp2 = KeyPair.fromSecretPhrase("monkey");
  expect(kp2.getPublicKey()).toBe(pub);

  let message =
    "This is my message. There are many like it, but this one is mine.";
  let sig1 = kp1.sign(message);
  let sig2 = kp2.sign(message);
  expect(sig1).toBe(sig2);

  expect(sig1).toBe(
    "s8f4G7896NvyDAjCjyQP8439wRgMam1/vMGzkISAwJVSVZDDOMoKDdPOcZpC9wFCw7mtZ7nbVOkAMpf7Hel8Cg"
  );
});

test("KeyPair.serialize", () => {
  let kp1 = KeyPair.fromSecretPhrase("boopaboop");
  let s = kp1.serialize();
  let kp2 = KeyPair.fromSerialized(s);
  expect(kp1.getPublicKey()).toEqual(kp2.getPublicKey());
  expect(kp1.privateKey).toEqual(kp2.privateKey);
});

test("KeyPair on a bad private key", () => {
  expect(() => KeyPair.fromPrivateKey("boop")).toThrow();
});

test("KeyPair hex string validation", () => {
  expect(KeyPair.isValidHexString("0x0")).toBe(true);
  expect(KeyPair.isValidHexString("0x03895679834256789")).toBe(true);
  expect(KeyPair.isValidHexString("0xdeadbeef")).toBe(true);
  expect(KeyPair.isValidHexString("0128397")).toBe(false);
  expect(KeyPair.isValidHexString("0x")).toBe(false);
  expect(KeyPair.isValidHexString("0x0324567890z")).toBe(false);
  expect(KeyPair.isValidHexString("0x0324567890g")).toBe(false);
  expect(KeyPair.isValidHexString("0x0324567890A")).toBe(false);
});
