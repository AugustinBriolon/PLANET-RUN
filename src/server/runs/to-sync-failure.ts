import type { RunSyncFailure } from "@/lib/runs/run-sync-result";
import { StravaApiError } from "@/server/strava/strava-client";

export const SESSION_EXPIRED_FAILURE: RunSyncFailure = {
  reason: "session-expired",
  message: "Your session has expired. Please sign in again.",
};

export function toSyncFailure(error: unknown): RunSyncFailure {
  if (error instanceof StravaApiError) {
    if (error.isRateLimited) {
      return { reason: "rate-limited", message: "Strava is rate limiting us. Try again in about 15 minutes." };
    }
    if (error.isApplicationInactive) {
      return {
        reason: "strava-unavailable",
        message: "Strava has paused Planet Run's access to activity data. Please try again later.",
      };
    }
    if (error.isMissingPermission) {
      return {
        reason: "missing-permission",
        message: "Strava didn't grant access to your activities. Reconnect and keep activity access enabled.",
      };
    }
  }
  return { reason: "unknown", message: "Syncing with Strava failed. Please try again." };
}
