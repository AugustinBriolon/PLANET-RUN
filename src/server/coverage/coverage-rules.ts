/** Parameters of the street coverage model; rationale in docs/adr/0008 and 0012. */
export type CoverageRules = {
  /** Streets are split into equal pieces no longer than this. */
  maxSegmentMeters: number;
  /** A run "touches" the parts of a segment within this distance of its trace. */
  matchDistanceMeters: number;
  /** Share of a segment's length that must be touched for it to count as covered. */
  minCoveredShare: number;
};

// A perpendicular crossing touches 2 × 20 m of a ~50 m segment (≈ 0.8): the 0.85 share keeps crossings out
// while a run along the street, even on the far sidewalk, touches the whole segment.
export const COVERAGE_RULES: CoverageRules = {
  maxSegmentMeters: 50,
  matchDistanceMeters: 20,
  minCoveredShare: 0.85,
};

/** OpenStreetMap `highway` values counted toward city coverage %. */
export const RUNNABLE_HIGHWAY_TYPES = [
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
] as const;

/**
 * Pedestrian links imported for navigation only — they bridge run plans without
 * entering the coverage denominator or matching.
 */
export const NAVIGATION_CONNECTOR_HIGHWAY_TYPES = ["footway", "path", "steps"] as const;

/** Highways fetched from Overpass for planning + coverage. */
export const PLAN_HIGHWAY_TYPES = [...RUNNABLE_HIGHWAY_TYPES, ...NAVIGATION_CONNECTOR_HIGHWAY_TYPES] as const;

const RUNNABLE_SET = new Set<string>(RUNNABLE_HIGHWAY_TYPES);

export function countsForCoverage(highway: string): boolean {
  return RUNNABLE_SET.has(highway);
}
