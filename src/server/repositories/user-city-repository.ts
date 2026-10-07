import { sql } from "drizzle-orm";

import type { Database } from "@/server/db/client";

/** Geocode cells older than this are eligible for Nominatim retry (transient past failures). */
export const GEOCODE_CELL_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DetectedCity = {
  osmRelationId: number;
  name: string;
};

export type UserCityRepository = {
  upsertMany: (userId: string, cities: DetectedCity[]) => Promise<void>;
  listByUser: (userId: string) => Promise<DetectedCity[]>;
  /** Cell keys still within the TTL — expired cells are omitted so discovery can retry. */
  listGeocodeCells: (userId: string) => Promise<Set<string>>;
  markGeocodeCells: (userId: string, cellKeys: string[]) => Promise<void>;
};

export function createUserCityRepository(database: Database): UserCityRepository {
  return {
    async upsertMany(userId, cities) {
      if (cities.length === 0) return;

      const unique = new Map(cities.map((city) => [city.osmRelationId, city]));
      const values = JSON.stringify(
        [...unique.values()].map((city) => ({
          osmRelationId: city.osmRelationId,
          name: city.name,
        })),
      );

      await database.execute(sql`
        INSERT INTO user_cities (user_id, osm_relation_id, name)
        SELECT ${userId}::uuid, (item->>'osmRelationId')::bigint, item->>'name'
        FROM jsonb_array_elements(${values}::jsonb) AS item
        ON CONFLICT (user_id, osm_relation_id) DO UPDATE SET name = excluded.name
      `);
    },

    async listByUser(userId) {
      const rows = await database.execute<{ osm_relation_id: string; name: string }>(sql`
        SELECT osm_relation_id, name FROM user_cities WHERE user_id = ${userId} ORDER BY name
      `);
      return rows.map((row) => ({
        osmRelationId: Number(row.osm_relation_id),
        name: row.name,
      }));
    },

    async listGeocodeCells(userId) {
      const rows = await database.execute<{ cell_key: string }>(sql`
        SELECT cell_key FROM user_geocode_cells
        WHERE user_id = ${userId}
          AND created_at > now() - (${GEOCODE_CELL_TTL_MS}::bigint * interval '1 millisecond')
      `);
      return new Set(rows.map((row) => row.cell_key));
    },

    async markGeocodeCells(userId, cellKeys) {
      if (cellKeys.length === 0) return;
      const values = JSON.stringify(cellKeys);
      await database.execute(sql`
        INSERT INTO user_geocode_cells (user_id, cell_key, created_at)
        SELECT ${userId}::uuid, item, now()
        FROM jsonb_array_elements_text(${values}::jsonb) AS item
        ON CONFLICT (user_id, cell_key) DO UPDATE SET created_at = excluded.created_at
      `);
    },
  };
}
