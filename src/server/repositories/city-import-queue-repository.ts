import { sql } from "drizzle-orm";

import type { Database } from "@/server/db/client";

export type CityImportJob = {
  osmRelationId: number;
  name: string;
  status: "pending" | "importing" | "failed";
  attempts: number;
};

export type CityImportQueueRepository = {
  /** Enqueues cities that are not already imported into the shared `areas` table. */
  enqueueMissing: (cities: Array<{ osmRelationId: number; name: string }>) => Promise<number>;
  /** Claims the next pending job (or retries a failed one), marking it importing. */
  claimNext: () => Promise<CityImportJob | null>;
  complete: (osmRelationId: number) => Promise<void>;
  fail: (osmRelationId: number, error: string) => Promise<void>;
  hasWork: () => Promise<boolean>;
};

const MAX_ATTEMPTS = 3;

export function createCityImportQueueRepository(database: Database): CityImportQueueRepository {
  return {
    async enqueueMissing(cities) {
      if (cities.length === 0) return 0;

      const unique = new Map(cities.map((city) => [city.osmRelationId, city]));
      const values = JSON.stringify(
        [...unique.values()].map((city) => ({
          osmRelationId: city.osmRelationId,
          name: city.name,
        })),
      );

      const rows = await database.execute<{ osm_relation_id: string }>(sql`
        INSERT INTO city_import_queue (osm_relation_id, name, status)
        SELECT (item->>'osmRelationId')::bigint, item->>'name', 'pending'
        FROM jsonb_array_elements(${values}::jsonb) AS item
        WHERE NOT EXISTS (
          SELECT 1 FROM areas
          WHERE areas.osm_relation_id = (item->>'osmRelationId')::bigint
            AND areas.street_length_meters > 0
        )
        ON CONFLICT (osm_relation_id) DO NOTHING
        RETURNING osm_relation_id
      `);
      return rows.length;
    },

    async claimNext() {
      const rows = await database.execute<{
        osm_relation_id: string;
        name: string;
        status: string;
        attempts: number;
      }>(sql`
        UPDATE city_import_queue AS job
        SET status = 'importing', attempts = job.attempts + 1, updated_at = now(), last_error = NULL
        FROM (
          SELECT osm_relation_id
          FROM city_import_queue
          WHERE status = 'pending' OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS})
          ORDER BY created_at
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        ) AS next
        WHERE job.osm_relation_id = next.osm_relation_id
        RETURNING job.osm_relation_id, job.name, job.status, job.attempts
      `);

      const job = rows[0];
      if (!job) return null;
      return {
        osmRelationId: Number(job.osm_relation_id),
        name: job.name,
        status: "importing",
        attempts: job.attempts,
      };
    },

    async complete(osmRelationId) {
      await database.execute(sql`DELETE FROM city_import_queue WHERE osm_relation_id = ${osmRelationId}`);
    },

    async fail(osmRelationId, error) {
      await database.execute(sql`
        UPDATE city_import_queue
        SET status = 'failed', last_error = ${error}, updated_at = now()
        WHERE osm_relation_id = ${osmRelationId}
      `);
    },

    async hasWork() {
      const [row] = await database.execute<{ remaining: number }>(sql`
        SELECT count(*)::int AS remaining
        FROM city_import_queue
        WHERE status = 'pending' OR (status = 'failed' AND attempts < ${MAX_ATTEMPTS})
      `);
      return (row?.remaining ?? 0) > 0;
    },
  };
}
