import { sql } from "drizzle-orm";

import { createDatabase } from "../src/server/db/client";

/**
 * Removes département / region-scale OSM areas that were imported when Nominatim
 * accepted admin_level 6–7. Communes (admin_level 8), including abroad, are kept.
 *
 * Usage: DATABASE_URL=... pnpm osm:purge-non-communes [--dry-run]
 */
async function main() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) throw new Error("DATABASE_URL is required");

  const dryRun = process.argv.includes("--dry-run");
  const database = createDatabase(connectionUrl);

  try {
    const nonCommunes = await database.execute<{
      osm_relation_id: string;
      name: string;
      admin_level: number;
      street_length_meters: number;
    }>(sql`
      SELECT osm_relation_id, name, admin_level, street_length_meters
      FROM areas
      WHERE admin_level <> 8
      ORDER BY name
    `);

    if (nonCommunes.length === 0) {
      console.log("No non-commune areas found. Nothing to purge.");
      return;
    }

    const totalKm = nonCommunes.reduce((sum, row) => sum + row.street_length_meters, 0) / 1000;
    console.log(`Found ${nonCommunes.length} non-commune area(s) (~${totalKm.toFixed(0)} km of streets):`);
    for (const row of nonCommunes) {
      console.log(`  - ${row.name} (admin_level=${row.admin_level}, id=${row.osm_relation_id})`);
    }

    if (dryRun) {
      console.log("Dry run — no rows deleted. Re-run without --dry-run to purge.");
      return;
    }

    const ids = nonCommunes.map((row) => Number(row.osm_relation_id));
    const idList = sql.join(
      ids.map((id) => sql`${id}::bigint`),
      sql`, `,
    );

    await database.transaction(async (transaction) => {
      // street_segments + activity_street_segments cascade from areas.
      await transaction.execute(sql`DELETE FROM areas WHERE osm_relation_id IN (${idList})`);
      await transaction.execute(sql`DELETE FROM city_catalog WHERE osm_relation_id IN (${idList})`);
      await transaction.execute(sql`DELETE FROM city_import_queue WHERE osm_relation_id IN (${idList})`);
      await transaction.execute(sql`DELETE FROM user_cities WHERE osm_relation_id IN (${idList})`);
    });

    console.log(`Purged ${nonCommunes.length} non-commune area(s) and related user_cities / queue rows.`);
  } finally {
    await database.$client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
