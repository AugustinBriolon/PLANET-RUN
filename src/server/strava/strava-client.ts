import { z } from "zod";

import {
  stravaActivitySchema,
  stravaTokenResponseSchema,
  type StravaActivity,
  type StravaTokenResponse,
} from "./strava-types";

const API_BASE_URL = "https://www.strava.com/api/v3";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const DEAUTHORIZE_URL = "https://www.strava.com/oauth/deauthorize";

export const STRAVA_MAX_PAGE_SIZE = 200;

export type StravaErrorDetail = { resource: string; field: string; code: string };

const stravaErrorBodySchema = z.object({
  errors: z.array(z.object({ resource: z.string(), field: z.string(), code: z.string() })),
});

export class StravaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: StravaErrorDetail[] = [],
  ) {
    super(message);
    this.name = "StravaApiError";
  }

  get isRateLimited() {
    return this.status === 429;
  }

  /** Strava deactivated the API application itself: no athlete action can fix it. */
  get isApplicationInactive() {
    return this.details.some((detail) => detail.resource === "Application" && detail.code === "Inactive");
  }

  get isMissingPermission() {
    return (this.status === 401 || this.status === 403) && !this.isApplicationInactive;
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
  /** Revokes the application's access for the athlete owning the token. */
  deauthorize: (accessToken: string) => Promise<void>;
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
      const errorBody = stravaErrorBodySchema.safeParse(await response.json().catch(() => null));
      const details = errorBody.success ? errorBody.data.errors : [];
      throw new StravaApiError(response.status, `Strava request failed: ${response.status} ${url}`, details);
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

    async deauthorize(accessToken) {
      await request(
        DEAUTHORIZE_URL,
        { method: "POST", body: new URLSearchParams({ access_token: accessToken }) },
        z.unknown(),
      );
    },
  };
}
