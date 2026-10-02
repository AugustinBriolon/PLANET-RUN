import { describe, expect, it } from "vitest";

import {
  buildRunPlanRoute,
  distanceMeters,
  runPlanRouteToGeoJson,
  type PlanSegment,
} from "./run-plan-route";

function seg(
  id: number,
  coordinates: [number, number][],
  covered: boolean,
  lengthMeters?: number,
): PlanSegment {
  let length = lengthMeters;
  if (length == null) {
    length = 0;
    for (let index = 1; index < coordinates.length; index++) {
      length += distanceMeters(coordinates[index - 1]!, coordinates[index]!);
    }
  }
  return { id, coordinates, lengthMeters: length, covered };
}

describe("buildRunPlanRoute", () => {
  it("returns an empty route when nothing is uncovered", () => {
    const route = buildRunPlanRoute(
      [
        seg(
          1,
          [
            [2.0, 48.0],
            [2.001, 48.0],
          ],
          true,
        ),
      ],
      { budgetMeters: 2000 },
    );
    expect(route.coordinates).toHaveLength(0);
    expect(route.uncoveredMeters).toBe(0);
  });

  it("concatenates connected uncovered segments into one continuous path", () => {
    const a = seg(
      1,
      [
        [2.0, 48.0],
        [2.00135, 48.0],
      ],
      false,
      100,
    );
    const b = seg(
      2,
      [
        [2.00135, 48.0],
        [2.0027, 48.0],
      ],
      false,
      100,
    );
    const c = seg(
      3,
      [
        [2.0027, 48.0],
        [2.00405, 48.0],
      ],
      false,
      100,
    );

    const route = buildRunPlanRoute([a, b, c], { budgetMeters: 350 });

    expect(route.coordinates.length).toBeGreaterThanOrEqual(4);
    expect(route.start?.[0]).toBe(route.coordinates[0]?.[0]);
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(290);
    expect(route.pathMeters).toBeLessThanOrEqual(360);
    for (let index = 1; index < route.coordinates.length; index++) {
      expect(distanceMeters(route.coordinates[index - 1]!, route.coordinates[index]!)).toBeLessThan(120);
    }
  });

  it("uses a short covered bridge to keep the path continuous", () => {
    const left = seg(
      1,
      [
        [2.0, 48.0],
        [2.001, 48.0],
      ],
      false,
      80,
    );
    const bridge = seg(
      2,
      [
        [2.001, 48.0],
        [2.0015, 48.0],
      ],
      true,
      40,
    );
    const right = seg(
      3,
      [
        [2.0015, 48.0],
        [2.0025, 48.0],
      ],
      false,
      80,
    );

    const route = buildRunPlanRoute([left, bridge, right], { budgetMeters: 250 });

    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(150);
    expect(route.pathMeters).toBeGreaterThan(route.uncoveredMeters);
    expect(route.coordinates.length).toBeGreaterThanOrEqual(4);
  });

  it("refuses a long covered bridge and stays on the first pocket", () => {
    const left = seg(
      1,
      [
        [2.0, 48.0],
        [2.001, 48.0],
      ],
      false,
      80,
    );
    const longBridge = seg(
      2,
      [
        [2.001, 48.0],
        [2.004, 48.0],
      ],
      true,
      250,
    );
    const right = seg(
      3,
      [
        [2.004, 48.0],
        [2.005, 48.0],
      ],
      false,
      80,
    );

    const route = buildRunPlanRoute([left, longBridge, right], {
      budgetMeters: 500,
      maxBridgeMeters: 120,
    });

    expect(route.uncoveredMeters).toBeLessThanOrEqual(90);
    expect(route.pathMeters).toBeLessThanOrEqual(90);
  });

  it("stops around the budget instead of packing every uncovered street", () => {
    const pieces = Array.from({ length: 20 }, (_, index) => {
      const from = 2 + index * 0.00135;
      return seg(
        index + 1,
        [
          [from, 48.0],
          [from + 0.00135, 48.0],
        ],
        false,
        100,
      );
    });

    const route = buildRunPlanRoute(pieces, { budgetMeters: 350 });
    expect(route.pathMeters).toBeGreaterThanOrEqual(300);
    expect(route.pathMeters).toBeLessThanOrEqual(420);
  });
});

describe("runPlanRouteToGeoJson", () => {
  it("emits a single LineString feature for a non-empty route", () => {
    const geojson = runPlanRouteToGeoJson(
      {
        coordinates: [
          [2, 48],
          [2.01, 48],
        ],
        uncoveredMeters: 100,
        pathMeters: 100,
        start: [2, 48],
      },
      42,
    );
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.type).toBe("LineString");
    expect(geojson.features[0]?.properties).toEqual({ areaId: 42, kind: "route" });
  });
});
