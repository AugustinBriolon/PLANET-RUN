import { createDatabase } from "../src/server/db/client";
import { PRIORITY_STREET_CITIES } from "../src/server/osm/priority-street-cities";
import { createCityImportQueueRepository } from "../src/server/repositories/city-import-queue-repository";

/**
 * Enqueues priority (large) cities for shared street import. Does not call Overpass itself —
 * drain with `pnpm osm:import-queue`.
 *
 * Usage: DATABASE_URL=... pnpm osm:enqueue-priority-cities
 */
async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is required");

  const database = createDatabase(connectionUrl);
  const importQueue = createCityImportQueueRepository(database);

  try {
    const queued = await importQueue.enqueueMissing(
      PRIORITY_STREET_CITIES.map(({ osmRelationId, name }) => ({ osmRelationId, name })),
    );
    console.log(
      `Enqueued ${queued} priority cities for street import (${PRIORITY_STREET_CITIES.length} candidates; already-imported skipped).`,
    );
    console.log("Next: pnpm osm:import-queue");
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
