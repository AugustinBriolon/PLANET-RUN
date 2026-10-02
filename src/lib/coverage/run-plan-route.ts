import type { Feature, FeatureCollection, LineString, Position } from "geojson";

/** Street piece used to assemble a continuous run plan. */
export type PlanSegment = {
  id: number;
  coordinates: Position[];
  lengthMeters: number;
  covered: boolean;
};

export type RunPlanRoute = {
  /** Continuous path the athlete can follow. */
  coordinates: Position[];
  /** Uncovered length along the path — drives the conquest % estimate. */
  uncoveredMeters: number;
  /** Full path length including short covered bridges. */
  pathMeters: number;
  start: Position | null;
};

export type RunPlanRouteOptions = {
  /** Target outing length in meters (clamped by the caller). */
  budgetMeters: number;
  /** Snap / junction tolerance when joining segment ends. */
  joinToleranceMeters?: number;
  /** Max length of a single already-covered bridge between uncovered streets. */
  maxBridgeMeters?: number;
};

const DEFAULT_JOIN_TOLERANCE_METERS = 18;
const DEFAULT_MAX_BRIDGE_METERS = 120;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Haversine distance in meters between two [lng, lat] positions. */
export function distanceMeters(from: Position, to: Position): number {
  const [lng1, lat1] = from as [number, number];
  const [lng2, lat2] = to as [number, number];
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function midpoint(coordinates: Position[]): Position {
  return coordinates[Math.floor(coordinates.length / 2)]!;
}

function centroidOf(positions: Position[]): Position {
  const lng = positions.reduce((sum, [x]) => sum + x!, 0) / positions.length;
  const lat = positions.reduce((sum, [, y]) => sum + y!, 0) / positions.length;
  return [lng, lat];
}

function endsOf(segment: PlanSegment): { start: Position; end: Position } {
  return {
    start: segment.coordinates[0]!,
    end: segment.coordinates[segment.coordinates.length - 1]!,
  };
}

function orientedCoordinates(segment: PlanSegment, from: Position, tolerance: number): Position[] | null {
  const { start, end } = endsOf(segment);
  if (distanceMeters(from, start) <= tolerance) return segment.coordinates;
  if (distanceMeters(from, end) <= tolerance) return [...segment.coordinates].reverse();
  return null;
}

type Candidate = {
  segment: PlanSegment;
  coordinates: Position[];
};

function candidatesAt(
  segments: readonly PlanSegment[],
  used: ReadonlySet<number>,
  from: Position,
  tolerance: number,
  maxBridgeMeters: number,
): Candidate[] {
  const found: Candidate[] = [];
  for (const segment of segments) {
    if (used.has(segment.id)) continue;
    if (segment.covered && segment.lengthMeters > maxBridgeMeters) continue;
    const oriented = orientedCoordinates(segment, from, tolerance);
    if (!oriented || oriented.length < 2) continue;
    found.push({ segment, coordinates: oriented });
  }
  return found;
}

function pickCandidate(candidates: Candidate[], focus: Position): Candidate | null {
  if (candidates.length === 0) return null;
  const uncovered = candidates.filter((entry) => !entry.segment.covered);
  const pool = uncovered.length > 0 ? uncovered : candidates;
  // Prefer longer uncovered pieces near the focus cluster, then any bridge that stays close.
  return pool.reduce((best, entry) => {
    const score =
      (entry.segment.covered ? 0 : 1_000_000) +
      entry.segment.lengthMeters -
      distanceMeters(midpoint(entry.coordinates), focus) * 0.25;
    const bestScore =
      (best.segment.covered ? 0 : 1_000_000) +
      best.segment.lengthMeters -
      distanceMeters(midpoint(best.coordinates), focus) * 0.25;
    return score > bestScore ? entry : best;
  });
}

function dedupe(path: Position[]): Position[] {
  const coordinates: Position[] = [];
  for (const point of path) {
    const last = coordinates[coordinates.length - 1];
    if (last && last[0] === point[0] && last[1] === point[1]) continue;
    coordinates.push(point);
  }
  return coordinates;
}

/**
 * Walk the street graph into one continuous outing: prefer unfinished streets, allow short
 * already-covered bridges so the path does not break at every intersection already run.
 *
 * From a seed segment near the uncovered cluster, the walk extends forward and backward so a
 * mid-pocket start still becomes one full chain (not half a street).
 */
export function buildRunPlanRoute(
  segments: readonly PlanSegment[],
  options: RunPlanRouteOptions,
): RunPlanRoute {
  const budgetMeters = Math.max(0, options.budgetMeters);
  const joinToleranceMeters = options.joinToleranceMeters ?? DEFAULT_JOIN_TOLERANCE_METERS;
  const maxBridgeMeters = options.maxBridgeMeters ?? DEFAULT_MAX_BRIDGE_METERS;

  const uncovered = segments.filter((segment) => !segment.covered && segment.coordinates.length >= 2);
  if (uncovered.length === 0 || budgetMeters <= 0) {
    return { coordinates: [], uncoveredMeters: 0, pathMeters: 0, start: null };
  }

  const focus = centroidOf(uncovered.map((segment) => midpoint(segment.coordinates)));
  const seed = uncovered.reduce((best, segment) =>
    distanceMeters(midpoint(segment.coordinates), focus) < distanceMeters(midpoint(best.coordinates), focus)
      ? segment
      : best,
  );

  const seedEnds = endsOf(seed);
  const seedForward =
    distanceMeters(seedEnds.end, focus) <= distanceMeters(seedEnds.start, focus)
      ? seed.coordinates
      : [...seed.coordinates].reverse();

  const used = new Set<number>([seed.id]);
  const coords: Position[] = [...seedForward];
  let uncoveredMeters = seed.lengthMeters;
  let pathMeters = seed.lengthMeters;

  function extend(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0 || coords.length === 0) return false;
    const from = end === "head" ? coords[coords.length - 1]! : coords[0]!;
    const candidates = candidatesAt(segments, used, from, joinToleranceMeters, maxBridgeMeters).filter(
      (entry) => entry.segment.lengthMeters <= remaining + 40,
    );
    const next = pickCandidate(candidates, focus);
    if (!next) return false;

    used.add(next.segment.id);
    pathMeters += next.segment.lengthMeters;
    if (!next.segment.covered) uncoveredMeters += next.segment.lengthMeters;

    if (end === "head") {
      coords.push(...next.coordinates.slice(1));
    } else {
      // next is oriented [from, …, arriveAt]; prepend the reversed interior + arrival.
      coords.unshift(...next.coordinates.slice(1).reverse());
    }
    return true;
  }

  let grew = true;
  while (grew && pathMeters < budgetMeters) {
    const grewHead = extend("head");
    const grewTail = pathMeters < budgetMeters ? extend("tail") : false;
    grew = grewHead || grewTail;
  }

  const coordinates = dedupe(coords);
  if (coordinates.length < 2) {
    return { coordinates: [], uncoveredMeters: 0, pathMeters: 0, start: null };
  }

  return {
    coordinates,
    uncoveredMeters,
    pathMeters,
    start: coordinates[0]!,
  };
}

export function runPlanRouteToGeoJson(
  route: RunPlanRoute,
  areaId: number,
): FeatureCollection<LineString, { areaId: number; kind: "route" }> {
  if (route.coordinates.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  const feature: Feature<LineString, { areaId: number; kind: "route" }> = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: route.coordinates },
    properties: { areaId, kind: "route" },
  };
  return { type: "FeatureCollection", features: [feature] };
}
