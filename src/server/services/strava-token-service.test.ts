import { beforeEach, describe, expect, it } from "vitest";

import { createFakeStravaClient } from "@tests/fakes/fake-strava-client";
import { createInMemoryRepositories } from "@tests/fakes/in-memory-repositories";
import { plainTextCipher } from "@tests/fakes/plain-text-cipher";
import { StravaApiError } from "../strava/strava-client";

import { createStravaTokenService } from "./strava-token-service";

const NOW = new Date("2026-09-16T12:00:00Z");

describe("createStravaTokenService", () => {
  let repositories: ReturnType<typeof createInMemoryRepositories>;
  let strava: ReturnType<typeof createFakeStravaClient>;
  let service: ReturnType<typeof createStravaTokenService>;

  async function linkAccount(tokenExpiresAt: Date) {
    await repositories.accounts.createWithUser(
      { displayName: "Ada", avatarUrl: null },
      { athleteId: 42, accessTokenEncrypted: "enc(access)", refreshTokenEncrypted: "enc(refresh)", tokenExpiresAt },
    );
    return (await repositories.accounts.findByAthleteId(42))!;
  }

  beforeEach(() => {
    repositories = createInMemoryRepositories();
    strava = createFakeStravaClient();
    service = createStravaTokenService({
      accounts: repositories.accounts,
      strava,
      cipher: plainTextCipher,
      now: () => NOW,
    });
  });

  it("encrypts tokens and converts the expiry to a date", () => {
    expect(service.encrypt({ accessToken: "a", refreshToken: "r", expiresAtEpochSeconds: 1_800_000_000 })).toEqual({
      accessTokenEncrypted: "enc(a)",
      refreshTokenEncrypted: "enc(r)",
      tokenExpiresAt: new Date(1_800_000_000 * 1000),
    });
  });

  it("returns the stored access token while it is still fresh", async () => {
    const account = await linkAccount(new Date(NOW.getTime() + 60 * 60 * 1000));
    await expect(service.getValidAccessToken(account)).resolves.toBe("access");
    expect(strava.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("refreshes and persists tokens that are about to expire", async () => {
    const account = await linkAccount(new Date(NOW.getTime() + 60 * 1000));

    await expect(service.getValidAccessToken(account)).resolves.toBe("refreshed-access");

    expect(strava.refreshAccessToken).toHaveBeenCalledWith("refresh");
    expect(await repositories.accounts.findByAthleteId(42)).toMatchObject({
      accessTokenEncrypted: "enc(refreshed-access)",
      refreshTokenEncrypted: "enc(refreshed-refresh)",
    });
  });

  it("confirms a revocation when Strava rejects the refresh token", async () => {
    const account = await linkAccount(NOW);
    strava.refreshAccessToken.mockRejectedValue(new StravaApiError(400, "Bad Request"));
    await expect(service.isAuthorizationRevoked(account)).resolves.toBe(true);
  });

  it("does not treat a working refresh token as revoked", async () => {
    const account = await linkAccount(NOW);
    await expect(service.isAuthorizationRevoked(account)).resolves.toBe(false);
  });

  it("propagates transient Strava failures instead of assuming revocation", async () => {
    const account = await linkAccount(NOW);
    strava.refreshAccessToken.mockRejectedValue(new StravaApiError(503, "Unavailable"));
    await expect(service.isAuthorizationRevoked(account)).rejects.toThrow(StravaApiError);
  });
});
