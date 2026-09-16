import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createTokenCipher } from "./token-cipher";

const key = randomBytes(32).toString("base64");

describe("createTokenCipher", () => {
  it("round-trips a token", () => {
    const cipher = createTokenCipher(key);
    expect(cipher.decrypt(cipher.encrypt("strava-access-token"))).toBe("strava-access-token");
  });

  it("produces a different payload for each encryption", () => {
    const cipher = createTokenCipher(key);
    expect(cipher.encrypt("same")).not.toBe(cipher.encrypt("same"));
  });

  it("rejects a tampered payload", () => {
    const cipher = createTokenCipher(key);
    const [iv, tag, ciphertext] = cipher.encrypt("secret").split(".");
    const tampered = [iv, tag, Buffer.from("forged").toString("base64url")].join(".");
    expect(ciphertext).toBeDefined();
    expect(() => cipher.decrypt(tampered)).toThrow();
  });

  it("rejects a payload encrypted with another key", () => {
    const payload = createTokenCipher(key).encrypt("secret");
    const otherCipher = createTokenCipher(randomBytes(32).toString("base64"));
    expect(() => otherCipher.decrypt(payload)).toThrow();
  });

  it("rejects keys that are not 32 bytes", () => {
    expect(() => createTokenCipher(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });

  it("rejects malformed payloads", () => {
    expect(() => createTokenCipher(key).decrypt("not-a-payload")).toThrow(/Malformed/);
  });
});
