import { sql } from "drizzle-orm";

import type { CityCoverage, CoveredStreets } from "@/lib/coverage/street-coverage";
import { COVERAGE_RULES, type CoverageRules } from "@/server/coverage/coverage-rules";
import type { Database } from "@/server/db/client";

export type CoverageRepository = {
  /** Matches runs not yet matched (optionally for one user) against street segments; returns how many were matched. */
  matchPendingActivities: (scope?: { userId: string }) => Promise<number>;
  /** Forces every run to be matched again, e.g. after streets were re-imported. */
  markAllActivitiesPending: () => Promise<void>;
  listCityCoverage: (userId: string) => Promise<CityCoverage[]>;
  getCoveredStreets: (userId: string) => Promise<CoveredStreets>;
};

export function createCoverageRepository(
  database: Database,
  rules: CoverageRules = COVERAGE_RULES,
): CoverageRepository {
  const segmentsCoveredBy = (userId: string) => sql`
    SELECT covered.segment_id
    FROM activity_street_segments AS covered
    JOIN activities ON activities.strava_activity_id = covered.activity_id
    WHERE activities.user_id = ${userId}
  `;

  return {
    async matchPendingActivities(scope) {
      return database.transaction(async (transaction) => {
        const pending = await transaction.execute<{ id: string }>(sql`
          SELECT strava_activity_id AS id FROM activities
          WHERE coverage_matched_at IS NULL ${scope ? sql`AND user_id = ${scope.userId}` : sql``}
          FOR UPDATE SKIP LOCKED
        `);
        if (pending.length === 0) return 0;
        const activityIds = sql.join(
          pending.map(({ id }) => sql`${id}::bigint`),
          sql`, `,
        );

        await transaction.execute(sql`DELETE FROM activity_street_segments WHERE activity_id IN (${activityIds})`);
        // MATERIALIZED forces each run's buffer to be computed once instead of once per segment row scanned.
        await transaction.execute(sql`
          WITH route AS MATERIALIZED (
            SELECT strava_activity_id AS activity_id, ST_LineFromEncodedPolyline(summary_polyline) AS path
            FROM activities WHERE strava_activity_id IN (${activityIds})
          ),
          corridor AS MATERIALIZED (
            SELECT activity_id, ST_Buffer(path::geography, ${rules.matchDistanceMeters})::geometry AS area
            FROM route WHERE ST_NPoints(path) >= 2
          )
          INSERT INTO activity_street_segments (activity_id, segment_id)
          SELECT corridor.activity_id, segment.id
          FROM corridor
          JOIN street_segments AS segment ON segment.path && corridor.area AND ST_Intersects(segment.path, corridor.area)
          WHERE ST_Length(ST_Intersection(segment.path, corridor.area)::geography)
                >= ${rules.minCoveredShare} * segment.length_meters
        `);
        await transaction.execute(
          sql`UPDATE activities SET coverage_matched_at = now() WHERE strava_activity_id IN (${activityIds})`,
        );
        return pending.length;
      });
    },

    async markAllActivitiesPending() {
      await database.execute(sql`UPDATE activities SET coverage_matched_at = NULL`);
    },

    async listCityCoverage(userId) {
      const rows = await database.execute<{
        area_id: string;
        name: string;
        covered_meters: number;
        total_meters: number;
      }>(sql`
        SELECT area.osm_relation_id AS area_id, area.name,
               sum(segment.length_meters)::float8 AS covered_meters, area.street_length_meters AS total_meters
        FROM street_segments AS segment
        JOIN areas AS area ON area.osm_relation_id = segment.area_id
        WHERE segment.id IN (${segmentsCoveredBy(userId)})
        GROUP BY area.osm_relation_id
        ORDER BY sum(segment.length_meters) / nullif(area.street_length_meters, 0) DESC, area.name
      `);
      return rows.map((row) => ({
        areaId: Number(row.area_id),
        name: row.name,
        coveredMeters: row.covered_meters,
        totalMeters: row.total_meters,
      }));
    },

    async getCoveredStreets(userId) {
      // Adjacent covered segments are merged per area to keep the payload small.
      const rows = await database.execute<{ area_id: string; geometry: string }>(sql`
        SELECT segment.area_id, ST_AsGeoJSON(ST_LineMerge(ST_Collect(segment.path)), 6) AS geometry
        FROM street_segments AS segment
        WHERE segment.id IN (${segmentsCoveredBy(userId)})
        GROUP BY segment.area_id
      `);
      return {
        type: "FeatureCollection",
        features: rows.map((row) => ({
          type: "Feature",
          geometry: JSON.parse(row.geometry) as CoveredStreets["features"][number]["geometry"],
          properties: { areaId: Number(row.area_id) },
        })),
      };
    },
  };
}
