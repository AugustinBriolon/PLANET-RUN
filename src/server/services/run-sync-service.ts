import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import type { UserRepository } from "@/server/repositories/user-repository";
import { STRAVA_MAX_PAGE_SIZE, type StravaClient } from "@/server/strava/strava-client";
import { isMappableRun, toActivityRecord } from "@/server/strava/run-activity";

import type { StravaTokenService } from "./strava-token-service";

// Watches often upload days after the run: re-scan a window before the last sync.
const RESYNC_OVERLAP_SECONDS = 7 * 24 * 60 * 60;

/** First-history hops stay short so the mobile client can show traces after one Strava page. */
export const FIRST_HISTORY_PAGES_PER_HOP = 1;

export type RunSyncResult = { syncedRuns: number; continues: boolean };

export type RunSyncService = {
  syncRuns: (userId: string) => Promise<RunSyncResult>;
};

type Dependencies = {
  accounts: StravaAccountRepository;
  activities: ActivityRepository;
  strava: StravaClient;
  tokens: StravaTokenService;
  coverage: Pick<CoverageRepository, "matchPendingActivities">;
  users: Pick<UserRepository, "setAnalysisNotifyPending">;
  now: () => Date;
};

export function createRunSyncService({
  accounts,
  activities,
  strava,
  tokens,
  coverage,
  users,
  now,
}: Dependencies): RunSyncService {
  return {
    async syncRuns(userId) {
      const account = await accounts.findByUserId(userId);
      if (!account) throw new Error(`No Strava account linked to user ${userId}`);

      const startedAt = now();
      const accessToken = await tokens.getValidAccessToken(account);
      const isFirstImport = !account.lastSyncedAt;
      const afterEpochSeconds = account.lastSyncedAt
        ? Math.floor(account.lastSyncedAt.getTime() / 1000) - RESYNC_OVERLAP_SECONDS
        : undefined;

      if (isFirstImport && !account.historySyncPage) {
        await users.setAnalysisNotifyPending(userId, true);
      }

      const startPage = account.historySyncPage ?? 1;
      const pageBudget = isFirstImport || account.historySyncPage ? FIRST_HISTORY_PAGES_PER_HOP : Number.POSITIVE_INFINITY;

      let syncedRuns = 0;
      let lastFetchedPage = startPage - 1;
      for (let offset = 0; offset < pageBudget; offset++) {
        const page = startPage + offset;
        lastFetchedPage = page;
        const batch = await strava.listActivities(accessToken, {
          afterEpochSeconds,
          page,
          perPage: STRAVA_MAX_PAGE_SIZE,
        });
        const runs = batch.filter(isMappableRun).map((activity) => toActivityRecord(activity, userId));
        await activities.upsertMany(runs);
        syncedRuns += runs.length;
        if (batch.length < STRAVA_MAX_PAGE_SIZE) {
          await accounts.markSynced(account.athleteId, startedAt);
          await coverage.matchPendingActivities({ userId }).catch((error: unknown) => console.error(error));
          return { syncedRuns, continues: false };
        }
      }

      if (pageBudget === Number.POSITIVE_INFINITY) {
        await accounts.markSynced(account.athleteId, startedAt);
        await coverage.matchPendingActivities({ userId }).catch((error: unknown) => console.error(error));
        return { syncedRuns, continues: false };
      }

      await accounts.setHistorySyncPage(account.athleteId, lastFetchedPage + 1);
      await coverage.matchPendingActivities({ userId }).catch((error: unknown) => console.error(error));
      return { syncedRuns, continues: true };
    },
  };
}
