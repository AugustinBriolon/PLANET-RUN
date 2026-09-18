import { createDatabase } from "../src/server/db/client";
import { createOverpassClient, ILE_DE_FRANCE_RELATION_ID } from "../src/server/osm/overpass-client";
import { createCityCatalogRepository } from "../src/server/repositories/city-catalog-repository";

/**
 * Seeds `city_catalog` with Île-de-France commune boundaries (no street segments).
 * Usage: DATABASE_URL=... pnpm osm:seed-idf-catalog
 */
async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is required");

  const database = createDatabase(connectionUrl);
  const overpass = createOverpassClient();
  const catalog = createCityCatalogRepository(database);

  try {
    console.log(`Fetching Île-de-France communes by department (${ILE_DE_FRANCE_RELATION_ID})…`);
    const cities = await overpass.fetchAdminCitiesInRegion(ILE_DE_FRANCE_RELATION_ID);
    console.log(`Parsed ${cities.length} commune boundaries; upserting into city_catalog…`);
    const upserted = await catalog.upsertBoundaries(cities);
    console.log(`Upserted ${upserted} catalog cities (boundary-only, no street segments).`);
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
