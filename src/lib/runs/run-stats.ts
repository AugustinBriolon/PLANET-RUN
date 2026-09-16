import type { RunStartPoints } from "./run-geojson";
import type { RunSummary } from "./run-summary";

export type RunStats = {
  runCount: number;
  totalDistanceMeters: number;
  totalMovingTimeSeconds: number;
  countryCount: number;
};

/** Returns an ISO country code for a [longitude, latitude] position, or null outside any country. */
export type LocateCountry = (position: [number, number]) => string | null;

export function countCountries(startPoints: RunStartPoints, locateCountry: LocateCountry): number {
  const countryCodes = startPoints.features
    .map((point) => locateCountry(point.geometry.coordinates as [number, number]))
    .filter((code): code is string => code !== null);
  return new Set(countryCodes).size;
}

export function summarizeRuns(runs: RunSummary[], countryCount: number): RunStats {
  return runs.reduce<RunStats>(
    (stats, run) => ({
      ...stats,
      runCount: stats.runCount + 1,
      totalDistanceMeters: stats.totalDistanceMeters + run.distanceMeters,
      totalMovingTimeSeconds: stats.totalMovingTimeSeconds + run.movingTimeSeconds,
    }),
    { runCount: 0, totalDistanceMeters: 0, totalMovingTimeSeconds: 0, countryCount },
  );
}
