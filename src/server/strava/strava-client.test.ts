import { describe, expect, it, vi } from "vitest";

import { buildStravaActivity } from "@tests/fixtures/strava";

import { createStravaClient, StravaApiError } from "./strava-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  const client = createStravaClient({ clientId: "client-id", clientSecret: "client-secret", fetch: fetchMock });
  return { client, fetchMock };
}

describe("createStravaClient", () => {
  it("lists activities with pagination, time filter and bearer token", async () => {
    const { client, fetchMock } = setup(jsonResponse([buildStravaActivity()]));

    const activities = await client.listActivities("access-token", { page: 2, perPage: 200, afterEpochSeconds: 1700 });

    expect(activities).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://www.strava.com/api/v3/athlete/activities?page=2&per_page=200&after=1700");
    expect(init?.headers).toEqual({ Authorization: "Bearer access-token" });
  });

  it("omits the time filter on the first import", async () => {
    const { client, fetchMock } = setup(jsonResponse([]));
    await client.listActivities("token", { page: 1, perPage: 200 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://www.strava.com/api/v3/athlete/activities?page=1&per_page=200");
  });

  it("refreshes tokens with the client credentials", async () => {
    const { client, fetchMock } = setup(jsonResponse({ access_token: "a", refresh_token: "r", expires_at: 99 }));

    await expect(client.refreshAccessToken("old-refresh")).resolves.toEqual({
      access_token: "a",
      refresh_token: "r",
      expires_at: 99,
    });
    const body = fetchMock.mock.calls[0]![1]?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      grant_type: "refresh_token",
      refresh_token: "old-refresh",
    });
  });

  it("exchanges an authorization code for tokens and athlete", async () => {
    const { client, fetchMock } = setup(
      jsonResponse({
        access_token: "a",
        refresh_token: "r",
        expires_at: 99,
        athlete: { id: 42, firstname: "Ada" },
      }),
    );

    await expect(client.exchangeAuthorizationCode("auth-code")).resolves.toMatchObject({
      access_token: "a",
      athlete: { id: 42 },
    });
    const body = fetchMock.mock.calls[0]![1]?.body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({
      client_id: "client-id",
      client_secret: "client-secret",
      code: "auth-code",
      grant_type: "authorization_code",
    });
  });

  it("revokes the athlete's authorization", async () => {
    const { client, fetchMock } = setup(jsonResponse({ access_token: "revoked" }));

    await client.deauthorize("access-token");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://www.strava.com/oauth/deauthorize");
    expect(Object.fromEntries(init?.body as URLSearchParams)).toEqual({ access_token: "access-token" });
  });

  it("uploads a recorded run as a GPX file with a stable external id", async () => {
    const { client, fetchMock } = setup(
      jsonResponse({ id: 77, error: null, status: "Your activity is still being processed.", activity_id: null }, 201),
    );

    const upload = await client.uploadActivity("access-token", {
      gpx: "<gpx/>",
      name: "Rennes conquest",
      externalId: "planet-run-abc",
    });

    expect(upload).toMatchObject({ id: 77, activity_id: null });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://www.strava.com/api/v3/uploads");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ Authorization: "Bearer access-token" });
    const form = init?.body as FormData;
    expect(form.get("data_type")).toBe("gpx");
    expect(form.get("sport_type")).toBe("Run");
    expect(form.get("external_id")).toBe("planet-run-abc");
    expect(await (form.get("file") as Blob).text()).toBe("<gpx/>");
  });

  it("reads an upload's processing status", async () => {
    const { client, fetchMock } = setup(
      jsonResponse({ id: 77, error: null, status: "Your activity is ready.", activity_id: 1234 }),
    );

    await expect(client.getUpload("token", 77)).resolves.toMatchObject({ activity_id: 1234 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://www.strava.com/api/v3/uploads/77");
  });

  it("raises a typed error for rate limiting", async () => {
    const { client } = setup(jsonResponse({ message: "Rate Limit Exceeded" }, 429));
    const error = await client.getActivity("token", 1).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StravaApiError);
    expect((error as StravaApiError).isRateLimited).toBe(true);
  });

  it("keeps Strava's error details to tell an inactive application from a missing permission", async () => {
    const { client } = setup(
      jsonResponse(
        { message: "Forbidden", errors: [{ resource: "Application", field: "Status", code: "Inactive" }] },
        403,
      ),
    );

    const error = (await client
      .listActivities("token", { page: 1, perPage: 200 })
      .catch((caught) => caught)) as StravaApiError;

    expect(error.details).toEqual([{ resource: "Application", field: "Status", code: "Inactive" }]);
    expect(error.isApplicationInactive).toBe(true);
    expect(error.isMissingPermission).toBe(false);
  });

  it("treats a 403 without application error as a missing permission", async () => {
    const { client } = setup(
      jsonResponse(
        {
          message: "Authorization Error",
          errors: [{ resource: "AccessToken", field: "activity:read_permission", code: "missing" }],
        },
        403,
      ),
    );

    const error = (await client.getActivity("token", 1).catch((caught) => caught)) as StravaApiError;

    expect(error.isMissingPermission).toBe(true);
  });

  it("tolerates error responses without a JSON body", async () => {
    const { client } = setup(new Response("Bad Gateway", { status: 502 }));
    const error = (await client.getActivity("token", 1).catch((caught) => caught)) as StravaApiError;
    expect(error).toMatchObject({ status: 502, details: [] });
  });

  it("rejects payloads that do not match the expected shape", async () => {
    const { client } = setup(jsonResponse({ unexpected: true }));
    await expect(client.getActivity("token", 1)).rejects.toThrow();
  });
});
