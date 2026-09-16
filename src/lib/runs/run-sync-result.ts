export type RunSyncFailureReason =
  "missing-permission" | "strava-unavailable" | "rate-limited" | "session-expired" | "unknown";

export type RunSyncFailure = { reason: RunSyncFailureReason; message: string };

export type RunSyncActionResult = { status: "success"; syncedRuns: number } | ({ status: "error" } & RunSyncFailure);
