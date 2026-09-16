import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import { STRAVA_MAX_PAGE_SIZE, type StravaClient } from "@/server/strava/strava-client";
import { isMappableRun, toActivityRecord } from "@/server/strava/run-activity";

import type { StravaTokenService } from "./strava-token-service";

// Watches often upload days after the run: re-scan a window before the last sync.
const RESYNC_OVERLAP_SECONDS = 7 * 24 * 60 * 60;

export type RunSyncResult = { syncedRuns: number };

export type RunSyncService = {
  syncRuns: (userId: string) => Promise<RunSyncResult>;
};

type Dependencies = {
  accounts: StravaAccountRepository;
  activities: ActivityRepository;
  strava: StravaClient;
  tokens: StravaTokenService;
  now: () => Date;
};

export function createRunSyncService({ accounts, activities, strava, tokens, now }: Dependencies): RunSyncService {
  return {
    async syncRuns(userId) {
      const account = await accounts.findByUserId(userId);
      if (!account) throw new Error(`No Strava account linked to user ${userId}`);

      const startedAt = now();
      const accessToken = await tokens.getValidAccessToken(account);
      const afterEpochSeconds = account.lastSyncedAt
        ? Math.floor(account.lastSyncedAt.getTime() / 1000) - RESYNC_OVERLAP_SECONDS
        : undefined;

      let syncedRuns = 0;
      for (let page = 1; ; page++) {
        const batch = await strava.listActivities(accessToken, {
          afterEpochSeconds,
          page,
          perPage: STRAVA_MAX_PAGE_SIZE,
        });
        const runs = batch.filter(isMappableRun).map((activity) => toActivityRecord(activity, userId));
        await activities.upsertMany(runs);
        syncedRuns += runs.length;
        if (batch.length < STRAVA_MAX_PAGE_SIZE) break;
      }

      await accounts.markSynced(account.athleteId, startedAt);
      return { syncedRuns };
    },
  };
}
