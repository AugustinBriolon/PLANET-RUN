import { createDatabase } from "../src/server/db/client";
import { createOverpassClient } from "../src/server/osm/overpass-client";
import { createAreaRepository } from "../src/server/repositories/area-repository";
import { createCityImportQueueRepository } from "../src/server/repositories/city-import-queue-repository";
import { createCoverageRepository } from "../src/server/repositories/coverage-repository";
import { createCityImportQueueService } from "../src/server/services/city-import-queue-service";

const DEFAULT_DELAY_MS = 5_000;

/**
 * Drains `city_import_queue` with a polite delay between Overpass calls.
 * Usage: DATABASE_URL=... pnpm osm:import-queue [--delay-ms=5000]
 */
async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is required");

  const delayArg = process.argv.find((arg) => arg.startsWith("--delay-ms="));
  const delayMs = delayArg ? Number(delayArg.slice("--delay-ms=".length)) : DEFAULT_DELAY_MS;
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("Invalid --delay-ms value");
  }

  const database = createDatabase(connectionUrl);
  const queue = createCityImportQueueService({
    areas: createAreaRepository(database),
    importQueue: createCityImportQueueRepository(database),
    overpass: createOverpassClient(),
    coverage: createCoverageRepository(database),
  });

  let imported = 0;
  let skipped = 0;

  try {
    for (;;) {
      const result = await queue.processNext();
      if (!result.cityName && !result.hasMore) break;

      if (result.imported) {
        imported += 1;
        console.log(`Imported streets for ${result.cityName}`);
      } else if (result.cityName) {
        skipped += 1;
        console.log(`Skipped ${result.cityName} (already imported or failed this attempt)`);
      }

      if (!result.hasMore) break;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    console.log(`Done. Imported ${imported}, skipped/failed ${skipped}.`);
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
