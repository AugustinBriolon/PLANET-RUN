/** Parameters of the street coverage model; rationale in docs/adr/0008. */
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

/** OpenStreetMap `highway` values counted as runnable public streets. */
export const RUNNABLE_HIGHWAY_TYPES = [
  "primary",
  "secondary",
  "tertiary",
  "unclassified",
  "residential",
  "living_street",
  "pedestrian",
] as const;
