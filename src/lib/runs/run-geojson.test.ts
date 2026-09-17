import { describe, expect, it } from "vitest";

import { SAMPLE_POLYLINE } from "@tests/fixtures/strava";

import { getPrimaryCountryBounds, getTracesBounds, toRunStartPoints, toRunTraces } from "./run-geojson";
import type { RunTraces } from "./run-geojson";
import type { LocateCountry } from "./run-stats";
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
    // The feature id (not just properties.id) is what MapLibre's feature-state hover keys on.
    expect(traces.features[0]!.id).toBe(1);
    expect(traces.features[0]!.geometry.coordinates).toEqual([
      [-120.2, 38.5],
      [-120.95, 40.7],
      [-126.453, 43.252],
    ]);
    expect(traces.features[0]!.properties).toEqual({
      id: 1,
      name: "Morning Run",
      startDate: "2026-09-01T06:30:00.000Z",
      distanceMeters: 10_000,
      movingTimeSeconds: 3_000,
    });
  });

  it("skips runs whose trace has fewer than two points", () => {
    expect(toRunTraces([buildRun({ polyline: "" })]).features).toEqual([]);
  });
});

describe("toRunStartPoints", () => {
  it("places a point at the first position of each trace", () => {
    const startPoints = toRunStartPoints(toRunTraces([buildRun()]));
    expect(startPoints.features[0]!.id).toBe(1);
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

describe("getPrimaryCountryBounds", () => {
  const locateCountry: LocateCountry = ([longitude]) => (longitude < 0 ? "US" : longitude < 100 ? "FR" : null);

  function traceAt(id: number, ...coordinates: [number, number][]): RunTraces["features"][number] {
    return {
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { id, name: "Run", startDate: "2026-09-01T06:30:00.000Z", distanceMeters: 0, movingTimeSeconds: 0 },
    };
  }

  it("frames only the traces from the country with the most runs, ignoring a one-off trip abroad", () => {
    const traces: RunTraces = {
      type: "FeatureCollection",
      features: [
        traceAt(1, [2.3, 48.8], [2.35, 48.85]),
        traceAt(2, [2.2, 48.9], [2.25, 48.95]),
        traceAt(3, [-74, 40.7], [-73.9, 40.8]),
      ],
    };

    expect(getPrimaryCountryBounds(traces, locateCountry)).toEqual([
      [2.2, 48.8],
      [2.35, 48.95],
    ]);
  });

  it("returns null when no trace starts inside a known country", () => {
    const traces: RunTraces = { type: "FeatureCollection", features: [traceAt(1, [150, -40], [151, -41])] };

    expect(getPrimaryCountryBounds(traces, locateCountry)).toBeNull();
  });
});
