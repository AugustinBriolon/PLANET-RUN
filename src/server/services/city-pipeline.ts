import "server-only";

import { after } from "next/server";

import { getServices } from "@/server/services";

/**
 * Discovers all cities for a user, then drains the shared street-import queue one city at a time.
 * Chained via `after()` so each serverless invocation stays within time limits.
 */
export function scheduleCityPipeline(userId: string) {
  after(async () => {
    try {
      const { cityDetection, cityImportQueue } = getServices();
      const discovery = await cityDetection.discoverCitiesForUser(userId);
      if (discovery.continues) {
        scheduleCityPipeline(userId);
        return;
      }

      const result = await cityImportQueue.processNext();
      if (result.hasMore) {
        scheduleCityPipeline(userId);
      }
    } catch (error) {
      console.error("City pipeline failed", error);
    }
  });
}
