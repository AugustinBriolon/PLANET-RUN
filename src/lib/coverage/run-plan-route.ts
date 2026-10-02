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
  /** Max length of already-covered bridging between unfinished streets. */
  maxBridgeMeters?: number;
};

const DEFAULT_JOIN_TOLERANCE_METERS = 22;

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

/** Covered-bridge budget scales with the outing so 12 km can hop farther than 5 km. */
export function bridgeBudgetMeters(budgetMeters: number, override?: number): number {
  if (override != null) return override;
  return Math.min(550, Math.max(140, budgetMeters * 0.06));
}

/**
 * Degrees to expand the uncovered-street envelope when fetching the plan graph.
 * Longer outings need a wider street pocket so the walk can keep growing.
 */
export function planPocketExpandDegrees(budgetMeters: number): number {
  const radiusMeters = Math.min(6_000, Math.max(250, budgetMeters * 0.45));
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

type NodeId = number;

type DirectedEdge = {
  segmentId: number;
  from: NodeId;
  to: NodeId;
  lengthMeters: number;
  covered: boolean;
  coordinates: Position[];
};

type StreetGraph = {
  nodes: Position[];
  /** Outgoing directed edges per node. */
  outgoing: Map<NodeId, DirectedEdge[]>;
  segments: readonly PlanSegment[];
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

  // Spatial hash — only compare endpoints in nearby cells (avoids O(n²) on large cities).
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
    if (start === end) continue;
    addEdge({
      segmentId: segment.id,
      from: start,
      to: end,
      lengthMeters: segment.lengthMeters,
      covered: segment.covered,
      coordinates: segment.coordinates,
    });
    addEdge({
      segmentId: segment.id,
      from: end,
      to: start,
      lengthMeters: segment.lengthMeters,
      covered: segment.covered,
      coordinates: [...segment.coordinates].reverse(),
    });
  }

  return { nodes, outgoing, segments };
}

/**
 * Shortest path (by meters) from `from` to any unused uncovered edge tip, walking only unused
 * covered edges — used to bridge between unfinished pockets without breaking continuity.
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

      if (!edge.covered) {
        // Reached an unfinished street — return the covered hops only; caller takes the uncovered edge next.
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

function pickUncoveredEdge(
  edges: DirectedEdge[],
  usedSegments: ReadonlySet<number>,
  focus: Position,
): DirectedEdge | null {
  const unused = edges.filter((edge) => !usedSegments.has(edge.segmentId) && !edge.covered);
  if (unused.length === 0) return null;
  return unused.reduce((best, edge) => {
    const score = edge.lengthMeters - distanceMeters(midpoint(edge.coordinates), focus) * 0.2;
    const bestScore = best.lengthMeters - distanceMeters(midpoint(best.coordinates), focus) * 0.2;
    return score > bestScore ? edge : best;
  });
}

/**
 * Walk the street graph into one continuous outing sized to `budgetMeters`.
 * Prefers unfinished streets; when stuck, bridges through already-covered streets up to a
 * distance-scaled limit so longer outings keep growing instead of freezing on the first pocket.
 */
export function buildRunPlanRoute(
  segments: readonly PlanSegment[],
  options: RunPlanRouteOptions,
): RunPlanRoute {
  const budgetMeters = Math.max(0, options.budgetMeters);
  const joinToleranceMeters = options.joinToleranceMeters ?? DEFAULT_JOIN_TOLERANCE_METERS;
  const maxBridgeMeters = bridgeBudgetMeters(budgetMeters, options.maxBridgeMeters);

  const uncovered = segments.filter((segment) => !segment.covered && segment.coordinates.length >= 2);
  if (uncovered.length === 0 || budgetMeters <= 0) {
    return { coordinates: [], uncoveredMeters: 0, pathMeters: 0, start: null };
  }

  const focus = centroidOf(uncovered.map((segment) => midpoint(segment.coordinates)));
  const graph = buildStreetGraph(segments, joinToleranceMeters);

  const seed = uncovered.reduce((best, segment) =>
    distanceMeters(midpoint(segment.coordinates), focus) < distanceMeters(midpoint(best.coordinates), focus)
      ? segment
      : best,
  );

  // Start at the seed end farther from focus so the first step walks into the pocket.
  const seedEnds = endsOf(seed);
  const startAtFirst =
    distanceMeters(seedEnds.start, focus) >= distanceMeters(seedEnds.end, focus);
  const seedCoords = startAtFirst ? seed.coordinates : [...seed.coordinates].reverse();

  // Resolve seed endpoints to graph nodes.
  function nearestNode(point: Position): NodeId {
    let best = 0;
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

  const used = new Set<number>([seed.id]);
  const coords: Position[] = [...seedCoords];
  let head = nearestNode(seedCoords[seedCoords.length - 1]!);
  let tail = nearestNode(seedCoords[0]!);
  let uncoveredMeters = seed.lengthMeters;
  let pathMeters = seed.lengthMeters;

  function appendEdge(edge: DirectedEdge, end: "head" | "tail") {
    used.add(edge.segmentId);
    pathMeters += edge.lengthMeters;
    if (!edge.covered) uncoveredMeters += edge.lengthMeters;
    if (end === "head") {
      coords.push(...edge.coordinates.slice(1));
      head = edge.to;
    } else {
      coords.unshift(...edge.coordinates.slice(1).reverse());
      tail = edge.to;
    }
  }

  function extend(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0) return false;
    const node = end === "head" ? head : tail;
    const edges = graph.outgoing.get(node) ?? [];

    const uncoveredEdge = pickUncoveredEdge(edges, used, focus);
    if (uncoveredEdge && uncoveredEdge.lengthMeters <= remaining + 50) {
      appendEdge(uncoveredEdge, end);
      return true;
    }

    const bridge = findBridgeToUncovered(graph, node, used, Math.min(maxBridgeMeters, remaining));
    if (bridge == null) return false;

    let bridgeMeters = bridge.reduce((sum, edge) => sum + edge.lengthMeters, 0);
    if (bridgeMeters > remaining) return false;

    // Apply covered hops, then take the uncovered edge waiting at the far end.
    let cursor = node;
    for (const hop of bridge) {
      appendEdge(hop, end);
      cursor = hop.to;
      if (pathMeters >= budgetMeters) return true;
    }
    const nextUncovered = pickUncoveredEdge(graph.outgoing.get(cursor) ?? [], used, focus);
    if (!nextUncovered) return bridge.length > 0;
    if (nextUncovered.lengthMeters > budgetMeters - pathMeters + 50) return bridge.length > 0;
    appendEdge(nextUncovered, end);
    return true;
  }

  let grew = true;
  let guard = 0;
  while (grew && pathMeters < budgetMeters && guard < 20_000) {
    guard += 1;
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
