import { describe, expect, it } from "vitest";

import { toAthleteIdentity } from "./strava-profile";

describe("toAthleteIdentity", () => {
  it("builds the identity from a Strava athlete", () => {
    expect(
      toAthleteIdentity({ id: 42, firstname: "Ada", lastname: "Lovelace", profile: "https://cdn.strava/ada.jpg" }),
    ).toEqual({ athleteId: 42, displayName: "Ada Lovelace", avatarUrl: "https://cdn.strava/ada.jpg" });
  });

  it("uses the first candidate that is a valid athlete", () => {
    const tokenResponseAthlete = { id: 42, firstname: "Ada" };
    const failedProfileRequest = { message: "Authorization Error", errors: [] };

    expect(toAthleteIdentity(failedProfileRequest, tokenResponseAthlete).athleteId).toBe(42);
    expect(toAthleteIdentity(tokenResponseAthlete, { id: 7 }).athleteId).toBe(42);
  });

  it("skips a missing token response athlete and falls back to the profile", () => {
    expect(toAthleteIdentity(undefined, { id: "42", firstname: "Ada" }).athleteId).toBe(42);
  });

  it("ignores Strava's relative placeholder avatar", () => {
    expect(toAthleteIdentity({ id: 1, firstname: "Ada", profile: "avatar/athlete/large.png" }).avatarUrl).toBeNull();
  });

  it("falls back to a generic name when the athlete has none", () => {
    expect(toAthleteIdentity({ id: 1, firstname: null, lastname: null }).displayName).toBe("Runner");
  });

  it("explains which keys were received when no athlete is found, without leaking values", () => {
    expect(() => toAthleteIdentity(undefined, { message: "Authorization Error", secret: "value" })).toThrow(
      "No Strava athlete found in sign-in response (received undefined and {message, secret})",
    );
  });
});
