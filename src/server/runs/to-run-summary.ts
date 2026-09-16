import type { Activity } from "@/server/db/schema";
import type { RunSummary } from "@/lib/runs/run-summary";

export function toRunSummary(activity: Activity): RunSummary {
  return {
    id: activity.stravaActivityId,
    name: activity.name,
    startDate: activity.startDate.toISOString(),
    distanceMeters: activity.distanceMeters,
    movingTimeSeconds: activity.movingTimeSeconds,
    elevationGainMeters: activity.elevationGainMeters,
    polyline: activity.summaryPolyline,
  };
}
