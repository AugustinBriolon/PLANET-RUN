import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CityImportQueueRepository } from "@/server/repositories/city-import-queue-repository";
import type { OverpassClient } from "@/server/osm/overpass-client";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

import { createCityImportService } from "./city-import-service";

export type CityImportQueueResult = {
  imported: boolean;
  cityName: string | null;
  hasMore: boolean;
};

export type CityImportQueueService = {
  /** Imports the next queued city into the shared street tables (or skips if another job already did). */
  processNext: () => Promise<CityImportQueueResult>;
};

type Dependencies = {
  areas: AreaRepository;
  importQueue: CityImportQueueRepository;
  overpass: OverpassClient;
  coverage: Pick<CoverageRepository, "markAllActivitiesPending" | "matchPendingActivities">;
};

export function createCityImportQueueService({
  areas,
  importQueue,
  overpass,
  coverage,
}: Dependencies): CityImportQueueService {
  const cityImport = createCityImportService({ areas, overpass, coverage });

  return {
    async processNext() {
      const job = await importQueue.claimNext();
      if (!job) return { imported: false, cityName: null, hasMore: false };

      try {
        // Another athlete (or a previous job) may already have filled the shared street cache.
        if (await areas.hasStreetsImported(job.osmRelationId)) {
          await importQueue.complete(job.osmRelationId);
          await coverage.matchPendingActivities().catch((error: unknown) => console.error(error));
          return { imported: false, cityName: job.name, hasMore: await importQueue.hasWork() };
        }

        await cityImport.importCity(job.osmRelationId);
        await importQueue.complete(job.osmRelationId);
        return { imported: true, cityName: job.name, hasMore: await importQueue.hasWork() };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to import city ${job.osmRelationId} (${job.name}):`, error);
        await importQueue.fail(job.osmRelationId, message);
        return { imported: false, cityName: job.name, hasMore: await importQueue.hasWork() };
      }
    },
  };
}
