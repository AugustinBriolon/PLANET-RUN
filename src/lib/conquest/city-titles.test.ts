import { describe, expect, it } from "vitest";

import { isCityComplete, keeperSeason, pickCityTitles, type ConquestRecord } from "./city-titles";

const t = (iso: string) => new Date(iso);

function row(userId: string, completedAt: string, completionDistanceMeters: number): ConquestRecord {
  return { userId, completedAt: t(completedAt), completionDistanceMeters };
}

describe("isCityComplete", () => {
  it("rejects missing and partial coverage", () => {
    expect(isCityComplete(null)).toBe(false);
    expect(isCityComplete(0.998)).toBe(false);
  });

  it("accepts a finished city including float slack", () => {
    expect(isCityComplete(0.999)).toBe(true);
    expect(isCityComplete(1)).toBe(true);
  });
});

describe("keeperSeason", () => {
  it("is the UTC month containing now", () => {
    expect(keeperSeason(t("2026-10-06T09:00:00Z"))).toEqual({
      start: t("2026-10-01T00:00:00Z"),
      end: t("2026-11-01T00:00:00Z"),
      id: "2026-10",
    });
  });
});

describe("pickCityTitles", () => {
  const ada = row("ada", "2026-01-01T00:00:00Z", 80_000);
  const grace = row("grace", "2026-02-01T00:00:00Z", 40_000);
  const katherine = row("katherine", "2026-03-01T00:00:00Z", 40_000);

  it("returns empty titles when nobody has finished", () => {
    expect(pickCityTitles([], new Map())).toEqual({
      founderUserId: null,
      keeperUserId: null,
      conquerorUserIds: [],
    });
  });

  it("gives Founder to the earliest 100% and Conqueror order to the fewest kilometres", () => {
    const titles = pickCityTitles([ada, grace, katherine], new Map());
    expect(titles.founderUserId).toBe("ada");
    expect(titles.conquerorUserIds).toEqual(["grace", "katherine", "ada"]);
    expect(titles.keeperUserId).toBeNull();
  });

  it("gives Keeper to the finisher who re-ran the most streets this season", () => {
    const titles = pickCityTitles(
      [ada, grace],
      new Map([
        ["ada", 100],
        ["grace", 500],
      ]),
    );
    expect(titles.keeperUserId).toBe("grace");
  });
});
