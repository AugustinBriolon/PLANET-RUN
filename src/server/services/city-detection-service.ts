import polyline from "@mapbox/polyline";

import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { NominatimClient } from "@/server/osm/nominatim-client";
import type { OverpassClient } from "@/server/osm/overpass-client";
import { createCityImportService } from "./city-import-service";

export type CityDetectionService = {
  /** Analyzes a user's run traces, detects cities via reverse-geocoding, imports missing ones, and re-matches runs. Returns count of new cities imported. */
  detectAndImportCitiesForUser: (userId: string) => Promise<number>;
};

type Dependencies = {
  activities: ActivityRepository;
  areas: AreaRepository;
  coverage: CoverageRepository;
  nominatim: NominatimClient;
  overpass: OverpassClient;
};

export function createCityDetectionService({
  activities,
  areas,
  coverage,
  nominatim,
  overpass,
}: Dependencies): CityDetectionService {
  const importService = createCityImportService({ areas, overpass, coverage });

  return {
    async detectAndImportCitiesForUser(userId) {
      // Fetch all user runs
      const runs = await activities.listByUser(userId);
      if (runs.length === 0) return 0;

      // Decode polylines and extract start points
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

      if (startPoints.length === 0) return 0;

      // Reverse-geocode start points to find cities
      const detectedCities = new Map<number, string>(); // osmRelationId → name
      for (const point of startPoints) {
        console.log(`[city-detection] geocoding [${point.lat}, ${point.lon}]`);
        const result = await nominatim.reverseGeocode(point.lat, point.lon);
        if (result && !detectedCities.has(result.osmRelationId)) {
          detectedCities.set(result.osmRelationId, result.name);
        }
      }

      if (detectedCities.size === 0) return 0;

      // Fetch existing cities
      const existingAreas = await areas.listAll();
      const existingCityIds = new Set(existingAreas.map((a) => a.osmRelationId));

      // Import missing cities
      let importedCount = 0;
      for (const [osmRelationId, name] of detectedCities) {
        if (!existingCityIds.has(osmRelationId)) {
          try {
            await importService.importCity(osmRelationId);
            importedCount++;
          } catch (error) {
            // Log but don't fail; continue with other cities
            console.error(`Failed to import city ${osmRelationId} (${name}):`, error);
          }
        }
      }

      // Re-match all runs after new cities are imported
      if (importedCount > 0) {
        await coverage.matchPendingActivities({ userId });
      }

      return importedCount;
    },
  };
}
