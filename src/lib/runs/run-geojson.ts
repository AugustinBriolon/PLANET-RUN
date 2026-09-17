import polyline from "@mapbox/polyline";
import type { Feature, FeatureCollection, LineString, Point, Position } from "geojson";

import type { LocateCountry } from "./run-stats";
import type { RunSummary } from "./run-summary";

export type RunFeatureProperties = {
  id: number;
  name: string;
  startDate: string;
  distanceMeters: number;
  movingTimeSeconds: number;
};

export type RunTraces = FeatureCollection<LineString, RunFeatureProperties>;
export type RunStartPoints = FeatureCollection<Point, RunFeatureProperties>;
export type LngLatBounds = [[number, number], [number, number]];

function toProperties(run: RunSummary): RunFeatureProperties {
  return {
    id: run.id,
    name: run.name,
    startDate: run.startDate,
    distanceMeters: run.distanceMeters,
    movingTimeSeconds: run.movingTimeSeconds,
  };
}

// Encoded polylines are [lat, lng]; GeoJSON expects [lng, lat].
function decodeToPositions(encoded: string): Position[] {
  return polyline.decode(encoded).map(([latitude, longitude]) => [longitude, latitude]);
}

export function toRunTraces(runs: RunSummary[]): RunTraces {
  const features = runs.flatMap((run): Feature<LineString, RunFeatureProperties>[] => {
    const coordinates = decodeToPositions(run.polyline);
    if (coordinates.length < 2) return [];
    // A top-level feature id (not just properties.id) is what MapLibre's feature-state hover keys on.
    return [
      { type: "Feature", id: run.id, geometry: { type: "LineString", coordinates }, properties: toProperties(run) },
    ];
  });
  return { type: "FeatureCollection", features };
}

export function toRunStartPoints(traces: RunTraces): RunStartPoints {
  return {
    type: "FeatureCollection",
    features: traces.features.map((trace) => ({
      type: "Feature",
      id: trace.id,
      geometry: { type: "Point", coordinates: trace.geometry.coordinates[0]! },
      properties: trace.properties,
    })),
  };
}

function boundsOfPositions(positions: Position[]): LngLatBounds | null {
  if (positions.length === 0) return null;

  const longitudes = positions.map(([longitude]) => longitude!);
  const latitudes = positions.map(([, latitude]) => latitude!);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}

export function getTracesBounds(traces: RunTraces): LngLatBounds | null {
  return boundsOfPositions(traces.features.flatMap((trace) => trace.geometry.coordinates));
}

/**
 * Bounds of the traces starting in whichever country has the most runs — a default entrance view
 * that isn't dragged out to a global bbox by the odd trip abroad. Falls back to null when no
 * trace's start point resolves to a country (e.g. an empty history).
 */
export function getPrimaryCountryBounds(traces: RunTraces, locateCountry: LocateCountry): LngLatBounds | null {
  const countryByTrace = traces.features.map((trace) =>
    locateCountry(trace.geometry.coordinates[0] as [number, number]),
  );

  const runsPerCountry = new Map<string, number>();
  for (const code of countryByTrace) {
    if (code) runsPerCountry.set(code, (runsPerCountry.get(code) ?? 0) + 1);
  }
  if (runsPerCountry.size === 0) return null;

  const [primaryCountry] = [...runsPerCountry.entries()].sort(([, a], [, b]) => b - a)[0]!;

  return boundsOfPositions(
    traces.features
      .filter((_, index) => countryByTrace[index] === primaryCountry)
      .flatMap((trace) => trace.geometry.coordinates),
  );
}
