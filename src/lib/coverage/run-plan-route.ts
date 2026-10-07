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
  /** Full path length including covered bridges and fill. */
  pathMeters: number;
  start: Position | null;
  /**
   * Always 0 — aerial hops are disabled. Kept for API compatibility with mobile clients
   * that still read jump diagnostics.
   */
  jumpCount: number;
  jumpMeters: number;
  /** Styled legs for the map (gold conquest vs gray connectors). */
  legs: RunPlanLeg[];
};

export type RunPlanRouteOptions = {
  /** Target outing length in meters (clamped by the caller). */
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

/** Endpoint clustering — wide enough to join real OSM junctions without inventing block shortcuts. */
const DEFAULT_JOIN_TOLERANCE_METERS = 22;
/** Grid used to start in the densest remaining unfinished neighbourhood. */
const DENSITY_CELL_METERS = 280;
/** Longest street walk allowed to reach the first unfinished street from an anchored start. */
const MAX_START_CONNECTOR_METERS = 2_500;
/** Regenerating an anchored plan rotates among this many nearest unfinished streets. */
const ANCHORED_SEED_CHOICES = 4;
/**
 * Max GPS→graph snap when anchoring. Beyond this, the athlete is off-network and the plan
 * refuses the start rather than drawing a straight chord to the seed.
 * ~180 m covers courtyard / park GPS drift to the nearest mapped street.
 */
export const MAX_ANCHOR_SNAP_METERS = 180;

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

/**
 * Covered-bridge budget: walk already-run streets only to reach the next unfinished pocket.
 * Generous enough to cross a neighbourhood, still bounded so a 5 km outing doesn't detour 3 km.
 */
export function bridgeBudgetMeters(budgetMeters: number, override?: number): number {
  if (override != null) return override;
  // Wider bridges so 8 / 12 km preferences can leave a local pocket via covered streets.
  return Math.min(4_500, Math.max(480, budgetMeters * 0.4));
}

/**
 * Degrees to expand the uncovered-street envelope when fetching the plan graph.
 * Longer outings need a wider street pocket so the walk can keep growing.
 */
export function planPocketExpandDegrees(budgetMeters: number): number {
  const radiusMeters = Math.min(14_000, Math.max(800, budgetMeters * 0.9));
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

function isConquestEdge(edge: DirectedEdge): boolean {
  return !edge.covered && edge.countsForCoverage;
}

/**
 * Shortest path (by meters) from `from` to any unused uncovered edge tip, walking only unused
 * covered edges / connectors — used to bridge between unfinished pockets without breaking continuity.
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

      if (isConquestEdge(edge)) {
        return current.path;
      }

      const known = best.get(edge.to);
      if (known != null && known <= nextMeters) continue;
      best.set(edge.to, nextMeters);
      queue.push({ node: edge.to, path: [...current.path, edge], meters: nextMeters });
    }
  }
  return null;
}

/** Walk unused covered streets to burn remaining budget when conquest streets are exhausted. */
function findCoveredFillPath(
  graph: StreetGraph,
  from: NodeId,
  usedSegments: ReadonlySet<number>,
  maxMeters: number,
): DirectedEdge[] | null {
  type State = { node: NodeId; path: DirectedEdge[]; meters: number };
  const queue: State[] = [{ node: from, path: [], meters: 0 }];
  const best = new Map<NodeId, number>([[from, 0]]);
  let bestPath: DirectedEdge[] | null = null;
  let bestPathMeters = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => a.meters - b.meters);
    const current = queue.shift()!;
    if (current.meters > (best.get(current.node) ?? Infinity)) continue;
    if (current.path.length > 0 && current.meters > bestPathMeters) {
      bestPath = current.path;
      bestPathMeters = current.meters;
      if (bestPathMeters >= maxMeters * 0.85) return bestPath;
    }

    for (const edge of graph.outgoing.get(current.node) ?? []) {
      if (usedSegments.has(edge.segmentId)) continue;
      if (isConquestEdge(edge)) continue;
      const nextMeters = current.meters + edge.lengthMeters;
      if (nextMeters > maxMeters) continue;
      const known = best.get(edge.to);
      if (known != null && known <= nextMeters) continue;
      best.set(edge.to, nextMeters);
      queue.push({ node: edge.to, path: [...current.path, edge], meters: nextMeters });
    }
  }
  return bestPath;
}

function unusedUncoveredLengthAt(graph: StreetGraph, node: NodeId, usedSegments: ReadonlySet<number>): number {
  let meters = 0;
  const seen = new Set<number>();
  for (const edge of graph.outgoing.get(node) ?? []) {
    if (!isConquestEdge(edge) || usedSegments.has(edge.segmentId) || seen.has(edge.segmentId)) continue;
    seen.add(edge.segmentId);
    meters += edge.lengthMeters;
  }
  return meters;
}

/** Prefer the unfinished street that unlocks the most remaining unexplored length at the far end. */
function pickUncoveredEdge(
  edges: DirectedEdge[],
  usedSegments: ReadonlySet<number>,
  graph: StreetGraph,
): DirectedEdge | null {
  const unused = edges.filter((edge) => !usedSegments.has(edge.segmentId) && isConquestEdge(edge));
  if (unused.length === 0) return null;
  return unused.reduce((best, edge) => {
    const usedNext = new Set(usedSegments);
    usedNext.add(edge.segmentId);
    const score = edge.lengthMeters + unusedUncoveredLengthAt(graph, edge.to, usedNext) * 0.7;
    const usedBest = new Set(usedSegments);
    usedBest.add(best.segmentId);
    const bestScore = best.lengthMeters + unusedUncoveredLengthAt(graph, best.to, usedBest) * 0.7;
    return score > bestScore ? edge : best;
  });
}

function pickAnyUnusedEdge(
  edges: DirectedEdge[],
  usedSegments: ReadonlySet<number>,
  preferUncovered: boolean,
  avoidSegmentId?: number | null,
): DirectedEdge | null {
  const unused = edges.filter((edge) => !usedSegments.has(edge.segmentId));
  if (unused.length === 0) return null;
  const forward = avoidSegmentId == null ? unused : unused.filter((edge) => edge.segmentId !== avoidSegmentId);
  const base = forward.length > 0 ? forward : unused;
  const preferred = preferUncovered ? base.filter((edge) => isConquestEdge(edge)) : base.filter((edge) => !isConquestEdge(edge));
  const candidates = preferred.length > 0 ? preferred : base;
  return candidates.reduce((best, edge) => (edge.lengthMeters > best.lengthMeters ? edge : best));
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

/**
 * Map each unfinished segment id → total uncovered metres in its on-network pocket.
 * One flood-fill pass so seed ranking stays cheap on large cities.
 */
function indexUncoveredComponentMeters(graph: StreetGraph, uncovered: readonly PlanSegment[]): Map<number, number> {
  const metersBySegment = new Map<number, number>();
  // Nodes are shared across floods: a node already flooded belongs to a pocket whose segments are
  // all ranked, so re-flooding it (from a segment missing from the graph) only repeated work —
  // on Paris that re-walked the largest pocket ~1,300 times.
  const seenNode = new Set<NodeId>();
  for (const { id: startId } of uncovered) {
    if (metersBySegment.has(startId)) continue;
    const nodes = graph.segmentNodes.get(startId);
    if (!nodes) {
      metersBySegment.set(startId, 0);
      continue;
    }
    const seenSeg = new Set<number>();
    const queue: NodeId[] = [nodes.start, nodes.end].filter((node) => !seenNode.has(node));
    for (const node of queue) seenNode.add(node);
    let meters = 0;
    while (queue.length > 0) {
      const node = queue.pop()!;
      for (const edge of graph.outgoing.get(node) ?? []) {
        if (!isConquestEdge(edge) || seenSeg.has(edge.segmentId)) continue;
        seenSeg.add(edge.segmentId);
        meters += edge.lengthMeters;
        if (!seenNode.has(edge.to)) {
          seenNode.add(edge.to);
          queue.push(edge.to);
        }
      }
    }
    for (const segmentId of seenSeg) metersBySegment.set(segmentId, meters);
    if (!seenSeg.has(startId)) metersBySegment.set(startId, 0);
  }
  return metersBySegment;
}

function pickSeed(
  uncovered: PlanSegment[],
  metersByCell: Map<string, number>,
  salt: number,
  graph: StreetGraph,
): PlanSegment {
  const componentMeters = indexUncoveredComponentMeters(graph, uncovered);
  // Rank keys computed once per segment — the comparator used to recompute density per comparison.
  const ranked = uncovered
    .map((segment) => ({
      segment,
      component: componentMeters.get(segment.id) ?? 0,
      density: neighborhoodUncoveredMeters(midpoint(segment.coordinates), metersByCell),
    }))
    .sort((a, b) => {
      // Prefer the largest unfinished pocket so 12 km plans do not start in a 1 km cul-de-sac.
      if (a.component !== b.component) return b.component - a.component;
      if (a.density !== b.density) return b.density - a.density;
      return a.segment.id - b.segment.id;
    })
    .map((entry) => entry.segment);
  return pickFromWindow(ranked, 8, salt);
}

/**
 * Score an unfinished street for an anchored start: enter at the end nearer the athlete,
 * and prefer the piece whose far end unlocks the most remaining uncovered length.
 */
function anchoredSeedScore(segment: PlanSegment, start: Position, graph: StreetGraph): number {
  const ends = endsOf(segment);
  const distStart = distanceMeters(start, ends.start);
  const distEnd = distanceMeters(start, ends.end);
  const nearDist = Math.min(distStart, distEnd);
  const nodes = graph.segmentNodes.get(segment.id);
  if (!nodes) return -nearDist;
  const enterAtStart = distStart <= distEnd;
  const farNode = enterAtStart ? nodes.end : nodes.start;
  const used = new Set<number>([segment.id]);
  return unusedUncoveredLengthAt(graph, farNode, used) * 10 + segment.lengthMeters - nearDist;
}

function isSeedReachableFrom(
  graph: StreetGraph,
  fromNode: NodeId,
  segment: PlanSegment,
): boolean {
  const nodes = graph.segmentNodes.get(segment.id);
  if (!nodes) return false;
  const blocked = new Set<number>([segment.id]);
  return (
    shortestPath(graph, fromNode, nodes.start, blocked, MAX_START_CONNECTOR_METERS) != null ||
    shortestPath(graph, fromNode, nodes.end, blocked, MAX_START_CONNECTOR_METERS) != null
  );
}

function pickAnchoredSeed(
  uncovered: PlanSegment[],
  start: Position,
  salt: number,
  graph: StreetGraph,
  snapNode: NodeId,
): PlanSegment | null {
  const reachable = uncovered.filter((segment) => isSeedReachableFrom(graph, snapNode, segment));
  if (reachable.length === 0) return null;
  const componentMeters = indexUncoveredComponentMeters(graph, reachable);
  const ranked = [...reachable].sort((a, b) => {
    const componentDelta = (componentMeters.get(b.id) ?? 0) - (componentMeters.get(a.id) ?? 0);
    if (componentDelta !== 0) return componentDelta;
    const scoreDelta = anchoredSeedScore(b, start, graph) - anchoredSeedScore(a, start, graph);
    if (scoreDelta !== 0) return scoreDelta;
    return a.id - b.id;
  });
  return pickFromWindow(ranked, ANCHORED_SEED_CHOICES, salt);
}

function nearestNode(
  graph: StreetGraph,
  point: Position,
  maxDistanceMeters = Infinity,
): { node: NodeId; distanceMeters: number } | null {
  let best: NodeId | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const dist = distanceMeters(point, graph.nodes[i]!);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  if (best == null || bestDist > maxDistanceMeters) return null;
  return { node: best, distanceMeters: bestDist };
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
 * Walk the street graph into one continuous outing sized to `budgetMeters`.
 * Prefers unfinished streets in dense remaining pockets; bridges through covered streets
 * only to reach more unexplored length; fills with already-run streets last so distance still matches.
 * Stays strictly on OSM / connector edges — never invents aerial shortcuts through blocks.
 * Long continuous OSM LineStrings are walked in full (any length is fine when on-network).
 */
export function buildRunPlanRoute(segments: readonly PlanSegment[], options: RunPlanRouteOptions): RunPlanRoute {
  const budgetMeters = Math.max(0, options.budgetMeters);
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

  let seed: PlanSegment;
  let snapNode: NodeId | null = null;
  if (anchor) {
    const snap = nearestNode(graph, anchor, MAX_ANCHOR_SNAP_METERS);
    if (snap == null) return emptyRoute();
    snapNode = snap.node;
    const anchored = pickAnchoredSeed(uncovered, anchor, salt, graph, snap.node);
    if (anchored == null) return emptyRoute();
    seed = anchored;
  } else {
    seed = pickSeed(uncovered, metersByCell, salt, graph);
  }

  // Prefer the exit that unlocks more unfinished street (avoids walking into a cul-de-sac).
  // Anchored starts instead enter at the end nearer the athlete so the approach stays on-network.
  const seedNodes = graph.segmentNodes.get(seed.id);
  const seedUsed = new Set<number>([seed.id]);
  const forwardUnlock = seedNodes == null ? 0 : unusedUncoveredLengthAt(graph, seedNodes.end, seedUsed);
  const reverseUnlock = seedNodes == null ? 0 : unusedUncoveredLengthAt(graph, seedNodes.start, seedUsed);
  let startAtFirst = forwardUnlock >= reverseUnlock;
  if (anchor) {
    const seedEnds = endsOf(seed);
    startAtFirst = distanceMeters(seedEnds.start, anchor) <= distanceMeters(seedEnds.end, anchor);
  } else if (forwardUnlock === reverseUnlock) {
    const seedEnds = endsOf(seed);
    startAtFirst = distanceMeters(seedEnds.start, focus) >= distanceMeters(seedEnds.end, focus);
  }

  const used = new Set<number>();
  /** Uncovered meters credited once — fill may rewalk streets without inflating conquest %. */
  const creditedUncovered = new Set<number>();
  const coords: Position[] = [];
  const legs: RunPlanLeg[] = [];
  let uncoveredMeters = 0;
  let pathMeters = 0;
  let head = 0;
  let tail = 0;
  let lastHeadSegmentId: number | null = null;
  let lastTailSegmentId: number | null = null;

  function pushLeg(coordinates: Position[], kind: PlanLegKind) {
    const clean = dedupe(coordinates);
    if (clean.length < 2) return;
    const last = legs[legs.length - 1];
    if (last && last.kind === kind) {
      last.coordinates = dedupe([...last.coordinates, ...clean]);
      return;
    }
    legs.push({ coordinates: clean, kind });
  }

  function creditUncovered(segmentId: number, lengthMeters: number) {
    if (creditedUncovered.has(segmentId)) return;
    creditedUncovered.add(segmentId);
    uncoveredMeters += lengthMeters;
  }

  function appendConnectorEdges(connector: DirectedEdge[]) {
    for (let index = 0; index < connector.length; index++) {
      const edge = connector[index]!;
      used.add(edge.segmentId);
      pathMeters += edge.lengthMeters;
      if (isConquestEdge(edge)) creditUncovered(edge.segmentId, edge.lengthMeters);
      if (index === 0 && coords.length === 0) {
        coords.push(...edge.coordinates);
        pushLeg(edge.coordinates, legKindForEdge(edge));
      } else {
        const pieceStart = coords[coords.length - 1]!;
        coords.push(...edge.coordinates.slice(1));
        pushLeg([pieceStart, ...edge.coordinates.slice(1)], legKindForEdge(edge));
      }
    }
  }

  function applySeed(startAtFirstOrientation: boolean) {
    const seedCoords = startAtFirstOrientation ? seed.coordinates : [...seed.coordinates].reverse();
    const entryNode = seedNodes == null ? 0 : startAtFirstOrientation ? seedNodes.start : seedNodes.end;
    const exitNode = seedNodes == null ? 0 : startAtFirstOrientation ? seedNodes.end : seedNodes.start;
    used.add(seed.id);
    creditUncovered(seed.id, seed.lengthMeters);
    pathMeters += seed.lengthMeters;
    head = exitNode;
    tail = entryNode;

    const seedLegStart = coords[coords.length - 1];
    if (seedLegStart) {
      // Connector already ends at the seed entry — continue along seed geometry without a chord.
      if (distanceMeters(seedLegStart, seedCoords[0]!) > joinToleranceMeters) {
        return false;
      }
      coords.push(...seedCoords.slice(1));
      pushLeg([seedLegStart, ...seedCoords.slice(1)], "conquest");
    } else {
      coords.push(...seedCoords);
      pushLeg(seedCoords, "conquest");
    }
    return true;
  }

  if (anchor) {
    // Snap + on-network walk to a reachable seed — never GPS→seed aerial chords.
    if (snapNode == null || seedNodes == null) return emptyRoute();

    // Prefer unlock orientation when reachable; otherwise flip so the entry faces the athlete.
    // Seed is blocked during the approach so the connector cannot "walk the seed" then add it again.
    const approachBlocked = new Set<number>([seed.id]);
    const orientations = startAtFirst ? [true, false] : [false, true];
    let connected = false;
    for (const orientation of orientations) {
      const entryNode = orientation ? seedNodes.start : seedNodes.end;
      const connector = shortestPath(
        graph,
        snapNode,
        entryNode,
        approachBlocked,
        MAX_START_CONNECTOR_METERS,
      );
      if (connector == null) continue;
      appendConnectorEdges(connector);
      if (!applySeed(orientation)) {
        return emptyRoute();
      }
      connected = true;
      break;
    }
    if (!connected) return emptyRoute();
  } else {
    if (!applySeed(startAtFirst)) return emptyRoute();
  }

  function appendEdge(edge: DirectedEdge, end: "head" | "tail") {
    used.add(edge.segmentId);
    pathMeters += edge.lengthMeters;
    if (isConquestEdge(edge)) creditUncovered(edge.segmentId, edge.lengthMeters);
    const kind = legKindForEdge(edge);
    if (end === "head") {
      const tip = coords[coords.length - 1]!;
      coords.push(...edge.coordinates.slice(1));
      pushLeg([tip, ...edge.coordinates.slice(1)], kind);
      head = edge.to;
      lastHeadSegmentId = edge.segmentId;
    } else {
      const tip = coords[0]!;
      coords.unshift(...edge.coordinates.slice(1).reverse());
      pushLeg([...edge.coordinates.slice(1).reverse(), tip], kind);
      // Prepended legs stay readable if we keep them in path order at the front.
      const prepended = legs.pop()!;
      legs.unshift(prepended);
      tail = edge.to;
      lastTailSegmentId = edge.segmentId;
    }
  }

  function extendConquest(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0) return false;
    const node = end === "head" ? head : tail;
    const edges = graph.outgoing.get(node) ?? [];

    const uncoveredEdge = pickUncoveredEdge(edges, used, graph);
    if (uncoveredEdge && uncoveredEdge.lengthMeters <= remaining + 80) {
      appendEdge(uncoveredEdge, end);
      return true;
    }

    const bridge = findBridgeToUncovered(graph, node, used, Math.min(maxBridgeMeters, remaining));
    if (bridge != null) {
      const bridgeMeters = bridge.reduce((sum, edge) => sum + edge.lengthMeters, 0);
      if (bridgeMeters <= remaining) {
        let cursor = node;
        for (const hop of bridge) {
          appendEdge(hop, end);
          cursor = hop.to;
          if (pathMeters >= budgetMeters) return true;
        }
        const nextUncovered = pickUncoveredEdge(graph.outgoing.get(cursor) ?? [], used, graph);
        if (nextUncovered && nextUncovered.lengthMeters <= budgetMeters - pathMeters + 80) {
          appendEdge(nextUncovered, end);
          return true;
        }
        if (bridge.length > 0) return true;
      }
    }

    return false;
  }

  function extendFill(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0) return false;
    const node = end === "head" ? head : tail;
    const edges = graph.outgoing.get(node) ?? [];
    const avoid = end === "head" ? lastHeadSegmentId : lastTailSegmentId;

    // Prefer covered streets and avoid immediate U-turns when another edge exists.
    const local = pickAnyUnusedEdge(edges, used, false, avoid);
    if (local && local.lengthMeters <= remaining + 80) {
      appendEdge(local, end);
      return true;
    }

    const fill = findCoveredFillPath(graph, node, used, remaining);
    if (!fill || fill.length === 0) return false;
    for (const hop of fill) {
      if (pathMeters >= budgetMeters) break;
      if (hop.lengthMeters > budgetMeters - pathMeters + 80) break;
      appendEdge(hop, end);
    }
    return true;
  }

  // An anchored route keeps its tail at the athlete, so only the head grows.
  const growTail = !anchor;

  // Phase 1 — conquest: unfinished streets and covered / connector bridges only (no aerial hops).
  let grew = true;
  let guard = 0;
  while (grew && pathMeters < budgetMeters && guard < 30_000) {
    guard += 1;
    const grewHead = extendConquest("head");
    const grewTail = growTail && pathMeters < budgetMeters ? extendConquest("tail") : false;
    grew = grewHead || grewTail;
  }

  // Phase 2 — fill remaining budget.
  // Conquest often ends at cul-de-sac tips of a small unfinished pocket; the exit onto the
  // wider (covered) network sits mid-path. Clearing `used` lets fill walk back through the
  // pocket and into the city graph so 5 / 8 / 12 km preferences can be met. Uncovered meters
  // stay credited once via `creditedUncovered`.
  used.clear();
  const fillTarget = budgetMeters * 0.97;
  let fillRounds = 0;
  const maxFillRounds = 12;
  while (pathMeters < fillTarget && fillRounds < maxFillRounds && guard < 160_000) {
    grew = true;
    let progressed = false;
    while (grew && pathMeters < fillTarget && guard < 160_000) {
      guard += 1;
      const grewHead = extendFill("head");
      const grewTail = growTail && pathMeters < fillTarget ? extendFill("tail") : false;
      grew = grewHead || grewTail;
      if (grew) progressed = true;
    }
    if (pathMeters >= fillTarget) break;
    if (!progressed) break;
    used.clear();
    fillRounds += 1;
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
    jumpCount: 0,
    jumpMeters: 0,
    legs,
  };
}

export function runPlanRouteToGeoJson(
  route: RunPlanRoute,
  areaId: number,
): FeatureCollection<LineString, { areaId: number; kind: PlanLegKind | "route" }> {
  // Prefer one continuous LineString — fragmented legs made the map look broken.
  if (route.coordinates.length >= 2) {
    const feature: Feature<LineString, { areaId: number; kind: "route" }> = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: route.coordinates },
      properties: { areaId, kind: "route" },
    };
    return { type: "FeatureCollection", features: [feature] };
  }
  return { type: "FeatureCollection", features: [] };
}
