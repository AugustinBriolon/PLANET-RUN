import { describe, expect, it } from "vitest";

import { StravaApiError } from "../strava/strava-client";

import { toSyncFailure } from "./to-sync-failure";

describe("toSyncFailure", () => {
  it("asks to wait when Strava rate limits", () => {
    expect(toSyncFailure(new StravaApiError(429, "Too Many Requests"))).toMatchObject({ reason: "rate-limited" });
  });

  it.each([401, 403])("asks to reconnect when Strava answers %i", (status) => {
    expect(toSyncFailure(new StravaApiError(status, "Forbidden"))).toMatchObject({
      reason: "missing-permission",
      message: expect.stringMatching(/Reconnect/),
    });
  });

  it("stays generic for unexpected errors", () => {
    expect(toSyncFailure(new Error("boom"))).toEqual({
      reason: "unknown",
      message: "Syncing with Strava failed. Please try again.",
    });
  });
});
