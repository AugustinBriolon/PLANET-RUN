import polyline from "@mapbox/polyline";

import { clusterPointsByGrid, gridCellKey } from "@/lib/geo/cluster-points";
import type { NominatimClient } from "@/server/osm/nominatim-client";
import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CityCatalogRepository } from "@/server/repositories/city-catalog-repository";
import type { CityImportQueueRepository } from "@/server/repositories/city-import-queue-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";

/** Nominatim lookups per background chunk — keeps each `after()` invocation under serverless limits. */
export const MAX_NOMINATIM_LOOKUPS_PER_CHUNK = 8;

export type CityDiscoveryResult = {
  /** Cities linked to the user in this chunk (known areas + newly geocoded). */
  linkedCities: number;
  /** Cities enqueued for Overpass street import. */
  queuedImports: number;
  /** More start clusters still need geocoding. */
  continues: boolean;
};

export type CityDetectionService = {
  /**
   * Discovers every city the user ran in, links them immediately (no %), and enqueues
   * street imports only for cities missing shared street geometry (`areas` with streets).
   */
  discoverCitiesForUser: (userId: string) => Promise<CityDiscoveryResult>;
};

type Dependencies = {
  activities: ActivityRepository;
  areas: AreaRepository;
  catalog: CityCatalogRepository;
  userCities: UserCityRepository;
  importQueue: CityImportQueueRepository;
  coverage: Pick<CoverageRepository, "matchPendingActivities">;
  nominatim: NominatimClient;
};

function mergeCities(
  ...groups: Array<Array<{ osmRelationId: number; name: string }>>
): Array<{ osmRelationId: number; name: string }> {
  const byId = new Map<number, { osmRelationId: number; name: string }>();
  for (const group of groups) {
    for (const city of group) byId.set(city.osmRelationId, city);
  }
  return [...byId.values()];
}

function extractStartPoints(runs: Array<{ summaryPolyline: string | null }>) {
  const startPoints: Array<{ lat: number; lon: number }> = [];
  for (const run of runs) {
    if (!run.summaryPolyline) continue;
    try {
      const coords = polyline.decode(run.summaryPolyline);
      if (coords.length > 0) {
        const [lat, lon] = coords[0];
        startPoints.push({ lat, lon });
      }
    } catch {
      // Skip runs with invalid polylines
    }
  }
  return startPoints;
}

export function createCityDetectionService({
  activities,
  areas,
  catalog,
  userCities,
  importQueue,
  coverage,
  nominatim,
}: Dependencies): CityDetectionService {
  return {
    async discoverCitiesForUser(userId) {
      const runs = await activities.listByUser(userId);
      if (runs.length === 0) return { linkedCities: 0, queuedImports: 0, continues: false };

      const clustered = clusterPointsByGrid(extractStartPoints(runs));
      if (clustered.length === 0) return { linkedCities: 0, queuedImports: 0, continues: false };

      // Shared caches: streets already imported, or cheap catalog boundaries (no Nominatim).
      const knownCities = mergeCities(
        await areas.findAreasContainingPoints(clustered),
        await catalog.findContainingPoints(clustered),
      );
      await userCities.upsertMany(userId, knownCities);

      const attemptedCells = await userCities.listGeocodeCells(userId);
      const outsideStreets = await areas.filterPointsOutsideAreas(clustered);
      const unknownPoints = (await catalog.filterPointsOutside(outsideStreets)).filter(
        (point) => !attemptedCells.has(gridCellKey(point)),
      );

      const alreadyLinked = new Set((await userCities.listByUser(userId)).map((city) => city.osmRelationId));
      const chunk = unknownPoints.slice(0, MAX_NOMINATIM_LOOKUPS_PER_CHUNK);
      const continues = unknownPoints.length > chunk.length;

      const geocoded: Array<{ osmRelationId: number; name: string }> = [];
      const triedCells: string[] = [];
      for (const point of chunk) {
        triedCells.push(gridCellKey(point));
        const result = await nominatim.reverseGeocode(point.lat, point.lon);
        if (!result || alreadyLinked.has(result.osmRelationId)) continue;
        geocoded.push({ osmRelationId: result.osmRelationId, name: result.name });
        alreadyLinked.add(result.osmRelationId);
      }
      await userCities.markGeocodeCells(userId, triedCells);
      await userCities.upsertMany(userId, geocoded);

      const candidates = mergeCities(knownCities, geocoded);
      const queuedImports = await importQueue.enqueueMissing(candidates);

      // Fast path: match runs against streets already in the shared tables.
      await coverage.matchPendingActivities({ userId }).catch((error: unknown) => console.error(error));

      return {
        linkedCities: candidates.length,
        queuedImports,
        continues,
      };
    },
  };
}
