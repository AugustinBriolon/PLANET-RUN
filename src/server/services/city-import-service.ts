import type { OverpassClient } from "@/server/osm/overpass-client";
import type { AreaImportResult, AreaRepository } from "@/server/repositories/area-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

export type CityImportResult = AreaImportResult & { name: string; matchedRuns: number };

export type CityImportService = {
  importCity: (osmRelationId: number) => Promise<CityImportResult>;
};

/** Batches per import hop — leftover pending runs continue via the city pipeline. */
const MATCH_BATCHES_PER_IMPORT = 4;

type Dependencies = {
  overpass: OverpassClient;
  areas: AreaRepository;
  coverage: Pick<CoverageRepository, "markActivitiesPendingForArea" | "matchPendingActivities">;
};

export function createCityImportService({ overpass, areas, coverage }: Dependencies): CityImportService {
  return {
    async importCity(osmRelationId) {
      const city = await overpass.fetchCity(osmRelationId);
      // Invalidate only runs that already touched this city — before replaceArea drops their segments.
      await coverage.markActivitiesPendingForArea(osmRelationId);
      const imported = await areas.replaceArea(city);
      let matchedRuns = 0;
      for (let hop = 0; hop < MATCH_BATCHES_PER_IMPORT; hop++) {
        const matched = await coverage.matchPendingActivities();
        matchedRuns += matched;
        if (matched === 0) break;
      }
      return { name: city.name, ...imported, matchedRuns };
    },
  };
}
