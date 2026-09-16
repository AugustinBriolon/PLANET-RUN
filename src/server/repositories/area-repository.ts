import { sql } from "drizzle-orm";
import type { Position } from "geojson";

import { COVERAGE_RULES, type CoverageRules } from "@/server/coverage/coverage-rules";
import type { Database } from "@/server/db/client";

export type AreaStreet = {
  osmWayId: number;
  name: string | null;
  highway: string;
  /** [longitude, latitude] positions. */
  coordinates: Position[];
};

export type AreaImport = {
  osmRelationId: number;
  name: string;
  adminLevel: number;
  /** Boundary member ways as [longitude, latitude] lines; rings are assembled in the database. */
  boundaryLines: Position[][];
  streets: AreaStreet[];
};

export type AreaImportResult = { segmentCount: number; streetLengthMeters: number };

export type AreaRepository = {
  /** Creates or fully replaces an area and its street segments. */
  replaceArea: (area: AreaImport) => Promise<AreaImportResult>;
  /** Returns all imported areas. */
  listAll: () => Promise<Array<{ osmRelationId: number; name: string; adminLevel: number }>>;
};

const toLineGeoJson = (coordinates: Position[]) => ({ type: "LineString", coordinates });

export function createAreaRepository(
  database: Database,
  rules: Pick<CoverageRules, "maxSegmentMeters"> = COVERAGE_RULES,
): AreaRepository {
  return {
    async listAll() {
      const rows = await database.execute<{ osm_relation_id: string; name: string; admin_level: number }>(sql`
        SELECT osm_relation_id, name, admin_level FROM areas ORDER BY name
      `);
      return rows.map((row) => ({
        osmRelationId: Number(row.osm_relation_id),
        name: row.name,
        adminLevel: row.admin_level,
      }));
    },
    async replaceArea(area) {
      const boundaryLines = JSON.stringify(area.boundaryLines.map(toLineGeoJson));
      const streets = JSON.stringify(
        area.streets.map(({ coordinates, ...street }) => ({ ...street, path: toLineGeoJson(coordinates) })),
      );

      return database.transaction(async (transaction) => {
        await transaction.execute(sql`
          INSERT INTO areas (osm_relation_id, name, admin_level, boundary, street_length_meters)
          SELECT ${area.osmRelationId}, ${area.name}, ${area.adminLevel},
                 ST_Multi(ST_CollectionExtract(ST_BuildArea(ST_Collect(ST_SetSRID(ST_GeomFromGeoJSON(line), 4326))), 3)),
                 0
          FROM jsonb_array_elements(${boundaryLines}::jsonb) AS line
          ON CONFLICT (osm_relation_id) DO UPDATE
          SET name = excluded.name, admin_level = excluded.admin_level, boundary = excluded.boundary, updated_at = now()
        `);

        await transaction.execute(sql`DELETE FROM street_segments WHERE area_id = ${area.osmRelationId}`);

        // Clip each street to the boundary, then cut every resulting line into equal pieces.
        await transaction.execute(sql`
          WITH boundary AS (
            SELECT boundary FROM areas WHERE osm_relation_id = ${area.osmRelationId}
          ),
          street AS (
            SELECT (item->>'osmWayId')::bigint AS osm_way_id, item->>'name' AS name, item->>'highway' AS highway,
                   ST_SetSRID(ST_GeomFromGeoJSON(item->'path'), 4326) AS path
            FROM jsonb_array_elements(${streets}::jsonb) AS item
          ),
          clipped AS (
            SELECT street.osm_way_id, street.name, street.highway,
                   (ST_Dump(ST_CollectionExtract(ST_Intersection(street.path, boundary.boundary), 2))).geom AS path
            FROM street, boundary
            WHERE ST_Intersects(street.path, boundary.boundary)
          ),
          measured AS (
            SELECT clipped.*, ceil(ST_Length(path::geography) / ${rules.maxSegmentMeters})::int AS piece_count
            FROM clipped
          ),
          pieces AS (
            SELECT measured.osm_way_id, measured.name, measured.highway,
                   ST_LineSubstring(path, piece::float8 / piece_count, (piece + 1)::float8 / piece_count) AS path
            FROM measured, generate_series(0, measured.piece_count - 1) AS piece
            WHERE measured.piece_count > 0
          )
          INSERT INTO street_segments (area_id, osm_way_id, name, highway, path, length_meters)
          SELECT ${area.osmRelationId}, osm_way_id, name, highway, path, ST_Length(path::geography)
          FROM pieces
        `);

        const [totals] = await transaction.execute<{ segment_count: number; street_length_meters: number }>(sql`
          UPDATE areas
          SET street_length_meters = totals.street_length_meters
          FROM (
            SELECT count(*)::int AS segment_count, coalesce(sum(length_meters), 0)::float8 AS street_length_meters
            FROM street_segments WHERE area_id = ${area.osmRelationId}
          ) AS totals
          WHERE osm_relation_id = ${area.osmRelationId}
          RETURNING totals.segment_count, totals.street_length_meters
        `);
        return { segmentCount: totals!.segment_count, streetLengthMeters: totals!.street_length_meters };
      });
    },
  };
}
