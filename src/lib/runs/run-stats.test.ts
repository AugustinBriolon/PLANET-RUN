import { describe, expect, it } from "vitest";

import { summarizeRuns } from "./run-stats";
import type { RunSummary } from "./run-summary";

const run = (distanceMeters: number, movingTimeSeconds: number, elevationGainMeters: number): RunSummary => ({
  id: distanceMeters,
  name: "Run",
  startDate: "2026-09-01T06:30:00.000Z",
  distanceMeters,
  movingTimeSeconds,
  elevationGainMeters,
  polyline: "",
});

describe("summarizeRuns", () => {
  it("adds up distance, time and elevation", () => {
    expect(summarizeRuns([run(10_000, 3_000, 50), run(5_500, 1_800, 20)])).toEqual({
      runCount: 2,
      totalDistanceMeters: 15_500,
      totalMovingTimeSeconds: 4_800,
      totalElevationGainMeters: 70,
    });
  });

  it("returns zeros for an empty history", () => {
    expect(summarizeRuns([])).toEqual({
      runCount: 0,
      totalDistanceMeters: 0,
      totalMovingTimeSeconds: 0,
      totalElevationGainMeters: 0,
    });
  });
});
