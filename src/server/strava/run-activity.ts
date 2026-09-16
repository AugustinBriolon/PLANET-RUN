import type { NewActivity } from "@/server/db/schema";

import type { StravaActivity } from "./strava-types";

// VirtualRun is excluded: treadmill sessions have no real-world trace.
const OUTDOOR_RUN_SPORT_TYPES = new Set(["Run", "TrailRun"]);

export function isMappableRun(activity: StravaActivity): boolean {
  return OUTDOOR_RUN_SPORT_TYPES.has(activity.sport_type) && Boolean(activity.map.summary_polyline);
}

export function toActivityRecord(activity: StravaActivity, userId: string): NewActivity {
  return {
    stravaActivityId: activity.id,
    userId,
    name: activity.name,
    sportType: activity.sport_type,
    startDate: new Date(activity.start_date),
    distanceMeters: activity.distance,
    movingTimeSeconds: activity.moving_time,
    elevationGainMeters: activity.total_elevation_gain,
    summaryPolyline: activity.map.summary_polyline ?? "",
  };
}
