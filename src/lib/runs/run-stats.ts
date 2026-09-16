import type { RunSummary } from "./run-summary";

export type RunStats = {
  runCount: number;
  totalDistanceMeters: number;
  totalMovingTimeSeconds: number;
  totalElevationGainMeters: number;
};

export function summarizeRuns(runs: RunSummary[]): RunStats {
  return runs.reduce<RunStats>(
    (stats, run) => ({
      runCount: stats.runCount + 1,
      totalDistanceMeters: stats.totalDistanceMeters + run.distanceMeters,
      totalMovingTimeSeconds: stats.totalMovingTimeSeconds + run.movingTimeSeconds,
      totalElevationGainMeters: stats.totalElevationGainMeters + run.elevationGainMeters,
    }),
    { runCount: 0, totalDistanceMeters: 0, totalMovingTimeSeconds: 0, totalElevationGainMeters: 0 },
  );
}
