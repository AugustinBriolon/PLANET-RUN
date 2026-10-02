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
  /** Full path length including covered bridges and fill. */
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
  /**
   * Diversifies the start among central uncovered streets.
   * Same salt → same route; change it on regenerate for a different outing.
   */
  salt?: number;
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
  return Math.min(800, Math.max(160, budgetMeters * 0.08));
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

  return { nodes, outgoing, segmentNodes };
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
      if (!edge.covered) continue;
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

function pickAnyUnusedEdge(
  edges: DirectedEdge[],
  usedSegments: ReadonlySet<number>,
  preferUncovered: boolean,
): DirectedEdge | null {
  const unused = edges.filter((edge) => !usedSegments.has(edge.segmentId));
  if (unused.length === 0) return null;
  const pool = preferUncovered ? unused.filter((edge) => !edge.covered) : unused;
  const candidates = pool.length > 0 ? pool : unused;
  return candidates.reduce((best, edge) => (edge.lengthMeters > best.lengthMeters ? edge : best));
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
 * within a distance that scales with the outing budget.
 */
function findProximityUncovered(
  fromPoint: Position,
  fromNode: NodeId,
  segments: readonly PlanSegment[],
  graph: StreetGraph,
  usedSegments: ReadonlySet<number>,
  maxJumpMeters: number,
): ProximityJump | null {
  let best: ProximityJump | null = null;

  for (const segment of segments) {
    if (segment.covered || usedSegments.has(segment.id) || segment.coordinates.length < 2) continue;
    const nodes = graph.segmentNodes.get(segment.id);
    if (!nodes) continue;
    const ends = endsOf(segment);
    const distStart = distanceMeters(fromPoint, ends.start);
    const distEnd = distanceMeters(fromPoint, ends.end);

    if (distStart <= maxJumpMeters && (best == null || distStart < best.jumpMeters)) {
      best = {
        segment,
        coordinates: segment.coordinates,
        fromNode: nodes.start,
        toNode: nodes.end,
        jumpMeters: distStart,
      };
    }
    if (distEnd <= maxJumpMeters && (best == null || distEnd < best.jumpMeters)) {
      best = {
        segment,
        coordinates: [...segment.coordinates].reverse(),
        fromNode: nodes.end,
        toNode: nodes.start,
        jumpMeters: distEnd,
      };
    }
  }

  // Avoid no-op jumps that land on the same graph node without moving.
  if (best && best.fromNode === fromNode && best.jumpMeters < 1) return null;
  return best;
}

function pickSeed(uncovered: PlanSegment[], focus: Position, salt: number): PlanSegment {
  const ranked = [...uncovered].sort(
    (a, b) =>
      distanceMeters(midpoint(a.coordinates), focus) - distanceMeters(midpoint(b.coordinates), focus),
  );
  const window = Math.min(12, ranked.length);
  const index = ((salt % window) + window) % window;
  return ranked[index]!;
}

/**
 * Walk the street graph into one continuous outing sized to `budgetMeters`.
 * Prefers unfinished streets; bridges through covered streets; when conquest streets
 * run out, keeps filling with covered network so 5 km and 30 km actually differ.
 */
export function buildRunPlanRoute(
  segments: readonly PlanSegment[],
  options: RunPlanRouteOptions,
): RunPlanRoute {
  const budgetMeters = Math.max(0, options.budgetMeters);
  const joinToleranceMeters = options.joinToleranceMeters ?? DEFAULT_JOIN_TOLERANCE_METERS;
  const maxBridgeMeters = bridgeBudgetMeters(budgetMeters, options.maxBridgeMeters);
  const maxJumpMeters = Math.min(1_200, Math.max(maxBridgeMeters, budgetMeters * 0.05));
  const salt = options.salt ?? 0;

  const uncovered = segments.filter((segment) => !segment.covered && segment.coordinates.length >= 2);
  if (uncovered.length === 0 || budgetMeters <= 0) {
    return { coordinates: [], uncoveredMeters: 0, pathMeters: 0, start: null };
  }

  const focus = centroidOf(uncovered.map((segment) => midpoint(segment.coordinates)));
  const graph = buildStreetGraph(segments, joinToleranceMeters);
  const seed = pickSeed(uncovered, focus, salt);

  const seedEnds = endsOf(seed);
  const startAtFirst =
    distanceMeters(seedEnds.start, focus) >= distanceMeters(seedEnds.end, focus);
  const seedCoords = startAtFirst ? seed.coordinates : [...seed.coordinates].reverse();
  const seedNodes = graph.segmentNodes.get(seed.id);

  const used = new Set<number>([seed.id]);
  const coords: Position[] = [...seedCoords];
  let head =
    seedNodes == null
      ? 0
      : startAtFirst
        ? seedNodes.end
        : seedNodes.start;
  let tail =
    seedNodes == null
      ? 0
      : startAtFirst
        ? seedNodes.start
        : seedNodes.end;
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

  function appendJump(jump: ProximityJump, end: "head" | "tail") {
    const tip = end === "head" ? coords[coords.length - 1]! : coords[0]!;
    const entry = jump.coordinates[0]!;
    if (tip[0] !== entry[0] || tip[1] !== entry[1]) {
      const gap = distanceMeters(tip, entry);
      pathMeters += gap;
      if (end === "head") coords.push(entry);
      else coords.unshift(entry);
    }
    used.add(jump.segment.id);
    pathMeters += jump.segment.lengthMeters;
    uncoveredMeters += jump.segment.lengthMeters;
    if (end === "head") {
      coords.push(...jump.coordinates.slice(1));
      head = jump.toNode;
    } else {
      coords.unshift(...jump.coordinates.slice(1).reverse());
      tail = jump.toNode;
    }
  }

  function extendConquest(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0) return false;
    const node = end === "head" ? head : tail;
    const tip = end === "head" ? coords[coords.length - 1]! : coords[0]!;
    const edges = graph.outgoing.get(node) ?? [];

    const uncoveredEdge = pickUncoveredEdge(edges, used, focus);
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
        const nextUncovered = pickUncoveredEdge(graph.outgoing.get(cursor) ?? [], used, focus);
        if (nextUncovered && nextUncovered.lengthMeters <= budgetMeters - pathMeters + 80) {
          appendEdge(nextUncovered, end);
          return true;
        }
        if (bridge.length > 0) return true;
      }
    }

    const jump = findProximityUncovered(
      tip,
      node,
      segments,
      graph,
      used,
      Math.min(maxJumpMeters, remaining),
    );
    if (jump && jump.segment.lengthMeters + jump.jumpMeters <= remaining + 80) {
      appendJump(jump, end);
      return true;
    }

    return false;
  }

  function extendFill(end: "head" | "tail"): boolean {
    const remaining = budgetMeters - pathMeters;
    if (remaining <= 0) return false;
    const node = end === "head" ? head : tail;
    const edges = graph.outgoing.get(node) ?? [];

    const local = pickAnyUnusedEdge(edges, used, false);
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

  // Phase 1 — conquest: unfinished streets, covered bridges, proximity hops.
  let grew = true;
  let guard = 0;
  while (grew && pathMeters < budgetMeters && guard < 30_000) {
    guard += 1;
    const grewHead = extendConquest("head");
    const grewTail = pathMeters < budgetMeters ? extendConquest("tail") : false;
    grew = grewHead || grewTail;
  }

  // Phase 2 — fill: burn remaining budget on covered streets so distance preference matters.
  grew = true;
  while (grew && pathMeters < budgetMeters * 0.92 && guard < 60_000) {
    guard += 1;
    const grewHead = extendFill("head");
    const grewTail = pathMeters < budgetMeters * 0.92 ? extendFill("tail") : false;
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
