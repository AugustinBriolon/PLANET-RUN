import { vi } from "vitest";

import { StravaApiError, type StravaClient } from "@/server/strava/strava-client";

export function createFakeStravaClient() {
  return {
    listActivities: vi.fn<StravaClient["listActivities"]>().mockResolvedValue([]),
    getActivity: vi.fn<StravaClient["getActivity"]>().mockRejectedValue(new StravaApiError(404, "Not Found")),
    refreshAccessToken: vi.fn<StravaClient["refreshAccessToken"]>().mockResolvedValue({
      access_token: "refreshed-access",
      refresh_token: "refreshed-refresh",
      expires_at: 2_000_000_000,
    }),
  } satisfies StravaClient;
}
