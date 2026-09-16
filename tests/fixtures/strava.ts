import type { StravaActivity } from "@/server/strava/strava-types";

// "_p~iF~ps|U_ulLnnqC_mqNvxq`@" is the reference polyline from Google's documentation.
export const SAMPLE_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

export function buildStravaActivity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 1001,
    athlete: { id: 42 },
    name: "Morning Run",
    sport_type: "Run",
    start_date: "2026-09-01T06:30:00Z",
    distance: 10_000,
    moving_time: 3_000,
    total_elevation_gain: 85,
    map: { summary_polyline: SAMPLE_POLYLINE },
    ...overrides,
  };
}
