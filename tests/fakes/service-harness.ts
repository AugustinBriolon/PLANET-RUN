import type { StravaActivity } from "@/server/strava/strava-types";
import { createStravaTokenService } from "@/server/services/strava-token-service";

import { buildStravaActivity } from "../fixtures/strava";

import { createFakeStravaClient } from "./fake-strava-client";
import { createInMemoryCoverageRepository } from "./in-memory-coverage-repository";
import { createInMemoryRepositories } from "./in-memory-repositories";
import { plainTextCipher } from "./plain-text-cipher";

export const HARNESS_NOW = new Date("2026-09-16T12:00:00Z");
export const HARNESS_ATHLETE_ID = 42;

/** Wires in-memory repositories, a fake Strava client and a real token service around one linked athlete. */
export async function createServiceHarness() {
  const repositories = createInMemoryRepositories();
  const now = () => HARNESS_NOW;
  const { coverage } = createInMemoryCoverageRepository(repositories.activityRows, now);
  const strava = createFakeStravaClient();
  const tokens = createStravaTokenService({ accounts: repositories.accounts, strava, cipher: plainTextCipher, now });

  const user = await repositories.accounts.createWithUser(
    { displayName: "Ada", avatarUrl: null },
    {
      athleteId: HARNESS_ATHLETE_ID,
      accessTokenEncrypted: "enc(access)",
      refreshTokenEncrypted: "enc(refresh)",
      tokenExpiresAt: new Date(HARNESS_NOW.getTime() + 60 * 60 * 1000),
    },
  );

  function buildOwnedActivity(overrides: Partial<StravaActivity> = {}) {
    return buildStravaActivity({ athlete: { id: HARNESS_ATHLETE_ID }, ...overrides });
  }

  return { ...repositories, strava, tokens, coverage, now, user, buildOwnedActivity };
}
