import type { FeatureCollection, LineString, MultiLineString } from "geojson";

export type CityCoverage = {
  areaId: number;
  name: string;
  coveredMeters: number;
  totalMeters: number;
};

export type CoveredStreets = FeatureCollection<LineString | MultiLineString, { areaId: number }>;

export const NO_COVERED_STREETS: CoveredStreets = { type: "FeatureCollection", features: [] };

/** Covered share of a city's streets, between 0 and 1. */
export function toCoverageShare({ coveredMeters, totalMeters }: CityCoverage): number {
  if (totalMeters <= 0) return 0;
  return Math.min(1, Math.max(0, coveredMeters / totalMeters));
}
