import type { FeatureCollection, LineString, MultiLineString, Position } from "geojson";

import type { LngLatBounds } from "@/lib/runs/run-geojson";

export type CityCoverage = {
  areaId: number;
  name: string;
  coveredMeters: number;
  totalMeters: number;
  bounds: LngLatBounds;
};

export type CoveredStreets = FeatureCollection<LineString | MultiLineString, { areaId: number }>;

export const NO_COVERED_STREETS: CoveredStreets = { type: "FeatureCollection", features: [] };

/** Covered share of a city's streets, between 0 and 1. */
export function toCoverageShare({ coveredMeters, totalMeters }: Pick<CityCoverage, "coveredMeters" | "totalMeters">): number {
  if (totalMeters <= 0) return 0;
  return Math.min(1, Math.max(0, coveredMeters / totalMeters));
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
