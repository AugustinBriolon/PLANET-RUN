import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

export type TokenCipher = {
  encrypt: (plaintext: string) => string;
  decrypt: (payload: string) => string;
};

/**
 * Encrypts OAuth tokens at rest. Payload format: `iv.authTag.ciphertext`, each base64url.
 */
export function createTokenCipher(base64Key: string): TokenCipher {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(`Token encryption key must be ${KEY_LENGTH_BYTES} bytes`);
  }

  return {
    encrypt(plaintext) {
      const iv = randomBytes(IV_LENGTH_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
      return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
    },
    decrypt(payload) {
      const [iv, authTag, ciphertext] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
      if (!iv || !authTag || !ciphertext) {
        throw new Error("Malformed encrypted token payload");
      }
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    },
  };
}
