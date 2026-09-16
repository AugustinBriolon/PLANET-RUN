import { describe, expect, it } from "vitest";

import type { Activity } from "../db/schema";

import { toRunSummary } from "./to-run-summary";

describe("toRunSummary", () => {
  it("exposes only client-safe fields", () => {
    const activity: Activity = {
      stravaActivityId: 7,
      userId: "user-1",
      name: "Tempo",
      sportType: "Run",
      startDate: new Date("2026-09-01T06:30:00Z"),
      distanceMeters: 8_000,
      movingTimeSeconds: 2_400,
      elevationGainMeters: 30,
      summaryPolyline: "abc",
      coverageMatchedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(toRunSummary(activity)).toEqual({
      id: 7,
      name: "Tempo",
      startDate: "2026-09-01T06:30:00.000Z",
      distanceMeters: 8_000,
      movingTimeSeconds: 2_400,
      elevationGainMeters: 30,
      polyline: "abc",
    });
  });
});
