import { describe, expect, it } from "vitest";

import {
  bridgeBudgetMeters,
  buildRunPlanRoute,
  distanceMeters,
  planPocketExpandDegrees,
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

/** Horizontal chain of equal pieces along lat 48. */
function chain(
  startId: number,
  count: number,
  covered: boolean,
  startLng = 2,
  pieceMeters = 100,
): PlanSegment[] {
  const step = 0.00135;
  return Array.from({ length: count }, (_, index) => {
    const from = startLng + index * step;
    return seg(
      startId + index,
      [
        [from, 48.0],
        [from + step, 48.0],
      ],
      covered,
      pieceMeters,
    );
  });
}

describe("bridgeBudgetMeters", () => {
  it("scales with the outing and stays within bounds", () => {
    expect(bridgeBudgetMeters(5_000)).toBe(400);
    expect(bridgeBudgetMeters(12_000)).toBe(800);
    expect(bridgeBudgetMeters(500)).toBe(160);
    expect(bridgeBudgetMeters(5_000, 90)).toBe(90);
  });
});

describe("planPocketExpandDegrees", () => {
  it("widens the fetch envelope for longer outings", () => {
    expect(planPocketExpandDegrees(5_000)).toBeGreaterThan(planPocketExpandDegrees(800));
    expect(planPocketExpandDegrees(12_000)).toBeGreaterThan(planPocketExpandDegrees(5_000));
    expect(planPocketExpandDegrees(40_000)).toBeCloseTo(8_000 / 111_320, 6);
  });
});

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
    const route = buildRunPlanRoute(chain(1, 3, false), { budgetMeters: 350 });

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

  it("can fill across a long covered gap once conquest is stuck", () => {
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

    // Conquest bridge is capped at 120 m, but fill still walks the covered corridor to grow.
    expect(route.pathMeters).toBeGreaterThan(300);
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(150);
  });

  it("fills with covered streets so a longer budget yields a longer path", () => {
    // 500 m unfinished at the centre, then a long already-run corridor to burn distance on.
    const unfinished = chain(1, 5, false, 2.0, 100);
    const covered = chain(100, 40, true, 2.0 + 5 * 0.00135, 100);
    const segments = [...unfinished, ...covered];

    const short = buildRunPlanRoute(segments, { budgetMeters: 800, salt: 0 });
    const long = buildRunPlanRoute(segments, { budgetMeters: 3_000, salt: 0 });

    expect(short.pathMeters).toBeGreaterThanOrEqual(700);
    expect(short.pathMeters).toBeLessThan(1_200);
    expect(long.pathMeters).toBeGreaterThan(short.pathMeters + 1_000);
    expect(long.pathMeters).toBeGreaterThanOrEqual(2_500);
  });

  it("grows the path when the selected distance increases on uncovered-only network", () => {
    const pieces = chain(1, 40, false);
    const fiveKm = buildRunPlanRoute(pieces, { budgetMeters: 800, salt: 0 });
    const twelveKm = buildRunPlanRoute(pieces, { budgetMeters: 2_500, salt: 0 });

    expect(fiveKm.pathMeters).toBeGreaterThanOrEqual(700);
    expect(fiveKm.pathMeters).toBeLessThanOrEqual(950);
    expect(twelveKm.pathMeters).toBeGreaterThanOrEqual(2_300);
    expect(twelveKm.pathMeters).toBeGreaterThan(fiveKm.pathMeters + 1_200);
  });

  it("changes the start when salt changes", () => {
    const pieces = chain(1, 20, false);
    const a = buildRunPlanRoute(pieces, { budgetMeters: 600, salt: 0 });
    const b = buildRunPlanRoute(pieces, { budgetMeters: 600, salt: 7 });
    expect(a.start).not.toEqual(b.start);
  });

  it("stops around the budget instead of packing every uncovered street", () => {
    const route = buildRunPlanRoute(chain(1, 20, false), { budgetMeters: 350 });
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
