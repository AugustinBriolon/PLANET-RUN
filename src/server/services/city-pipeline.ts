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
 * Discovers cities for a user, always tries one shared street import, and notifies when this
 * runner's discovery and their queued cities are done.
 */
export function scheduleCityPipeline(userId: string) {
  after(async () => {
    try {
      const { cityDetection, cityImportQueue, analysisNotify, accounts } = getServices();
      const discovery = await cityDetection.discoverCitiesForUser(userId);
      await getServices().conquest.refreshForUser(userId);
      await cityImportQueue.processNext();
      const stillWorking = discovery.continues || (await cityImportQueue.hasWorkForUser(userId));
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
