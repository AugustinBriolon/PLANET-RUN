/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
  signMobileOAuthState,
  signMobileSessionToken,
  verifyMobileOAuthState,
  verifyMobileSessionToken,
} from "./session-token";

const SECRET = "test-auth-secret-at-least-thirty-two-chars!!";

describe("mobile session token", () => {
  it("round-trips a signed session", async () => {
    const token = await signMobileSessionToken("user-42", SECRET);
    await expect(verifyMobileSessionToken(token, SECRET)).resolves.toEqual({ sub: "user-42" });
  });

  it("rejects a token signed with another secret", async () => {
    const token = await signMobileSessionToken("user-42", SECRET);
    await expect(verifyMobileSessionToken(token, `${SECRET}-other`)).resolves.toBeNull();
  });

  it("rejects a forged payload", async () => {
    await expect(verifyMobileSessionToken("not.a.jwt", SECRET)).resolves.toBeNull();
  });
});

describe("mobile oauth state", () => {
  it("accepts a fresh state", async () => {
    const state = await signMobileOAuthState(SECRET, "nonce-1");
    await expect(verifyMobileOAuthState(state, SECRET)).resolves.toBe(true);
  });

  it("rejects an invalid state", async () => {
    await expect(verifyMobileOAuthState("garbage", SECRET)).resolves.toBe(false);
  });
});
