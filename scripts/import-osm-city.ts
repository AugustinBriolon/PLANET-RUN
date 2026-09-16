import { createDatabase } from "../src/server/db/client";
import { createOverpassClient } from "../src/server/osm/overpass-client";
import { createAreaRepository } from "../src/server/repositories/area-repository";
import { createCoverageRepository } from "../src/server/repositories/coverage-repository";
import { createCityImportService } from "../src/server/services/city-import-service";

/**
 * Imports (or refreshes) cities from OpenStreetMap and re-matches every run against their streets.
 * Usage: pnpm osm:import-city <osm-relation-id> [...more ids]   (Colombes: 91738, La Garenne-Colombes: 91775)
 */
async function main() {
  const relationIds = process.argv.slice(2).map(Number);
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl || relationIds.length === 0 || relationIds.some((id) => !Number.isSafeInteger(id))) {
    throw new Error("Usage: pnpm osm:import-city <osm-relation-id> [...more ids] (with DATABASE_URL set)");
  }

  const database = createDatabase(connectionUrl);
  const cityImport = createCityImportService({
    overpass: createOverpassClient(),
    areas: createAreaRepository(database),
    coverage: createCoverageRepository(database),
  });

  try {
    for (const relationId of relationIds) {
      const { name, segmentCount, streetLengthMeters, matchedRuns } = await cityImport.importCity(relationId);
      const kilometers = (streetLengthMeters / 1000).toFixed(1);
      console.log(`${name}: ${segmentCount} segments, ${kilometers} km of streets, ${matchedRuns} runs matched`);
    }
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
