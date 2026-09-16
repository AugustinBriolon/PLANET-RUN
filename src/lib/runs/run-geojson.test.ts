import { describe, expect, it } from "vitest";

import { SAMPLE_POLYLINE } from "@tests/fixtures/strava";

import { getTracesBounds, toRunStartPoints, toRunTraces } from "./run-geojson";
import type { RunSummary } from "./run-summary";

function buildRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: 1,
    name: "Morning Run",
    startDate: "2026-09-01T06:30:00.000Z",
    distanceMeters: 10_000,
    movingTimeSeconds: 3_000,
    elevationGainMeters: 80,
    polyline: SAMPLE_POLYLINE,
    ...overrides,
  };
}

describe("toRunTraces", () => {
  it("decodes polylines into GeoJSON lines with [lng, lat] positions", () => {
    const traces = toRunTraces([buildRun()]);

    expect(traces.features).toHaveLength(1);
    expect(traces.features[0]!.geometry.coordinates).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
    expect(traces.features[0]!.properties).toEqual({ id: 1, name: "Morning Run", distanceMeters: 10_000 });
  });

  it("skips runs whose trace has fewer than two points", () => {
    expect(toRunTraces([buildRun({ polyline: "" })]).features).toEqual([]);
  });
});

describe("toRunStartPoints", () => {
  it("places a point at the first position of each trace", () => {
    const startPoints = toRunStartPoints(toRunTraces([buildRun()]));
    expect(startPoints.features[0]!.geometry).toEqual({ type: "Point", coordinates: [-120.2, 38.5] });
  });
});

describe("getTracesBounds", () => {
  it("returns the south-west and north-east corners covering every trace", () => {
    expect(getTracesBounds(toRunTraces([buildRun()]))).toEqual([
      [-126.453, 38.5],
      [-120.2, 43.252],
    ]);
  });

  it("returns null when there is nothing to frame", () => {
    expect(getTracesBounds(toRunTraces([]))).toBeNull();
  });
});
