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
export type DensitySegmentProperties = { density: number };
export type RunDensityTraces = FeatureCollection<LineString, DensitySegmentProperties>;
export type LngLatBounds = [[number, number], [number, number]];

/** Sample spacing along each run before counting how many distinct runs share a cell. */
export const DENSITY_SAMPLE_SPACING_METERS = 40;
/** ~40 m cells near the equator — close enough for summary polylines to stack on shared streets. */
export const DENSITY_CELL_DEGREES = 0.00036;

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

function distanceMeters(from: Position, to: Position): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const [lng1, lat1] = from as [number, number];
  const [lng2, lat2] = to as [number, number];
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function interpolatePosition(from: Position, to: Position, t: number): Position {
  return [from[0]! + (to[0]! - from[0]!) * t, from[1]! + (to[1]! - from[1]!) * t];
}

function sampleLineString(coordinates: Position[], spacingMeters: number): Position[] {
  if (coordinates.length === 0) return [];

  const samples: Position[] = [coordinates[0]!];

  for (let index = 1; index < coordinates.length; index++) {
    const from = coordinates[index - 1]!;
    const to = coordinates[index]!;
    const segmentMeters = distanceMeters(from, to);
    const steps = Math.max(1, Math.ceil(segmentMeters / spacingMeters));
    for (let step = 1; step <= steps; step++) {
      samples.push(interpolatePosition(from, to, step / steps));
    }
  }

  return samples;
}

/**
 * Short line segments colored by how many distinct runs pass through the same cell.
 * Overlapping streets read hotter; one-off loops stay cool — same idea as a classic route heatmap,
 * but rendered as GPX-style traces rather than a blur blob.
 */
export function toDensityTraces(
  traces: RunTraces,
  options: { spacingMeters?: number; cellDegrees?: number } = {},
): RunDensityTraces {
  const spacingMeters = options.spacingMeters ?? DENSITY_SAMPLE_SPACING_METERS;
  const cellDegrees = options.cellDegrees ?? DENSITY_CELL_DEGREES;

  const runsPerCell = new Map<string, Set<number>>();
  const sampledRuns: { runId: number; samples: Position[] }[] = [];

  for (const trace of traces.features) {
    const runId = trace.properties.id;
    const samples = sampleLineString(trace.geometry.coordinates, spacingMeters);
    if (samples.length < 2) continue;
    sampledRuns.push({ runId, samples });
    for (const position of samples) {
      const key = cellKey(position, cellDegrees);
      let visitors = runsPerCell.get(key);
      if (!visitors) {
        visitors = new Set();
        runsPerCell.set(key, visitors);
      }
      visitors.add(runId);
    }
  }

  const features: Feature<LineString, DensitySegmentProperties>[] = [];

  for (const { samples } of sampledRuns) {
    let segmentCoordinates: Position[] = [samples[0]!];
    let segmentDensity = densityAt(samples[0]!, samples[1]!, runsPerCell, cellDegrees);

    for (let index = 1; index < samples.length; index++) {
      const from = samples[index - 1]!;
      const to = samples[index]!;
      const density = densityAt(from, to, runsPerCell, cellDegrees);
      if (density === segmentDensity) {
        segmentCoordinates.push(to);
        continue;
      }
      features.push(densityFeature(segmentCoordinates, segmentDensity));
      segmentCoordinates = [from, to];
      segmentDensity = density;
    }

    features.push(densityFeature(segmentCoordinates, segmentDensity));
  }

  return { type: "FeatureCollection", features };
}

function cellKey(position: Position, cellDegrees: number): string {
  return `${Math.floor(position[0]! / cellDegrees)},${Math.floor(position[1]! / cellDegrees)}`;
}

function densityAt(from: Position, to: Position, runsPerCell: Map<string, Set<number>>, cellDegrees: number): number {
  const midpoint: Position = [(from[0]! + to[0]!) / 2, (from[1]! + to[1]!) / 2];
  return runsPerCell.get(cellKey(midpoint, cellDegrees))?.size ?? 1;
}

function densityFeature(coordinates: Position[], density: number): Feature<LineString, DensitySegmentProperties> {
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: { density },
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
