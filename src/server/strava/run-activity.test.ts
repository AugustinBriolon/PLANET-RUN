import { describe, expect, it } from "vitest";

import { buildStravaActivity, SAMPLE_POLYLINE } from "@tests/fixtures/strava";

import { isMappableRun, toActivityRecord } from "./run-activity";

describe("isMappableRun", () => {
  it.each(["Run", "TrailRun"])("accepts outdoor %s activities with a trace", (sportType) => {
    expect(isMappableRun(buildStravaActivity({ sport_type: sportType }))).toBe(true);
  });

  it.each(["Ride", "VirtualRun", "Walk", "Hike"])("rejects %s activities", (sportType) => {
    expect(isMappableRun(buildStravaActivity({ sport_type: sportType }))).toBe(false);
  });

  it.each([null, undefined, ""])("rejects runs without a trace (%s)", (summaryPolyline) => {
    expect(isMappableRun(buildStravaActivity({ map: { summary_polyline: summaryPolyline } }))).toBe(false);
  });
});

describe("toActivityRecord", () => {
  it("maps a Strava activity to a database record owned by the user", () => {
    expect(toActivityRecord(buildStravaActivity(), "user-1")).toEqual({
      stravaActivityId: 1001,
      userId: "user-1",
      name: "Morning Run",
      sportType: "Run",
      startDate: new Date("2026-09-01T06:30:00Z"),
      distanceMeters: 10_000,
      movingTimeSeconds: 3_000,
      elevationGainMeters: 85,
      summaryPolyline: SAMPLE_POLYLINE,
    });
  });
});
