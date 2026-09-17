import type { Point } from "geojson";
import { describe, expect, it } from "vitest";

import type { RunStartPoints } from "./run-geojson";
import { countCountries, summarizeRuns, type LocateCountry } from "./run-stats";
import type { RunSummary } from "./run-summary";

const run = (distanceMeters: number, movingTimeSeconds: number): RunSummary => ({
  id: distanceMeters,
  name: "Run",
  startDate: "2026-09-01T06:30:00.000Z",
  distanceMeters,
  movingTimeSeconds,
  elevationGainMeters: 0,
  polyline: "",
});

function startPointsAt(...positions: [number, number][]): RunStartPoints {
  return {
    type: "FeatureCollection",
    features: positions.map((coordinates, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates } satisfies Point,
      properties: {
        id: index,
        name: "Run",
        startDate: "2026-09-01T06:30:00.000Z",
        distanceMeters: 0,
        movingTimeSeconds: 0,
      },
    })),
  };
}

describe("summarizeRuns", () => {
  it("adds up distance and time and carries the country count", () => {
    expect(summarizeRuns([run(10_000, 3_000), run(5_500, 1_800)], 2)).toEqual({
      runCount: 2,
      totalDistanceMeters: 15_500,
      totalMovingTimeSeconds: 4_800,
      countryCount: 2,
    });
  });

  it("returns zeros for an empty history", () => {
    expect(summarizeRuns([], 0)).toEqual({
      runCount: 0,
      totalDistanceMeters: 0,
      totalMovingTimeSeconds: 0,
      countryCount: 0,
    });
  });
});

describe("countCountries", () => {
  const locateCountry: LocateCountry = ([longitude]) => (longitude < 0 ? "US" : longitude < 100 ? "FR" : null);

  it("counts each country once", () => {
    expect(countCountries(startPointsAt([2.3, 48.8], [2.2, 48.9], [-74, 40.7]), locateCountry)).toBe(2);
  });

  it("ignores runs that start outside any country", () => {
    expect(countCountries(startPointsAt([150, -40]), locateCountry)).toBe(0);
  });
});
