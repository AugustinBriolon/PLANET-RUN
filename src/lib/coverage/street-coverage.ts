import type { FeatureCollection, LineString, MultiLineString, Position } from "geojson";

import type { LngLatBounds } from "@/lib/runs/run-geojson";

/**
 * - `pending` — city discovered, shared street geometry not imported yet
 * - `matching` — streets ready, run↔street matching still in flight
 * - `ready` — streets imported and matching caught up
 */
export type CityCoverageStatus = "pending" | "matching" | "ready";

export type CityCoverage = {
  areaId: number;
  name: string;
  status: CityCoverageStatus;
  /**
   * Soft covered length (partial credit, ADR 0013). Used for the displayed %.
   */
  coveredMeters: number;
  /**
   * Hard covered length (segments with touched share ≥ minCoveredShare).
   * Used for 100% conquest titles so soft progress cannot unlock Founder early.
   */
  strictCoveredMeters: number;
  totalMeters: number;
  bounds: LngLatBounds | null;
};

export type CoveredStreets = FeatureCollection<LineString | MultiLineString, { areaId: number; kind?: "route" }>;

export const NO_COVERED_STREETS: CoveredStreets = { type: "FeatureCollection", features: [] };

/** Soft covered share of a city's streets, between 0 and 1. Pending/matching have no share yet. */
export function toCoverageShare({
  status,
  coveredMeters,
  totalMeters,
}: Pick<CityCoverage, "status" | "coveredMeters" | "totalMeters">): number | null {
  if (status === "pending" || status === "matching" || totalMeters <= 0) return null;
  return Math.min(1, Math.max(0, coveredMeters / totalMeters));
}

/** Hard covered share — conquest completion uses this, not the soft display %. */
export function toStrictCoverageShare({
  status,
  strictCoveredMeters,
  totalMeters,
}: Pick<CityCoverage, "status" | "strictCoveredMeters" | "totalMeters">): number | null {
  if (status === "pending" || status === "matching" || totalMeters <= 0) return null;
  return Math.min(1, Math.max(0, strictCoveredMeters / totalMeters));
}

function positionsFromGeometry(geometry: LineString | MultiLineString): Position[] {
  return geometry.type === "LineString" ? geometry.coordinates : geometry.coordinates.flat();
}

/** Bounding box of covered street traces for one city, or null if none. */
export function getCoveredStreetsBounds(streets: CoveredStreets, areaId: number): LngLatBounds | null {
  const positions = streets.features
    .filter((feature) => feature.properties.areaId === areaId)
    .flatMap((feature) => positionsFromGeometry(feature.geometry));
  if (positions.length === 0) return null;

  const longitudes = positions.map(([longitude]) => longitude!);
  const latitudes = positions.map(([, latitude]) => latitude!);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}
