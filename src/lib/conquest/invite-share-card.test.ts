import { describe, expect, it } from "vitest";

import {
  inviteShareDescription,
  inviteShareHeadline,
  openTitleNames,
  titleChips,
} from "./invite-share-card";

const base = {
  inviterName: "Ada",
  cityName: "Rennes",
  inviterShare: 0.123,
  founderOpen: true,
  conquerorOpen: true,
  keeperOpen: true,
};

describe("inviteShareHeadline", () => {
  it("names the rival and the city", () => {
    expect(inviteShareHeadline(base)).toBe("Ada challenged you on Rennes");
  });
});

describe("inviteShareDescription", () => {
  it("lists vacant titles without naming holders", () => {
    expect(inviteShareDescription(base)).toBe("They're at 12.3%. Founder · Conqueror · Keeper still open.");
  });

  it("says titles are claimed when every crown is taken", () => {
    expect(
      inviteShareDescription({
        ...base,
        founderOpen: false,
        conquerorOpen: false,
        keeperOpen: false,
      }),
    ).toBe("They're at 12.3%. The titles are claimed — take the streets anyway.");
  });

  it("falls back when coverage is still pending", () => {
    expect(inviteShareDescription({ ...base, inviterShare: null })).toBe(
      "They're at unmapped streets. Founder · Conqueror · Keeper still open.",
    );
  });
});

describe("titleChips", () => {
  it("keeps Founder, Conqueror, Keeper in that order", () => {
    expect(titleChips({ ...base, founderOpen: false, keeperOpen: true })).toEqual([
      { name: "Founder", open: false },
      { name: "Conqueror", open: true },
      { name: "Keeper", open: true },
    ]);
    expect(openTitleNames({ ...base, founderOpen: false, conquerorOpen: false })).toEqual(["Keeper"]);
  });
});
