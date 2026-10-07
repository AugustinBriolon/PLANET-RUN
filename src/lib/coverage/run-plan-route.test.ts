import { describe, expect, it } from "vitest";

import {
  bridgeBudgetMeters,
  buildRunPlanRoute,
  distanceMeters,
  MAX_ANCHOR_SNAP_METERS,
  planPocketExpandDegrees,
  runPlanRouteToGeoJson,
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

/**
 * True when every consecutive path step stays on OSM/connector geometry.
 * Exact edge matches, join-tolerance junction glue, and float-drift at shared
 * endpoints (path tip near edge start, tip→edgeEnd ≈ edge) are allowed.
 * Longer off-edge chords fail — those would be aerial shortcuts.
 */
function pathFollowsSegments(path: [number, number][], segments: PlanSegment[], joinToleranceMeters = 22): boolean {
  const edges: { from: [number, number]; to: [number, number] }[] = [];
  for (const segment of segments) {
    for (let i = 1; i < segment.coordinates.length; i++) {
      const a = segment.coordinates[i - 1] as [number, number];
      const b = segment.coordinates[i] as [number, number];
      edges.push({ from: a, to: b }, { from: b, to: a });
    }
  }
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1] as [number, number];
    const b = path[i] as [number, number];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    if (distanceMeters(a, b) <= joinToleranceMeters) continue;
    const onEdge = edges.some(
      (edge) =>
        (a[0] === edge.from[0] && a[1] === edge.from[1] && b[0] === edge.to[0] && b[1] === edge.to[1]) ||
        (distanceMeters(a, edge.from) <= joinToleranceMeters &&
          distanceMeters(b, edge.to) <= joinToleranceMeters &&
          Math.abs(distanceMeters(a, b) - distanceMeters(edge.from, edge.to)) <= joinToleranceMeters),
    );
    if (!onEdge) return false;
  }
  return true;
}

describe("bridgeBudgetMeters", () => {
  it("scales with the outing and stays within bounds", () => {
    expect(bridgeBudgetMeters(5_000)).toBe(2_000);
    expect(bridgeBudgetMeters(12_000)).toBe(4_500);
    expect(bridgeBudgetMeters(500)).toBe(480);
    expect(bridgeBudgetMeters(5_000, 90)).toBe(90);
  });
});

describe("planPocketExpandDegrees", () => {
  it("widens the fetch envelope for longer outings", () => {
    expect(planPocketExpandDegrees(5_000)).toBeGreaterThan(planPocketExpandDegrees(800));
    expect(planPocketExpandDegrees(12_000)).toBeGreaterThan(planPocketExpandDegrees(5_000));
    expect(planPocketExpandDegrees(40_000)).toBeCloseTo(14_000 / 111_320, 6);
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
      { budgetMeters: 1_000 },
    );
    expect(route.coordinates).toEqual([]);
    expect(route.pathMeters).toBe(0);
  });

  it("concatenates connected uncovered segments into one continuous path", () => {
    const pieces = chain(1, 4, false);
    const route = buildRunPlanRoute(pieces, { budgetMeters: 350, salt: 0 });
    expect(route.pathMeters).toBeGreaterThanOrEqual(300);
    expect(route.pathMeters).toBeLessThanOrEqual(420);
    expect(route.uncoveredMeters).toBe(route.pathMeters);
    expect(route.coordinates.length).toBeGreaterThan(2);
    expect(pathFollowsSegments(route.coordinates as [number, number][], pieces)).toBe(true);
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
    expect(route.jumpCount).toBe(0);
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
    expect(route.legs.some((leg) => leg.kind === "connector")).toBe(true);
    expect(route.legs.some((leg) => leg.kind === "jump")).toBe(false);
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
  });

  it("fills with covered streets so a longer budget yields a longer path", () => {
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

  it("starts an anchored route on the network and walks streets to the nearest unfinished one", () => {
    const approach = chain(100, 3, true, 2.0, 100);
    const unfinished = chain(1, 10, false, 2.0 + 3 * 0.00135, 100);
    const segments = [...approach, ...unfinished];
    const athlete: [number, number] = [2.0, 48.0];

    const route = buildRunPlanRoute(segments, {
      budgetMeters: 1_000,
      start: athlete,
    });

    expect(route.coordinates.length).toBeGreaterThan(2);
    expect(distanceMeters(route.start!, athlete)).toBeLessThanOrEqual(MAX_ANCHOR_SNAP_METERS);
    expect(route.coordinates[0]).toEqual(route.start);
    expect(route.uncoveredMeters).toBeGreaterThanOrEqual(600);
    expect(route.pathMeters).toBeGreaterThan(route.uncoveredMeters);
    expect(route.jumpCount).toBe(0);
    expect(pathFollowsSegments(route.coordinates as [number, number][], segments)).toBe(true);
  });

  it("orients an anchored seed toward unfinished continuation, not the cul-de-sac", () => {
    const stub = seg(
      1,
      [
        [2.0, 48.0],
        [2.001, 48.0],
      ],
      false,
      80,
    );
    const east = chain(2, 12, false, 2.001, 100);
    const route = buildRunPlanRoute([stub, ...east], {
      budgetMeters: 1_000,
      start: [2.0009, 48.0],
    });
    expect(route.pathMeters).toBeGreaterThanOrEqual(700);
    expect(route.uncoveredMeters).toBeGreaterThan(700);
  });

  it("keeps the anchor snap as the start when growing toward the budget", () => {
    const pieces = chain(1, 20, false);
    const athlete: [number, number] = [2.0, 48.0];
    const route = buildRunPlanRoute(pieces, { budgetMeters: 1_500, start: athlete });

    expect(route.start).not.toBeNull();
    expect(distanceMeters(route.start!, athlete)).toBeLessThanOrEqual(MAX_ANCHOR_SNAP_METERS);
    expect(route.coordinates[0]).toEqual(route.start);
    expect(route.pathMeters).toBeGreaterThanOrEqual(1_300);
    expect(pathFollowsSegments(route.coordinates as [number, number][], pieces)).toBe(true);
  });

  it("refuses aerial hops across a short off-network gap (~80 m)", () => {
    const west = chain(1, 3, false, 2.0, 100);
    // ~80 m gap — previously within the aerial hop cap; must stay disconnected.
    const east = chain(100, 3, false, 2.0 + 3 * 0.00135 + 0.001, 100);
    const route = buildRunPlanRoute([...west, ...east], { budgetMeters: 800, salt: 0 });

    expect(route.jumpCount).toBe(0);
    expect(route.jumpMeters).toBe(0);
    expect(route.legs.some((leg) => leg.kind === "jump")).toBe(false);
    // Only one pocket is reachable on the graph — uncovered stays within that pocket.
    expect(route.uncoveredMeters).toBeLessThanOrEqual(320);
    expect(pathFollowsSegments(route.coordinates as [number, number][], [...west, ...east])).toBe(true);
  });

  it("does not aerial-hop across a multi-block gap", () => {
    const west = chain(1, 3, false, 2.0, 100);
    // ~400 m gap.
    const east = chain(100, 3, false, 2.0 + 3 * 0.00135 + 0.005, 100);
    const route = buildRunPlanRoute([...west, ...east], { budgetMeters: 2_000, salt: 0 });

    expect(route.jumpCount).toBe(0);
    expect(route.legs.some((leg) => leg.kind === "jump")).toBe(false);
    expect(pathFollowsSegments(route.coordinates as [number, number][], [...west, ...east])).toBe(true);
  });

  it("walks a long continuous OSM segment beyond 120 m when it is on-network", () => {
    const longStreet = seg(
      1,
      [
        [2.0, 48.0],
        [2.004, 48.0],
      ],
      false,
      300,
    );
    const continuation = seg(
      2,
      [
        [2.004, 48.0],
        [2.005, 48.0],
      ],
      false,
      80,
    );
    const route = buildRunPlanRoute([longStreet, continuation], { budgetMeters: 500, salt: 0 });

    expect(route.pathMeters).toBeGreaterThanOrEqual(300);
    expect(route.jumpCount).toBe(0);
    // Consecutive vertices on the long LineString are ~300 m apart — that is road geometry, not a hop.
    expect(distanceMeters(route.coordinates[0]!, route.coordinates[1]!)).toBeGreaterThan(120);
    expect(pathFollowsSegments(route.coordinates as [number, number][], [longStreet, continuation])).toBe(true);
  });

  it("refuses an anchored start when the athlete is off the street network", () => {
    const pieces = chain(1, 10, false, 2.0, 100);
    // ~200 m north of the chain — beyond MAX_ANCHOR_SNAP_METERS.
    const athlete: [number, number] = [2.0, 48.0 + 0.002];
    expect(distanceMeters(athlete, [2.0, 48.0])).toBeGreaterThan(MAX_ANCHOR_SNAP_METERS);

    const route = buildRunPlanRoute(pieces, { budgetMeters: 1_000, start: athlete });
    expect(route.coordinates).toEqual([]);
    expect(route.pathMeters).toBe(0);
  });

  it("refuses anchored start when seed pocket is graph-disconnected from the snap node", () => {
    const approach = chain(1, 2, true, 2.0, 100);
    const unfinishedFar = chain(100, 3, false, 2.05, 100);
    const athlete: [number, number] = [2.0, 48.0];

    const route = buildRunPlanRoute([...approach, ...unfinishedFar], {
      budgetMeters: 1_000,
      start: athlete,
      salt: 0,
    });

    // Athlete snaps onto the covered approach; seed is the only unfinished pocket, disconnected.
    expect(route.coordinates).toEqual([]);
    expect(route.pathMeters).toBe(0);
  });

  it("starts in the denser unfinished neighbourhood", () => {
    const sparse = chain(1, 2, false, 2.0, 100);
    const dense = chain(100, 12, false, 2.1, 100);
    const route = buildRunPlanRoute([...sparse, ...dense], { budgetMeters: 500, salt: 0 });
    expect(route.start?.[0]).toBeGreaterThan(2.05);
  });

  it("stops around the budget instead of packing every uncovered street", () => {
    const pieces = chain(1, 40, false);
    const route = buildRunPlanRoute(pieces, { budgetMeters: 350, salt: 0 });
    expect(route.pathMeters).toBeGreaterThanOrEqual(300);
    expect(route.pathMeters).toBeLessThanOrEqual(420);
  });

  it("loops covered streets so a small unfinished pocket can still approach a longer budget", () => {
    const unfinished = chain(1, 3, false, 2.0, 100);
    const covered = chain(100, 50, true, 2.0 + 3 * 0.00135, 100);
    const short = buildRunPlanRoute([...unfinished, ...covered], { budgetMeters: 2_000, salt: 0 });
    const longer = buildRunPlanRoute([...unfinished, ...covered], { budgetMeters: 5_000, salt: 0 });

    expect(short.pathMeters).toBeGreaterThanOrEqual(1_700);
    expect(longer.pathMeters).toBeGreaterThan(short.pathMeters + 1_500);
    expect(longer.pathMeters).toBeGreaterThanOrEqual(4_200);
  });

  it("stays fast when many sub-tolerance stubs touch one large unfinished pocket", () => {
    // Paris shape: stubs shorter than the join tolerance collapse to a single node, so they have no
    // graph edge. Each one used to re-flood the whole pocket, blowing seed ranking up quadratically.
    const pocket = chain(1, 3_000, false);
    const stubs = pocket.map((piece, index) => {
      const [lng, lat] = piece.coordinates[0]!;
      return seg(
        100_000 + index,
        [
          [lng, lat],
          [lng, lat + 0.00003],
        ],
        false,
      );
    });

    const startedAt = performance.now();
    const route = buildRunPlanRoute([...pocket, ...stubs], { budgetMeters: 18_000, salt: 0 });
    const elapsedMs = performance.now() - startedAt;

    expect(route.pathMeters).toBeGreaterThan(15_000);
    // ~30 ms now; the quadratic version took ~1.2 s on this fixture.
    expect(elapsedMs).toBeLessThan(400);
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
        jumpCount: 0,
        jumpMeters: 0,
        legs: [],
      },
      42,
    );
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.type).toBe("LineString");
    expect(geojson.features[0]?.properties).toEqual({ areaId: 42, kind: "route" });
  });
});
