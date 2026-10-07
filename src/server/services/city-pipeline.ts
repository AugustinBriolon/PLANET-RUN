import "server-only";

import { after } from "next/server";

import { getServices } from "@/server/services";

/**
 * Continues a first-history Strava import (one page per hop), then discovers cities and drains
 * this runner's street imports. Each hop is an `after()` so serverless time limits are respected.
 */
export function scheduleHistoryThenCities(userId: string) {
  after(async () => {
    try {
      const result = await getServices().runSync.syncRuns(userId);
      if (result.continues) {
        scheduleHistoryThenCities(userId);
        return;
      }
      scheduleCityPipeline(userId);
    } catch (error) {
      console.error("History sync continuation failed", error);
    }
  });
}

/**
 * Discovers cities for a user, rematches a batch of runs, tries one shared street import, and
 * notifies when discovery, matching, and this runner's queued cities are done.
 */
export function scheduleCityPipeline(userId: string) {
  after(async () => {
    try {
      const { cityDetection, cityImportQueue, analysisNotify, accounts, coverage } = getServices();
      const discovery = await cityDetection.discoverCitiesForUser(userId);
      // Discovery already rematches one batch; call again so a hop still advances when discovery
      // finds nothing new but coverage_matched_at rows remain (e.g. after migration 0007).
      await coverage.matchPendingActivities({ userId }).catch((error: unknown) => console.error(error));
      await getServices().conquest.refreshForUser(userId);
      await cityImportQueue.processNext();
      const stillMatching = await coverage.hasPendingMatch({ userId });
      const stillWorking =
        discovery.continues || stillMatching || (await cityImportQueue.hasWorkForUser(userId));
      if (stillWorking) {
        scheduleCityPipeline(userId);
        return;
      }
      const account = await accounts.findByUserId(userId);
      if (account?.lastSyncedAt) {
        await analysisNotify.notifyIfPending(userId);
      }
    } catch (error) {
      console.error("City pipeline failed", error);
    }
  });
}
