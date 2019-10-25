import Cipher from "./Cipher";

test("Cipher basics", () => {
  let iv = Cipher.makeIV();
  let salt = Cipher.makeSalt();
  let ciphertext = Cipher.encrypt("password", iv, salt, "plaintext");
  expect(Cipher.decrypt("wrong-password", iv, salt, ciphertext)).toBe(null);
  expect(Cipher.decrypt("password", iv, salt, ciphertext)).toBe("plaintext");
});
