import type { Feature, FeatureCollection, LineString, Position } from "geojson";

/** Street piece used to assemble a continuous run plan. */
export type PlanSegment = {
  id: number;
  coordinates: Position[];
  lengthMeters: number;
  /** Already run by the athlete (runnable streets) — also true for navigation connectors. */
  covered: boolean;
  /**
   * False for pedestrian connectors (`footway` / `path` / `steps`) that bridge pockets
   * without counting toward city coverage %. Defaults to true when omitted.
   */
  countsForCoverage?: boolean;
};

export type PlanLegKind = "conquest" | "bridge" | "connector" | "jump";

export type RunPlanLeg = {
  coordinates: Position[];
  kind: PlanLegKind;
};

export type RunPlanRoute = {
  /** Continuous path the athlete can follow. */
  coordinates: Position[];
  /** Uncovered length along the path — drives the conquest % estimate. */
  uncoveredMeters: number;
  /** Full path length including covered bridges (no distance-padding fill). */
  pathMeters: number;
  start: Position | null;
  /** Aerial hops used when the walkable graph could not connect pockets. */
  jumpCount: number;
  jumpMeters: number;
  /** Styled legs for the map (gold conquest vs gray connectors / jumps). */
  legs: RunPlanLeg[];
};

export type RunPlanRouteOptions = {
  /** Approximate outing length in meters — a soft target, not a hard cut. */
  budgetMeters: number;
  /** Snap / junction tolerance when joining segment ends. */
  joinToleranceMeters?: number;
  /** Max length of already-covered bridging between unfinished streets. */
  maxBridgeMeters?: number;
  /**
   * Diversifies the start among central uncovered streets.
   * Same salt → same route; change it on regenerate for a different outing.
   */
  salt?: number;
  /** Anchors the route at this [lng, lat] (the athlete's position) and only grows forward from it. */
  start?: Position;
};

/**
 * Endpoint clustering for the street graph. Kept tight so we do not invent shortcuts
 * across blocks (larger values produce diagonal chords through buildings).
 */
const DEFAULT_JOIN_TOLERANCE_METERS = 10;
/** Refuse to draw a chord longer than this when stitching two street geometries. */
const MAX_GEOMETRY_GAP_METERS = 12;
/** Grid used to start in the densest remaining unfinished neighbourhood. */
const DENSITY_CELL_METERS = 280;
/** Longest street walk allowed to reach the first unfinished street from an anchored start. */
const MAX_START_CONNECTOR_METERS = 2_500;
/** Regenerating an anchored plan rotates among this many nearest unfinished streets. */
const ANCHORED_SEED_CHOICES = 4;

/** Soft band around the requested distance: coherence beats exact meters. */
export const PLAN_DISTANCE_SOFT_MIN = 0.85;
export const PLAN_DISTANCE_SOFT_MAX = 1.2;
/**
 * Aerial (off-street) hops are disabled for plans — they cut through buildings.
 * Tiny gaps at true junctions are handled by geometry stitching, not hops.
 */
export const MAX_AERIAL_JUMP_METERS = 0;

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
    Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function softBandMeters(budgetMeters: number): { minMeters: number; maxMeters: number } {
  return {
    minMeters: budgetMeters * PLAN_DISTANCE_SOFT_MIN,
    maxMeters: budgetMeters * PLAN_DISTANCE_SOFT_MAX,
  };
}

/**
 * Covered-bridge budget: walk already-run streets only to reach the next unfinished pocket.
 * Generous enough to cross a neighbourhood, still bounded so a 5 km outing doesn't detour 3 km.
 */
export function bridgeBudgetMeters(budgetMeters: number, override?: number): number {
  if (override != null) return override;
  return Math.min(2_200, Math.max(320, budgetMeters * 0.2));
}

/** Aerial hop budget — always zero; plans must stay on the street/connector graph. */
export function jumpBudgetMeters(_budgetMeters: number, _bridgeMeters: number): number {
  return MAX_AERIAL_JUMP_METERS;
}

/**
 * Degrees to expand the uncovered-street envelope when fetching the plan graph.
 * Longer outings need a wider street pocket so the walk can keep growing.
 */
export function planPocketExpandDegrees(budgetMeters: number): number {
  const radiusMeters = Math.min(8_000, Math.max(300, budgetMeters * 0.5));
  return radiusMeters / 111_320;
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
 * Merge consecutive legs of the same kind into fewer polylines for a readable map.
 * Never stitch across a spatial gap — that would draw the diagonal chords athletes see on the map.
 */
export function mergePlanLegs(legs: readonly RunPlanLeg[]): RunPlanLeg[] {
  const merged: RunPlanLeg[] = [];
  for (const leg of legs) {
    const clean = dedupe(leg.coordinates);
    if (clean.length < 2) continue;
    const last = merged[merged.length - 1];
    const lastTip = last?.coordinates[last.coordinates.length - 1];
    const nextStart = clean[0]!;
    const canJoin =
      last != null &&
      last.kind === leg.kind &&
      lastTip != null &&
      distanceMeters(lastTip, nextStart) <= MAX_GEOMETRY_GAP_METERS;
    if (canJoin) {
      last!.coordinates = dedupe([...last!.coordinates, ...clean]);
      continue;
    }
    merged.push({ kind: leg.kind, coordinates: clean });
  }
  return merged;
}

/** Drop any vertex-to-vertex chord longer than a street piece — last-resort map hygiene. */
export function splitPathOnGaps(coordinates: readonly Position[], maxGapMeters = 40): Position[][] {
  if (coordinates.length < 2) return [];
  const lines: Position[][] = [];
  let current: Position[] = [coordinates[0]!];
  for (let index = 1; index < coordinates.length; index++) {
    const point = coordinates[index]!;
    const prev = current[current.length - 1]!;
    if (distanceMeters(prev, point) > maxGapMeters) {
      if (current.length >= 2) lines.push(current);
      current = [point];
      continue;
    }
    current.push(point);
  }
  if (current.length >= 2) lines.push(current);
  return lines;
}

function bearingDegrees(from: Position, to: Position): number {
  const [lng1, lat1] = from as [number, number];
  const [lng2, lat2] = to as [number, number];
  const y = Math.sin(toRadians(lng2 - lng1)) * Math.cos(toRadians(lat2));
  const x =
    Math.cos(toRadians(lat1)) * Math.sin(toRadians(lat2)) -
    Math.sin(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.cos(toRadians(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function turnDeltaDegrees(inbound: number, outbound: number): number {
  const delta = Math.abs(inbound - outbound) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function edgeOutboundBearing(edge: DirectedEdge): number {
  const from = edge.coordinates[0]!;
  const to = edge.coordinates[Math.min(1, edge.coordinates.length - 1)]!;
  return bearingDegrees(from, to);
}

function isCoverageSegment(segment: PlanSegment): boolean {
  return segment.countsForCoverage !== false;
}

function legKindForEdge(edge: { covered: boolean; countsForCoverage: boolean }): PlanLegKind {
  if (!edge.countsForCoverage) return "connector";
  return edge.covered ? "bridge" : "conquest";
}

type NodeId = number;

type DirectedEdge = {
  segmentId: number;
  from: NodeId;
  to: NodeId;
  lengthMeters: number;
  covered: boolean;
  countsForCoverage: boolean;
  coordinates: Position[];
};

type StreetGraph = {
  nodes: Position[];
  outgoing: Map<NodeId, DirectedEdge[]>;
  /** segment id → { startNode, endNode } for the forward coordinate order. */
  segmentNodes: Map<number, { start: NodeId; end: NodeId }>;
};

/**
 * Cluster endpoints within join tolerance into shared nodes, then build a bidirectional graph.
 */
function buildStreetGraph(segments: readonly PlanSegment[], joinToleranceMeters: number): StreetGraph {
  const endpoints: Position[] = [];
  for (const segment of segments) {
    if (segment.coordinates.length < 2) continue;
    endpoints.push(segment.coordinates[0]!, segment.coordinates[segment.coordinates.length - 1]!);
  }

  const parent = endpoints.map((_, index) => index);
  function find(index: number): number {
    let current = index;
    while (parent[current] !== current) current = parent[current]!;
    let walk = index;
    while (parent[walk] !== walk) {
      const next = parent[walk]!;
      parent[walk] = current;
      walk = next;
    }
    return current;
  }
  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  const cellDeg = joinToleranceMeters / 111_320;
  const cells = new Map<string, number[]>();
  for (let i = 0; i < endpoints.length; i++) {
    const point = endpoints[i]!;
    const cx = Math.floor(point[0]! / cellDeg);
    const cy = Math.floor(point[1]! / cellDeg);
    const key = `${cx},${cy}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(i);
    else cells.set(key, [i]);
  }
  for (let i = 0; i < endpoints.length; i++) {
    const point = endpoints[i]!;
    const cx = Math.floor(point[0]! / cellDeg);
    const cy = Math.floor(point[1]! / cellDeg);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of cells.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j <= i) continue;
          if (distanceMeters(point, endpoints[j]!) <= joinToleranceMeters) union(i, j);
        }
      }
    }
  }

  const rootToNode = new Map<number, NodeId>();
  const nodes: Position[] = [];
  const sums = new Map<number, { lng: number; lat: number; count: number }>();
  for (let i = 0; i < endpoints.length; i++) {
    const root = find(i);
    const point = endpoints[i]!;
    const acc = sums.get(root) ?? { lng: 0, lat: 0, count: 0 };
    acc.lng += point[0]!;
    acc.lat += point[1]!;
    acc.count += 1;
    sums.set(root, acc);
  }
  for (const [root, acc] of sums) {
    rootToNode.set(root, nodes.length);
    nodes.push([acc.lng / acc.count, acc.lat / acc.count]);
  }

  const outgoing = new Map<NodeId, DirectedEdge[]>();
  const segmentNodes = new Map<number, { start: NodeId; end: NodeId }>();
  function addEdge(edge: DirectedEdge) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  let endpointCursor = 0;
  for (const segment of segments) {
    if (segment.coordinates.length < 2) continue;
    const start = rootToNode.get(find(endpointCursor++))!;
    const end = rootToNode.get(find(endpointCursor++))!;
    segmentNodes.set(segment.id, { start, end });
    if (start === end) continue;
    const countsForCoverage = isCoverageSegment(segment);
    addEdge({
      segmentId: segment.id,
      from: start,
      to: end,
      lengthMeters: segment.lengthMeters,
      covered: segment.covered,
      countsForCoverage,
      coordinates: segment.coordinates,
    });
    addEdge({
      segmentId: segment.id,
      from: end,
      to: start,
      lengthMeters: segment.lengthMeters,
      covered: segment.covered,
      countsForCoverage,
      coordinates: [...segment.coordinates].reverse(),
    });
  }

  return { nodes, outgoing, segmentNodes };
}

/**
 * Shortest path (by meters) from `from` to any unused uncovered edge tip, walking only unused
 * non-conquest edges (covered streets + navigation connectors).
 */
function findBridgeToUncovered(
  graph: StreetGraph,
  from: NodeId,
  usedSegments: ReadonlySet<number>,
  maxBridgeMeters: number,
): DirectedEdge[] | null {
  type State = { node: NodeId; path: DirectedEdge[]; meters: number };
  const queue: State[] = [{ node: from, path: [], meters: 0 }];
  const best = new Map<NodeId, number>([[from, 0]]);

  while (queue.length > 0) {
    queue.sort((a, b) => a.meters - b.meters);
    const current = queue.shift()!;
    if (current.meters > (best.get(current.node) ?? Infinity)) continue;

    for (const edge of graph.outgoing.get(current.node) ?? []) {
      if (usedSegments.has(edge.segmentId)) continue;
      const nextMeters = current.meters + edge.lengthMeters;
      if (nextMeters > maxBridgeMeters) continue;

      // Reached an unfinished coverage street — return the bridge walked to get there.
      if (!edge.covered && edge.countsForCoverage) {
        return current.path;
      }
      // Otherwise walk covered streets and pedestrian connectors.

      const known = best.get(edge.to);
      if (known != null && known <= nextMeters) continue;
      best.set(edge.to, nextMeters);
      queue.push({ node: edge.to, path: [...current.path, edge], meters: nextMeters });
    }
  }
  return null;
}

function unusedUncoveredLengthAt(graph: StreetGraph, node: NodeId, usedSegments: ReadonlySet<number>): number {
  let meters = 0;
  const seen = new Set<number>();
  for (const edge of graph.outgoing.get(node) ?? []) {
    if (edge.covered || !edge.countsForCoverage || usedSegments.has(edge.segmentId) || seen.has(edge.segmentId)) {
      continue;
    }
    seen.add(edge.segmentId);
    meters += edge.lengthMeters;
  }
  return meters;
}

/**
 * Prefer unfinished streets that continue straight and unlock more unexplored length.
 * U-turns / sharp zigzags are heavily penalised so the gold line stays readable.
 */
function pickUncoveredEdge(
  edges: DirectedEdge[],
  usedSegments: ReadonlySet<number>,
  graph: StreetGraph,
  inboundBearing: number | null,
): DirectedEdge | null {
  const unused = edges.filter((edge) => !usedSegments.has(edge.segmentId) && !edge.covered && edge.countsForCoverage);
  if (unused.length === 0) return null;
  return unused.reduce((best, edge) => {
    const usedNext = new Set(usedSegments);
    usedNext.add(edge.segmentId);
    const turn = inboundBearing == null ? 0 : turnDeltaDegrees(inboundBearing, edgeOutboundBearing(edge));
    const score = edge.lengthMeters + unusedUncoveredLengthAt(graph, edge.to, usedNext) * 0.7 - turn * 1.2;
    const usedBest = new Set(usedSegments);
    usedBest.add(best.segmentId);
    const bestTurn = inboundBearing == null ? 0 : turnDeltaDegrees(inboundBearing, edgeOutboundBearing(best));
    const bestScore = best.lengthMeters + unusedUncoveredLengthAt(graph, best.to, usedBest) * 0.7 - bestTurn * 1.2;
    return score > bestScore ? edge : best;
  });
}

type ProximityJump = {
  segment: PlanSegment;
  /** Walk coordinates in this order after the optional connector. */
  coordinates: Position[];
  fromNode: NodeId;
  toNode: NodeId;
  jumpMeters: number;
};

/**
 * When the street graph is locally stuck, hop to the nearest unused unfinished street
 * within a short aerial distance — longer gaps stop the plan instead.
 */
function findProximityUncovered(
  fromPoint: Position,
  fromNode: NodeId,
  segments: readonly PlanSegment[],
  graph: StreetGraph,
  usedSegments: ReadonlySet<number>,
  maxJumpMeters: number,
  neighborhoodMeters: (segment: PlanSegment) => number,
): ProximityJump | null {
  let best: ProximityJump | null = null;
  let bestScore = -Infinity;

  for (const segment of segments) {
    if (segment.covered || !isCoverageSegment(segment) || usedSegments.has(segment.id) || segment.coordinates.length < 2) {
      continue;
    }
    const nodes = graph.segmentNodes.get(segment.id);
    if (!nodes) continue;
    const ends = endsOf(segment);
    const candidates: { jumpMeters: number; coordinates: Position[]; fromNode: NodeId; toNode: NodeId }[] = [
      {
        jumpMeters: distanceMeters(fromPoint, ends.start),
        coordinates: segment.coordinates,
        fromNode: nodes.start,
        toNode: nodes.end,
      },
      {
        jumpMeters: distanceMeters(fromPoint, ends.end),
        coordinates: [...segment.coordinates].reverse(),
        fromNode: nodes.end,
        toNode: nodes.start,
      },
    ];
    for (const candidate of candidates) {
      if (candidate.jumpMeters > maxJumpMeters) continue;
      if (candidate.fromNode === fromNode && candidate.jumpMeters < 1) continue;
      const score = segment.lengthMeters + neighborhoodMeters(segment) * 0.35 - candidate.jumpMeters;
      if (score <= bestScore) continue;
      bestScore = score;
      best = { segment, ...candidate };
    }
  }

  return best;
}

function pickFromWindow<T>(ranked: T[], windowSize: number, salt: number): T {
  const window = Math.min(windowSize, ranked.length);
  const index = ((salt % window) + window) % window;
  return ranked[index]!;
}

function densityCellDegrees(): number {
  return DENSITY_CELL_METERS / 111_320;
}

function indexUncoveredDensity(uncovered: readonly PlanSegment[]): Map<string, number> {
  const cellDeg = densityCellDegrees();
  const metersByCell = new Map<string, number>();
  for (const segment of uncovered) {
    const mid = midpoint(segment.coordinates);
    const key = `${Math.floor(mid[0]! / cellDeg)},${Math.floor(mid[1]! / cellDeg)}`;
    metersByCell.set(key, (metersByCell.get(key) ?? 0) + segment.lengthMeters);
  }
  return metersByCell;
}

function neighborhoodUncoveredMeters(point: Position, metersByCell: Map<string, number>): number {
  const cellDeg = densityCellDegrees();
  const cx = Math.floor(point[0]! / cellDeg);
  const cy = Math.floor(point[1]! / cellDeg);
  let meters = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      meters += metersByCell.get(`${cx + dx},${cy + dy}`) ?? 0;
    }
  }
  return meters;
}

function pickSeed(uncovered: PlanSegment[], metersByCell: Map<string, number>, salt: number): PlanSegment {
  const ranked = [...uncovered].sort((a, b) => {
    const densityDelta =
      neighborhoodUncoveredMeters(midpoint(b.coordinates), metersByCell) -
      neighborhoodUncoveredMeters(midpoint(a.coordinates), metersByCell);
    if (densityDelta !== 0) return densityDelta;
    return a.id - b.id;
  });
  return pickFromWindow(ranked, 8, salt);
}

function nearestEndDistance(segment: PlanSegment, point: Position): number {
  const ends = endsOf(segment);
  return Math.min(distanceMeters(point, ends.start), distanceMeters(point, ends.end));
}

function pickAnchoredSeed(uncovered: PlanSegment[], start: Position, salt: number): PlanSegment {
  const ranked = [...uncovered].sort((a, b) => nearestEndDistance(a, start) - nearestEndDistance(b, start));
  return pickFromWindow(ranked, ANCHORED_SEED_CHOICES, salt);
}

function nearestNode(graph: StreetGraph, point: Position): NodeId | null {
  let best: NodeId | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const dist = distanceMeters(point, graph.nodes[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** Shortest street walk (by meters) between two nodes over unused edges, or null beyond `maxMeters`. */
function shortestPath(
  graph: StreetGraph,
  from: NodeId,
  to: NodeId,
  usedSegments: ReadonlySet<number>,
  maxMeters: number,
): DirectedEdge[] | null {
  if (from === to) return [];
  type State = { node: NodeId; path: DirectedEdge[]; meters: number };
  const queue: State[] = [{ node: from, path: [], meters: 0 }];
  const best = new Map<NodeId, number>([[from, 0]]);

  while (queue.length > 0) {
    queue.sort((a, b) => a.meters - b.meters);
    const current = queue.shift()!;
    if (current.node === to) return current.path;
    if (current.meters > (best.get(current.node) ?? Infinity)) continue;

    for (const edge of graph.outgoing.get(current.node) ?? []) {
      if (usedSegments.has(edge.segmentId)) continue;
      const nextMeters = current.meters + edge.lengthMeters;
      if (nextMeters > maxMeters) continue;
      const known = best.get(edge.to);
      if (known != null && known <= nextMeters) continue;
      best.set(edge.to, nextMeters);
      queue.push({ node: edge.to, path: [...current.path, edge], meters: nextMeters });
    }
  }
  return null;
}

function emptyRoute(): RunPlanRoute {
  return {
    coordinates: [],
    uncoveredMeters: 0,
    pathMeters: 0,
    start: null,
    jumpCount: 0,
    jumpMeters: 0,
    legs: [],
  };
}

/**
 * Walk the street graph into one continuous outing aimed at `budgetMeters`.
 * Prefers unfinished streets in dense remaining pockets; bridges through covered streets
 * and pedestrian connectors. Distance is a soft band (±15–20%): finish streets and stop
 * cleanly rather than padding or cutting mid-block to hit an exact meter count.
 */
export function buildRunPlanRoute(segments: readonly PlanSegment[], options: RunPlanRouteOptions): RunPlanRoute {
  const budgetMeters = Math.max(0, options.budgetMeters);
  const { minMeters, maxMeters } = softBandMeters(budgetMeters);
  const joinToleranceMeters = options.joinToleranceMeters ?? DEFAULT_JOIN_TOLERANCE_METERS;
  const maxBridgeMeters = bridgeBudgetMeters(budgetMeters, options.maxBridgeMeters);
  const salt = options.salt ?? 0;

  const uncovered = segments.filter(
    (segment) => !segment.covered && isCoverageSegment(segment) && segment.coordinates.length >= 2,
  );
  if (uncovered.length === 0 || budgetMeters <= 0) {
    return emptyRoute();
  }

  const focus = centroidOf(uncovered.map((segment) => midpoint(segment.coordinates)));
  const metersByCell = indexUncoveredDensity(uncovered);
  const graph = buildStreetGraph(segments, joinToleranceMeters);
  const anchor = options.start;
  const seed = anchor ? pickAnchoredSeed(uncovered, anchor, salt) : pickSeed(uncovered, metersByCell, salt);

  // Free plans enter the seed from the end farther from the pocket centre; anchored plans from the end nearer the athlete.
  const seedEnds = endsOf(seed);
  const startAtFirst = anchor
    ? distanceMeters(seedEnds.start, anchor) <= distanceMeters(seedEnds.end, anchor)
    : distanceMeters(seedEnds.start, focus) >= distanceMeters(seedEnds.end, focus);
  const seedCoords = startAtFirst ? seed.coordinates : [...seed.coordinates].reverse();
  const seedNodes = graph.segmentNodes.get(seed.id);
  const entryNode = seedNodes == null ? 0 : startAtFirst ? seedNodes.start : seedNodes.end;
  const exitNode = seedNodes == null ? 0 : startAtFirst ? seedNodes.end : seedNodes.start;

  const used = new Set<number>([seed.id]);
  const coords: Position[] = [];
  const legs: RunPlanLeg[] = [];
  let head = exitNode;
  let uncoveredMeters = seed.lengthMeters;
  let pathMeters = seed.lengthMeters;
  let jumpCount = 0;
  let jumpMeters = 0;
  let inboundBearing: number | null = null;

  function pushLeg(coordinates: Position[], kind: PlanLegKind) {
    const clean = dedupe(coordinates);
    if (clean.length < 2) return;
    legs.push({ coordinates: clean, kind });
  }

  /**
   * Append a street edge using its full OSM geometry. Refuses large tip→start chords so
   * clustered junctions cannot draw diagonals through blocks.
   */
  function appendEdge(edge: DirectedEdge): boolean {
    const tip = coords[coords.length - 1]!;
    const start = edge.coordinates[0]!;
    const gap = tip ? distanceMeters(tip, start) : 0;
    if (tip && gap > MAX_GEOMETRY_GAP_METERS) return false;

    used.add(edge.segmentId);
    pathMeters += edge.lengthMeters;
    if (!edge.covered && edge.countsForCoverage) uncoveredMeters += edge.lengthMeters;

    const piece: Position[] = tip ? [tip] : [];
    if (!tip || tip[0] !== start[0] || tip[1] !== start[1]) {
      if (tip) pathMeters += gap;
      piece.push(...edge.coordinates);
      coords.push(...edge.coordinates);
    } else {
      piece.push(...edge.coordinates.slice(1));
      coords.push(...edge.coordinates.slice(1));
    }
    pushLeg(piece, legKindForEdge(edge));
    head = edge.to;
    if (edge.coordinates.length >= 2) {
      inboundBearing = bearingDegrees(
        edge.coordinates[edge.coordinates.length - 2]!,
        edge.coordinates[edge.coordinates.length - 1]!,
      );
    }
    return true;
  }

  if (anchor) {
    const startNode = nearestNode(graph, anchor);
    const connector =
      startNode == null ? null : shortestPath(graph, startNode, entryNode, used, MAX_START_CONNECTOR_METERS);
    if (connector != null) {
      coords.push(anchor);
      let connected = true;
      for (const edge of connector) {
        if (!appendEdge(edge)) {
          connected = false;
          break;
        }
      }
      const tip = coords[coords.length - 1]!;
      if (!connected || distanceMeters(tip, seedCoords[0]!) > MAX_GEOMETRY_GAP_METERS) {
        // No off-street diagonal from GPS — fall back to starting on the seed street.
        coords.length = 0;
        legs.length = 0;
        used.clear();
        used.add(seed.id);
        pathMeters = seed.lengthMeters;
        uncoveredMeters = seed.lengthMeters;
        inboundBearing = null;
        head = exitNode;
      }
    }
  }
  coords.push(...seedCoords);
  pushLeg(seedCoords, "conquest");
  head = exitNode;
  if (seedCoords.length >= 2) {
    inboundBearing = bearingDegrees(seedCoords[seedCoords.length - 2]!, seedCoords[seedCoords.length - 1]!);
  }

  function roomTo(max: number): number {
    return max - pathMeters;
  }

  function extendConquest(): boolean {
    if (pathMeters >= maxMeters) return false;
    const edges = graph.outgoing.get(head) ?? [];

    const uncoveredEdge = pickUncoveredEdge(edges, used, graph, inboundBearing);
    if (uncoveredEdge) {
      const nextMeters = pathMeters + uncoveredEdge.lengthMeters;
      if (nextMeters <= maxMeters || (pathMeters < maxMeters && pathMeters < budgetMeters)) {
        return appendEdge(uncoveredEdge);
      }
    }

    const bridge = findBridgeToUncovered(graph, head, used, Math.min(maxBridgeMeters, Math.max(0, roomTo(maxMeters))));
    // `[]` means an unfinished street is already adjacent — still take it.
    if (bridge != null) {
      const bridgeMeters = bridge.reduce((sum, edge) => sum + edge.lengthMeters, 0);
      if (pathMeters + bridgeMeters <= maxMeters) {
        for (const hop of bridge) {
          if (!appendEdge(hop)) return false;
          if (pathMeters >= maxMeters) return true;
        }
        const nextUncovered = pickUncoveredEdge(graph.outgoing.get(head) ?? [], used, graph, inboundBearing);
        if (nextUncovered) {
          const nextMeters = pathMeters + nextUncovered.lengthMeters;
          if (nextMeters <= maxMeters || (pathMeters < maxMeters && pathMeters < budgetMeters)) {
            return appendEdge(nextUncovered);
          }
        }
        return bridge.length > 0;
      }
    }

    // Soft-band stop — never aerial-hop to pad distance or reach another pocket.
    return false;
  }

  // Forward-only growth: bidirectional expansion folded the path into unreadable scribbles.
  let grew = true;
  let guard = 0;
  while (grew && pathMeters < maxMeters && guard < 30_000) {
    guard += 1;
    grew = extendConquest();
  }

  const coordinates = dedupe(coords);
  if (coordinates.length < 2) {
    return emptyRoute();
  }

  return {
    coordinates,
    uncoveredMeters,
    pathMeters,
    start: coordinates[0]!,
    jumpCount,
    jumpMeters,
    legs: mergePlanLegs(legs),
  };
}

export function runPlanRouteToGeoJson(
  route: RunPlanRoute,
  areaId: number,
): FeatureCollection<LineString, { areaId: number; kind: PlanLegKind | "route" }> {
  const legs = mergePlanLegs(route.legs);
  if (legs.length > 0) {
    const features: Feature<LineString, { areaId: number; kind: PlanLegKind | "route" }>[] = [];
    for (const leg of legs) {
      for (const coordinates of splitPathOnGaps(leg.coordinates)) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates },
          properties: { areaId, kind: leg.kind },
        });
      }
    }
    return { type: "FeatureCollection", features };
  }
  if (route.coordinates.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: splitPathOnGaps(route.coordinates).map((coordinates) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { areaId, kind: "route" as const },
    })),
  };
}
