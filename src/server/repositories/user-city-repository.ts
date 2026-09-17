import { sql } from "drizzle-orm";

import type { Database } from "@/server/db/client";

export type DetectedCity = {
  osmRelationId: number;
  name: string;
};

export type UserCityRepository = {
  upsertMany: (userId: string, cities: DetectedCity[]) => Promise<void>;
  listByUser: (userId: string) => Promise<DetectedCity[]>;
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
        SELECT cell_key FROM user_geocode_cells WHERE user_id = ${userId}
      `);
      return new Set(rows.map((row) => row.cell_key));
    },

    async markGeocodeCells(userId, cellKeys) {
      if (cellKeys.length === 0) return;
      const values = JSON.stringify(cellKeys);
      await database.execute(sql`
        INSERT INTO user_geocode_cells (user_id, cell_key)
        SELECT ${userId}::uuid, item
        FROM jsonb_array_elements_text(${values}::jsonb) AS item
        ON CONFLICT DO NOTHING
      `);
    },
  };
}
