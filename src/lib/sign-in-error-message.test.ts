import { describe, expect, it } from "vitest";

import { getSignInErrorMessage } from "./sign-in-error-message";

describe("getSignInErrorMessage", () => {
  it("returns nothing when there is no error", () => {
    expect(getSignInErrorMessage(undefined)).toBeNull();
  });

  it("explains a declined Strava authorization", () => {
    expect(getSignInErrorMessage("AccessDenied")).toMatch(/declined/);
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(getSignInErrorMessage(["OAuthCallbackError"])).toMatch(/couldn't connect/);
  });
});
