import { sql } from "drizzle-orm";
import type { Position } from "geojson";

import type { Database } from "@/server/db/client";
import type { LatLon } from "@/server/repositories/area-repository";

export type CatalogCityBoundary = {
  osmRelationId: number;
  name: string;
  adminLevel: number;
  /** Boundary member ways as [longitude, latitude] lines; rings are assembled in the database. */
  boundaryLines: Position[][];
};

export type CityCatalogRepository = {
  /** Upserts boundary-only cities (no street segments). */
  upsertBoundaries: (cities: CatalogCityBoundary[]) => Promise<number>;
  listAll: () => Promise<Array<{ osmRelationId: number; name: string; adminLevel: number }>>;
  findContainingPoints: (points: LatLon[]) => Promise<Array<{ osmRelationId: number; name: string }>>;
  filterPointsOutside: (points: LatLon[]) => Promise<LatLon[]>;
};

const toLineGeoJson = (coordinates: Position[]) => ({ type: "LineString", coordinates });

export function createCityCatalogRepository(database: Database): CityCatalogRepository {
  return {
    async listAll() {
      const rows = await database.execute<{ osm_relation_id: string; name: string; admin_level: number }>(sql`
        SELECT osm_relation_id, name, admin_level FROM city_catalog ORDER BY name
      `);
      return rows.map((row) => ({
        osmRelationId: Number(row.osm_relation_id),
        name: row.name,
        adminLevel: row.admin_level,
      }));
    },

    async upsertBoundaries(cities) {
      let upserted = 0;
      for (const city of cities) {
        if (city.boundaryLines.length === 0) continue;
        const boundaryLines = JSON.stringify(city.boundaryLines.map(toLineGeoJson));
        await database.execute(sql`
          INSERT INTO city_catalog (osm_relation_id, name, admin_level, boundary)
          SELECT ${city.osmRelationId}, ${city.name}, ${city.adminLevel},
                 ST_Multi(ST_CollectionExtract(ST_BuildArea(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(line), 4326))), 3))
          FROM jsonb_array_elements(${boundaryLines}::jsonb) AS line
          ON CONFLICT (osm_relation_id) DO UPDATE
          SET name = excluded.name,
              admin_level = excluded.admin_level,
              boundary = excluded.boundary,
              updated_at = now()
        `);
        upserted += 1;
      }
      return upserted;
    },

    async findContainingPoints(points) {
      if (points.length === 0) return [];

      const rows = await database.execute<{ osm_relation_id: string; name: string }>(sql`
        WITH input AS (
          SELECT (item->>'lat')::float8 AS lat, (item->>'lon')::float8 AS lon
          FROM jsonb_array_elements(${JSON.stringify(points)}::jsonb) AS item
        )
        SELECT DISTINCT city_catalog.osm_relation_id, city_catalog.name
        FROM input
        JOIN city_catalog
          ON ST_Contains(city_catalog.boundary, ST_SetSRID(ST_MakePoint(input.lon, input.lat), 4326))
        ORDER BY city_catalog.name
      `);

      return rows.map((row) => ({
        osmRelationId: Number(row.osm_relation_id),
        name: row.name,
      }));
    },

    async filterPointsOutside(points) {
      if (points.length === 0) return [];

      const rows = await database.execute<{ lat: number; lon: number }>(sql`
        WITH input AS (
          SELECT (item->>'lat')::float8 AS lat, (item->>'lon')::float8 AS lon
          FROM jsonb_array_elements(${JSON.stringify(points)}::jsonb) AS item
        )
        SELECT input.lat, input.lon
        FROM input
        WHERE NOT EXISTS (
          SELECT 1
          FROM city_catalog
          WHERE ST_Contains(city_catalog.boundary, ST_SetSRID(ST_MakePoint(input.lon, input.lat), 4326))
        )
      `);

      return rows.map((row) => ({ lat: row.lat, lon: row.lon }));
    },
  };
}
