import { describe, expect, it } from "vitest";

import {
  bridgeBudgetMeters,
  buildRunPlanRoute,
  distanceMeters,
  jumpBudgetMeters,
  MAX_AERIAL_JUMP_METERS,
  mergePlanLegs,
  planPocketExpandDegrees,
  runPlanRouteToGeoJson,
  softBandMeters,
  splitPathOnGaps,
  type PlanSegment,
} from "./run-plan-route";

function seg(
  id: number,
  coordinates: [number, number][],
  covered: boolean,
  lengthMeters?: number,
  countsForCoverage = true,
): PlanSegment {
  let length = lengthMeters;
  if (length == null) {
    length = 0;
    for (let index = 1; index < coordinates.length; index++) {
      length += distanceMeters(coordinates[index - 1]!, coordinates[index]!);
    }
  }
  return { id, coordinates, lengthMeters: length, covered, countsForCoverage };
}

/** Horizontal chain of equal pieces along lat 48. */
function chain(startId: number, count: number, covered: boolean, startLng = 2, pieceMeters = 100): PlanSegment[] {
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

describe("softBandMeters", () => {
  it("exposes the ±15–20% preference band", () => {
    expect(softBandMeters(5_000)).toEqual({ minMeters: 4_250, maxMeters: 6_000 });
  });
});

describe("bridgeBudgetMeters", () => {
  it("scales with the outing and stays within bounds", () => {
    expect(bridgeBudgetMeters(5_000)).toBe(2_000);
    expect(bridgeBudgetMeters(12_000)).toBe(4_800);
    expect(bridgeBudgetMeters(500)).toBe(450);
    expect(bridgeBudgetMeters(5_000, 90)).toBe(90);
  });
});

describe("jumpBudgetMeters", () => {
  it("disables aerial hops entirely", () => {
    expect(MAX_AERIAL_JUMP_METERS).toBe(0);
    expect(jumpBudgetMeters(5_000, bridgeBudgetMeters(5_000))).toBe(0);
    expect(jumpBudgetMeters(12_000, bridgeBudgetMeters(12_000))).toBe(0);
  });
});

describe("mergePlanLegs", () => {
  it("unifies consecutive legs of the same kind when they touch", () => {
    const merged = mergePlanLegs([
      {
        kind: "conquest",
        coordinates: [
          [2, 48],
          [2.01, 48],
        ],
      },
      {
        kind: "conquest",
        coordinates: [
          [2.01, 48],
          [2.02, 48],
        ],
      },
      {
        kind: "connector",
        coordinates: [
          [2.02, 48],
          [2.03, 48],
        ],
      },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]?.coordinates).toHaveLength(3);
    expect(merged[1]?.kind).toBe("connector");
  });

  it("does not stitch same-kind legs across a spatial gap", () => {
    const merged = mergePlanLegs([
      {
        kind: "conquest",
        coordinates: [
          [2, 48],
          [2.01, 48],
        ],
      },
      {
        kind: "conquest",
        coordinates: [
          [2.05, 48],
          [2.06, 48],
        ],
      },
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe("splitPathOnGaps", () => {
  it("keeps consecutive street pieces up to maxSegmentMeters", () => {
    // ~50 m east steps — matching COVERAGE_RULES.maxSegmentMeters after OSM cut.
    const step = 0.000675;
    const coordinates: [number, number][] = Array.from({ length: 5 }, (_, index) => [2 + index * step, 48]);
    const pieces = splitPathOnGaps(coordinates);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toHaveLength(5);
  });

  it("splits when a chord exceeds the gap budget", () => {
    const pieces = splitPathOnGaps(
      [
        [2, 48],
        [2.0005, 48],
        [2.01, 48],
        [2.0105, 48],
      ],
      80,
    );
    expect(pieces.length).toBeGreaterThanOrEqual(2);
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
    expect(route.jumpCount).toBe(0);
  });

  it("concatenates connected uncovered segments into one continuous path", () => {
    const route = buildRunPlanRoute(chain(1, 3, false), { budgetMeters: 350 });

    expect(route.coordinates.length).toBeGreaterThanOrEqual(4);
    expect(route.start?.[0]).toBe(route.coordinates[0]?.[0]);
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(290);
    expect(route.pathMeters).toBeLessThanOrEqual(softBandMeters(350).maxMeters);
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

  it("walks a pedestrian connector instead of jumping across a block", () => {
    const left = seg(
      1,
      [
        [2.0, 48.0],
        [2.001, 48.0],
      ],
      false,
      80,
    );
    const connector = seg(
      2,
      [
        [2.001, 48.0],
        [2.0015, 48.0],
      ],
      true,
      40,
      false,
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

    const route = buildRunPlanRoute([left, connector, right], { budgetMeters: 250 });

    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(150);
    expect(route.jumpCount).toBe(0);
    expect(route.legs.some((leg) => leg.kind === "connector")).toBe(true);
  });

  it("stops under budget rather than aerial-hopping a long covered gap", () => {
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

    // Soft min is 425 m; without fill/jump the short pocket can end early — that is preferred.
    expect(route.pathMeters).toBeLessThan(300);
    expect(route.jumpCount).toBe(0);
  });

  it("does not pad with covered streets to match the requested distance", () => {
    const unfinished = chain(1, 5, false, 2.0, 100);
    const covered = chain(100, 40, true, 2.0 + 5 * 0.00135, 100);
    const segments = [...unfinished, ...covered];

    const short = buildRunPlanRoute(segments, { budgetMeters: 800, salt: 0 });
    const long = buildRunPlanRoute(segments, { budgetMeters: 3_000, salt: 0 });

    // ~500 m of unfinished only — soft band allows stopping short of 3 km without fill.
    expect(short.pathMeters).toBeGreaterThanOrEqual(400);
    expect(short.pathMeters).toBeLessThan(1_200);
    expect(long.pathMeters).toBeLessThan(1_500);
    expect(long.uncoveredMeters).toBeLessThanOrEqual(600);
  });

  it("finishes a street that slightly exceeds the remaining soft target", () => {
    // Grow east through 3 × 100 m into a 200 m street; budget 450 → soft max 540.
    const pieces = [
      ...chain(1, 3, false, 2.0, 100),
      seg(
        50,
        [
          [2.0 + 3 * 0.00135, 48.0],
          [2.0 + 3 * 0.00135 + 0.0027, 48.0],
        ],
        false,
        200,
      ),
    ];
    const route = buildRunPlanRoute(pieces, { budgetMeters: 450, salt: 0 });
    expect(route.pathMeters).toBeGreaterThanOrEqual(400);
    expect(route.pathMeters).toBeLessThanOrEqual(softBandMeters(450).maxMeters + 100);
    expect(route.jumpCount).toBe(0);
    // The 200 m street is finished rather than cutting the plan at ~300 m.
    const lastSpan = distanceMeters(
      route.coordinates[route.coordinates.length - 2]!,
      route.coordinates[route.coordinates.length - 1]!,
    );
    expect(lastSpan).toBeGreaterThan(150);
  });

  it("grows the path when the selected distance increases on uncovered-only network", () => {
    const pieces = chain(1, 40, false);
    const fiveKm = buildRunPlanRoute(pieces, { budgetMeters: 800, salt: 0 });
    const twelveKm = buildRunPlanRoute(pieces, { budgetMeters: 2_500, salt: 0 });

    expect(fiveKm.pathMeters).toBeGreaterThanOrEqual(softBandMeters(800).minMeters);
    expect(fiveKm.pathMeters).toBeLessThanOrEqual(softBandMeters(800).maxMeters);
    expect(twelveKm.pathMeters).toBeGreaterThanOrEqual(softBandMeters(2_500).minMeters);
    expect(twelveKm.pathMeters).toBeGreaterThan(fiveKm.pathMeters + 1_200);
  });

  it("changes the start when salt changes", () => {
    const pieces = chain(1, 20, false);
    const a = buildRunPlanRoute(pieces, { budgetMeters: 600, salt: 0 });
    const b = buildRunPlanRoute(pieces, { budgetMeters: 600, salt: 7 });
    expect(a.start).not.toEqual(b.start);
  });

  it("starts an anchored route on streets when the athlete is near the graph", () => {
    const approach = chain(100, 3, true, 2.0, 100);
    const unfinished = chain(1, 10, false, 2.0 + 3 * 0.00135, 100);
    // Sit almost on the covered approach so the street walk reaches the seed without an aerial hop.
    const athlete: [number, number] = [2.0, 48.0];

    const route = buildRunPlanRoute([...approach, ...unfinished], {
      budgetMeters: 1_000,
      start: athlete,
    });

    expect(route.start).toEqual(athlete);
    expect(route.coordinates[0]).toEqual(athlete);
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(600);
    expect(route.jumpCount).toBe(0);
    for (let index = 1; index < route.coordinates.length; index++) {
      expect(distanceMeters(route.coordinates[index - 1]!, route.coordinates[index]!)).toBeLessThan(120);
    }
  });

  it("does not draw a long GPS-to-seed diagonal when the athlete is far from streets", () => {
    const pieces = chain(1, 30, false);
    const athlete: [number, number] = [2.0 + 15 * 0.00135, 48.05];

    const route = buildRunPlanRoute(pieces, { budgetMeters: 1_500, start: athlete });

    expect(route.jumpCount).toBe(0);
    expect(route.pathMeters).toBeGreaterThanOrEqual(softBandMeters(1_500).minMeters);
    // Path begins on the street network, not at the distant GPS fix.
    expect(route.start?.[1]).toBeCloseTo(48.0, 3);
  });

  it("escapes a dead-end by re-walking covered streets to the next unfinished pocket", () => {
    // Cul-de-sac of unfinished streets, then a covered corridor south to more unfinished.
    const pocketA = chain(1, 3, false, 2.0, 100);
    const coveredBack = [
      seg(
        50,
        [
          [2.0 + 3 * 0.00135, 48.0],
          [2.0 + 2 * 0.00135, 48.0],
        ],
        true,
        100,
      ),
      seg(
        51,
        [
          [2.0 + 2 * 0.00135, 48.0],
          [2.0 + 1 * 0.00135, 48.0],
        ],
        true,
        100,
      ),
      seg(
        52,
        [
          [2.0 + 1 * 0.00135, 48.0],
          [2.0, 48.0],
        ],
        true,
        100,
      ),
    ];
    const spur = [
      seg(
        60,
        [
          [2.0, 48.0],
          [2.0, 48.0 - 0.00135],
        ],
        true,
        100,
      ),
      ...chain(70, 8, false, 2.0, 100).map((piece, index) =>
        seg(
          70 + index,
          [
            [2.0 + index * 0.00135, 48.0 - 0.00135],
            [2.0 + (index + 1) * 0.00135, 48.0 - 0.00135],
          ],
          false,
          100,
        ),
      ),
    ];
    // Force start at the west end of pocket A so growth hits the cul-de-sac first.
    const route = buildRunPlanRoute([...pocketA, ...coveredBack, ...spur], {
      budgetMeters: 1_500,
      salt: 0,
      start: [2.0, 48.0],
    });

    expect(route.uncoveredMeters).toBeGreaterThan(600);
    expect(route.pathMeters).toBeGreaterThan(900);
    expect(route.jumpCount).toBe(0);
  });

  it("prefers continuing straight over a boulevard U-turn", () => {
    const east = chain(1, 6, false, 2.0, 100);
    // Parallel unfinished street immediately south — a U-turn would grab it first without bearing rules.
    const parallel = chain(100, 6, false, 2.0, 100).map((piece, index) =>
      seg(
        100 + index,
        [
          [2.0 + index * 0.00135, 48.0 - 0.0002],
          [2.0 + (index + 1) * 0.00135, 48.0 - 0.0002],
        ],
        false,
        100,
      ),
    );
    // Vertical connectors at each junction so both corridors are on the graph.
    const links = east.map((piece, index) =>
      seg(
        200 + index,
        [
          [2.0 + index * 0.00135, 48.0],
          [2.0 + index * 0.00135, 48.0 - 0.0002],
        ],
        true,
        25,
        false,
      ),
    );
    const route = buildRunPlanRoute([...east, ...parallel, ...links], {
      budgetMeters: 500,
      salt: 0,
      start: [2.0, 48.0],
    });

    // First ~400 m should stay on the northern corridor (lat ≈ 48.0), not ping-pong south.
    const early = route.coordinates.slice(0, 5);
    for (const point of early) {
      expect(point[1]).toBeGreaterThan(47.9995);
    }
  });

  it("never draws long off-street chords between consecutive vertices", () => {
    const west = chain(1, 8, false, 2.0, 100);
    const east = chain(100, 8, false, 2.0 + 8 * 0.00135 + 0.004, 100);
    const route = buildRunPlanRoute([...west, ...east], { budgetMeters: 2_000, salt: 0 });
    expect(route.jumpCount).toBe(0);
    for (let index = 1; index < route.coordinates.length; index++) {
      // Street pieces are ~100 m; anything much longer is a block-cutting diagonal.
      expect(distanceMeters(route.coordinates[index - 1]!, route.coordinates[index]!)).toBeLessThan(130);
    }
  });

  it("collects a second unfinished pocket via a covered bridge within budget", () => {
    const west = chain(1, 4, false, 2.0, 100);
    const gap = chain(50, 3, true, 2.0 + 4 * 0.00135, 100);
    const east = chain(100, 10, false, 2.0 + 7 * 0.00135, 100);

    const route = buildRunPlanRoute([...west, ...gap, ...east], { budgetMeters: 2_200, salt: 0 });

    // Forward-only growth may start mid-pocket; still must bridge into the second pocket.
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(800);
    expect(route.pathMeters).toBeGreaterThan(route.uncoveredMeters);
    expect(route.legs.some((leg) => leg.kind === "bridge")).toBe(true);
  });

  it("starts in the denser unfinished neighbourhood", () => {
    const sparse = chain(1, 2, false, 2.0, 100);
    const dense = chain(20, 12, false, 2.08, 100);

    const route = buildRunPlanRoute([...sparse, ...dense], { budgetMeters: 800, salt: 0 });
    const startLng = route.start?.[0] ?? 0;
    expect(startLng).toBeGreaterThan(2.07);
  });

  it("stays inside the soft band instead of packing every uncovered street", () => {
    const route = buildRunPlanRoute(chain(1, 20, false), { budgetMeters: 350 });
    expect(route.pathMeters).toBeGreaterThanOrEqual(softBandMeters(350).minMeters);
    expect(route.pathMeters).toBeLessThanOrEqual(softBandMeters(350).maxMeters);
  });

  it("refuses a long aerial jump once the soft minimum is reached", () => {
    const west = chain(1, 5, false, 2.0, 100);
    // Gap ~400 m — above MAX_AERIAL_JUMP_METERS.
    const east = chain(100, 5, false, 2.0 + 5 * 0.00135 + 0.005, 100);
    const route = buildRunPlanRoute([...west, ...east], { budgetMeters: 500, salt: 0 });
    expect(route.jumpCount).toBe(0);
    expect(route.pathMeters).toBeLessThanOrEqual(softBandMeters(500).maxMeters);
  });
});

describe("runPlanRouteToGeoJson", () => {
  it("emits styled legs when present", () => {
    const geojson = runPlanRouteToGeoJson(
      {
        coordinates: [
          [2, 48],
          [2.0005, 48],
          [2.001, 48],
        ],
        uncoveredMeters: 100,
        pathMeters: 150,
        start: [2, 48],
        jumpCount: 0,
        jumpMeters: 0,
        legs: [
          {
            coordinates: [
              [2, 48],
              [2.0005, 48],
            ],
            kind: "conquest",
          },
          {
            coordinates: [
              [2.0005, 48],
              [2.001, 48],
            ],
            kind: "connector",
          },
        ],
      },
      42,
    );
    expect(geojson.features).toHaveLength(2);
    expect(geojson.features[0]?.properties).toEqual({ areaId: 42, kind: "conquest" });
    expect(geojson.features[1]?.properties).toEqual({ areaId: 42, kind: "connector" });
  });
});
