// A wrapper for AES encryption and decryption

import forge from "node-forge";

export default class Cipher {
  static keyFromPassword(password: string, salt: string) {
    let keySize = 32;
    return forge.pkcs5.pbkdf2(password, salt, 1000, keySize);
  }

  // Returns a new hex-encoded initialization vector
  static makeIV(): string {
    return forge.util.bytesToHex(forge.random.getBytes(16));
  }

  // Returns a new hex-encoded salt
  static makeSalt(): string {
    return forge.util.bytesToHex(forge.random.getBytes(8));
  }

  // Encrypts some utf8 plaintext with AES.
  // Returns a hex-encoded string so that we don't need to muck around with bytes.
  static encrypt(
    password: string,
    iv: string,
    salt: string,
    plaintext: string
  ): string {
    iv = forge.util.hexToBytes(iv);
    salt = forge.util.hexToBytes(salt);

    let input = forge.util.createBuffer(plaintext, "utf8");
    let key = Cipher.keyFromPassword(password, salt);
    let cipher = forge.cipher.createCipher("AES-CBC", key);
    cipher.start({ iv: iv });
    cipher.update(input);
    cipher.finish();
    return cipher.output.toHex();
  }

  // Decrypts some hex-encoded data with AES.
  // Returns a utf8 plaintext.
  // Tries to return null if the password, iv, or salt is wrong.
  // It might just return garbage if the password is wrong, though.
  static decrypt(
    password: string,
    iv: string,
    salt: string,
    ciphertext: string
  ) {
    iv = forge.util.hexToBytes(iv);
    salt = forge.util.hexToBytes(salt);

    let bytes = forge.util.hexToBytes(ciphertext);
    let buffer = forge.util.createBuffer(bytes);
    let key = Cipher.keyFromPassword(password, salt);
    let decipher = forge.cipher.createDecipher("AES-CBC", key);
    decipher.start({ iv: iv });
    decipher.update(buffer);
    decipher.finish();

    try {
      // Decipher output string conversion always assumes utf-8
      let answer = decipher.output.toString();
      if (answer == "") {
        return null;
      }
      return answer;
    } catch (e) {
      return null;
    }
  }
}
