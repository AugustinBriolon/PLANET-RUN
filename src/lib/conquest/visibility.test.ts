import { describe, expect, it } from "vitest";

import { decideInvite } from "./invite";
import { canSeeRunner, orderedUserPair, parseProfileVisibility } from "./visibility";

describe("canSeeRunner", () => {
  const rivalIds = new Set(["rival"]);

  it("always shows the viewer and their rivals", () => {
    expect(canSeeRunner({ viewerId: "me", targetId: "me", rivalIds, visibility: "private" })).toBe(true);
    expect(canSeeRunner({ viewerId: "me", targetId: "rival", rivalIds, visibility: "private" })).toBe(true);
  });

  it("hides a private stranger and shows a public one", () => {
    expect(canSeeRunner({ viewerId: "me", targetId: "stranger", rivalIds, visibility: "private" })).toBe(false);
    expect(canSeeRunner({ viewerId: "me", targetId: "stranger", rivalIds, visibility: "public" })).toBe(true);
  });
});

describe("orderedUserPair", () => {
  it("is independent of argument order", () => {
    expect(orderedUserPair("b", "a")).toEqual({ userLow: "a", userHigh: "b" });
    expect(orderedUserPair("a", "b")).toEqual({ userLow: "a", userHigh: "b" });
  });
});

describe("parseProfileVisibility", () => {
  it("accepts only the two stored values", () => {
    expect(parseProfileVisibility("public")).toBe("public");
    expect(parseProfileVisibility("friends")).toBeNull();
  });
});

describe("decideInvite", () => {
  const invite = {
    token: "abc",
    inviterId: "ada",
    areaId: 7,
    expiresAt: new Date("2026-12-01T00:00:00Z"),
    acceptedBy: null,
  };

  it("accepts a live invite from someone else", () => {
    expect(decideInvite(invite, "grace", new Date("2026-10-06T00:00:00Z"))).toEqual({
      status: "accepted",
      areaId: 7,
      inviterId: "ada",
      alreadyRivals: false,
    });
  });

  it("rejects expired, missing and self invites", () => {
    expect(decideInvite(undefined, "grace", new Date())).toEqual({ status: "not-found" });
    expect(decideInvite(invite, "ada", new Date("2026-10-06T00:00:00Z"))).toEqual({ status: "own-invite" });
    expect(decideInvite(invite, "grace", new Date("2027-01-01T00:00:00Z"))).toEqual({ status: "expired" });
  });
});
