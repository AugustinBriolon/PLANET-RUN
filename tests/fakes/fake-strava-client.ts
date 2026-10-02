import { vi } from "vitest";

import { StravaApiError, type StravaClient } from "@/server/strava/strava-client";

export function createFakeStravaClient() {
  return {
    listActivities: vi.fn<StravaClient["listActivities"]>().mockResolvedValue([]),
    getActivity: vi.fn<StravaClient["getActivity"]>().mockRejectedValue(new StravaApiError(404, "Not Found")),
    exchangeAuthorizationCode: vi.fn<StravaClient["exchangeAuthorizationCode"]>().mockResolvedValue({
      access_token: "exchanged-access",
      refresh_token: "exchanged-refresh",
      expires_at: 2_000_000_000,
      athlete: { id: 42, firstname: "Ada", lastname: "Lovelace" },
    }),
    refreshAccessToken: vi.fn<StravaClient["refreshAccessToken"]>().mockResolvedValue({
      access_token: "refreshed-access",
      refresh_token: "refreshed-refresh",
      expires_at: 2_000_000_000,
    }),
    deauthorize: vi.fn<StravaClient["deauthorize"]>().mockResolvedValue(undefined),
  } satisfies StravaClient;
}
