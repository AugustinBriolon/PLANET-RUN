import polyline from "@mapbox/polyline";
import type { Feature, FeatureCollection, LineString, Point, Position } from "geojson";

import type { RunSummary } from "./run-summary";

export type RunFeatureProperties = {
  id: number;
  name: string;
  distanceMeters: number;
};

export type RunTraces = FeatureCollection<LineString, RunFeatureProperties>;
export type RunStartPoints = FeatureCollection<Point, RunFeatureProperties>;
export type LngLatBounds = [[number, number], [number, number]];

function toProperties(run: RunSummary): RunFeatureProperties {
  return { id: run.id, name: run.name, distanceMeters: run.distanceMeters };
}

// Encoded polylines are [lat, lng]; GeoJSON expects [lng, lat].
function decodeToPositions(encoded: string): Position[] {
  return polyline.decode(encoded).map(([latitude, longitude]) => [longitude, latitude]);
}

export function toRunTraces(runs: RunSummary[]): RunTraces {
  const features = runs.flatMap((run): Feature<LineString, RunFeatureProperties>[] => {
    const coordinates = decodeToPositions(run.polyline);
    if (coordinates.length < 2) return [];
    return [{ type: "Feature", geometry: { type: "LineString", coordinates }, properties: toProperties(run) }];
  });
  return { type: "FeatureCollection", features };
}

export function toRunStartPoints(traces: RunTraces): RunStartPoints {
  return {
    type: "FeatureCollection",
    features: traces.features.map((trace) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: trace.geometry.coordinates[0]! },
      properties: trace.properties,
    })),
  };
}

export function getTracesBounds(traces: RunTraces): LngLatBounds | null {
  const positions = traces.features.flatMap((trace) => trace.geometry.coordinates);
  if (positions.length === 0) return null;

  const longitudes = positions.map(([longitude]) => longitude!);
  const latitudes = positions.map(([, latitude]) => latitude!);
  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)],
  ];
}
