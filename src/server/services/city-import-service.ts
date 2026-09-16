import type { OverpassClient } from "@/server/osm/overpass-client";
import type { AreaImportResult, AreaRepository } from "@/server/repositories/area-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

export type CityImportResult = AreaImportResult & { name: string; matchedRuns: number };

export type CityImportService = {
  importCity: (osmRelationId: number) => Promise<CityImportResult>;
};

type Dependencies = {
  overpass: OverpassClient;
  areas: AreaRepository;
  coverage: Pick<CoverageRepository, "markAllActivitiesPending" | "matchPendingActivities">;
};

export function createCityImportService({ overpass, areas, coverage }: Dependencies): CityImportService {
  return {
    async importCity(osmRelationId) {
      const city = await overpass.fetchCity(osmRelationId);
      const imported = await areas.replaceArea(city);
      // Re-importing replaces segment ids, so every existing run is matched again.
      await coverage.markAllActivitiesPending();
      const matchedRuns = await coverage.matchPendingActivities();
      return { name: city.name, ...imported, matchedRuns };
    },
  };
}
