import { z } from "zod";

import {
  stravaActivitySchema,
  stravaTokenResponseSchema,
  type StravaActivity,
  type StravaTokenResponse,
} from "./strava-types";

const API_BASE_URL = "https://www.strava.com/api/v3";
const TOKEN_URL = "https://www.strava.com/oauth/token";

export const STRAVA_MAX_PAGE_SIZE = 200;

export class StravaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StravaApiError";
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export type ListActivitiesOptions = {
  afterEpochSeconds?: number;
  page: number;
  perPage: number;
};

export type StravaClient = {
  listActivities: (accessToken: string, options: ListActivitiesOptions) => Promise<StravaActivity[]>;
  getActivity: (accessToken: string, activityId: number) => Promise<StravaActivity>;
  refreshAccessToken: (refreshToken: string) => Promise<StravaTokenResponse>;
};

type StravaClientConfig = {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
};

export function createStravaClient({
  clientId,
  clientSecret,
  fetch: fetchImpl = fetch,
}: StravaClientConfig): StravaClient {
  async function request<T>(url: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const response = await fetchImpl(url, init);
    if (!response.ok) {
      throw new StravaApiError(response.status, `Strava request failed: ${response.status} ${url}`);
    }
    return schema.parse(await response.json());
  }

  const authorized = (accessToken: string): RequestInit => ({
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return {
    listActivities(accessToken, { afterEpochSeconds, page, perPage }) {
      const query = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      if (afterEpochSeconds !== undefined) query.set("after", String(afterEpochSeconds));
      return request(
        `${API_BASE_URL}/athlete/activities?${query}`,
        authorized(accessToken),
        z.array(stravaActivitySchema),
      );
    },

    getActivity(accessToken, activityId) {
      return request(`${API_BASE_URL}/activities/${activityId}`, authorized(accessToken), stravaActivitySchema);
    },

    refreshAccessToken(refreshToken) {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
      return request(TOKEN_URL, { method: "POST", body }, stravaTokenResponseSchema);
    },
  };
}
