import { beforeEach, describe, expect, it } from "vitest";

import { createFakeStravaClient } from "@tests/fakes/fake-strava-client";
import { createInMemoryRepositories } from "@tests/fakes/in-memory-repositories";
import { plainTextCipher } from "@tests/fakes/plain-text-cipher";

import { createAccountLinkingService } from "./account-linking-service";
import { createStravaTokenService } from "./strava-token-service";

const signIn = {
  athleteId: 42,
  displayName: "Ada Lovelace",
  avatarUrl: "https://cdn.strava/ada.jpg",
  tokens: { accessToken: "access-1", refreshToken: "refresh-1", expiresAtEpochSeconds: 1_800_000_000 },
};

describe("createAccountLinkingService", () => {
  let repositories: ReturnType<typeof createInMemoryRepositories>;
  let service: ReturnType<typeof createAccountLinkingService>;

  beforeEach(() => {
    repositories = createInMemoryRepositories();
    const tokens = createStravaTokenService({
      accounts: repositories.accounts,
      strava: createFakeStravaClient(),
      cipher: plainTextCipher,
      now: () => new Date(),
    });
    service = createAccountLinkingService({ users: repositories.users, accounts: repositories.accounts, tokens });
  });

  it("creates a user bound to the athlete on first sign-in, storing tokens encrypted", async () => {
    const userId = await service.linkStravaAthlete(signIn);

    expect(await repositories.users.findById(userId)).toMatchObject({ displayName: "Ada Lovelace" });
    expect(await repositories.accounts.findByAthleteId(42)).toMatchObject({
      userId,
      accessTokenEncrypted: "enc(access-1)",
      refreshTokenEncrypted: "enc(refresh-1)",
    });
  });

  it("returns the same user on later sign-ins and rotates tokens and profile", async () => {
    const firstUserId = await service.linkStravaAthlete(signIn);
    const secondUserId = await service.linkStravaAthlete({
      ...signIn,
      displayName: "Ada King",
      tokens: { ...signIn.tokens, accessToken: "access-2" },
    });

    expect(secondUserId).toBe(firstUserId);
    expect(repositories.userRows.size).toBe(1);
    expect(await repositories.users.findById(firstUserId)).toMatchObject({ displayName: "Ada King" });
    expect(await repositories.accounts.findByAthleteId(42)).toMatchObject({ accessTokenEncrypted: "enc(access-2)" });
  });

  it("creates distinct users for distinct athletes", async () => {
    const adaId = await service.linkStravaAthlete(signIn);
    const graceId = await service.linkStravaAthlete({ ...signIn, athleteId: 7, displayName: "Grace Hopper" });
    expect(graceId).not.toBe(adaId);
  });
});
