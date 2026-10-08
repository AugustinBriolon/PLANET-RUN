import { sql } from "drizzle-orm";

import type { LngLat } from "@/lib/coverage/plan-start";
import type { CityCoverage, CoveredStreets } from "@/lib/coverage/street-coverage";
import { buildRunPlanRoute, runPlanRouteToGeoJson, type PlanSegment } from "@/lib/coverage/run-plan-route";
import { COVERAGE_RULES, type CoverageRules } from "@/server/coverage/coverage-rules";
import type { Database } from "@/server/db/client";

/** Max runs rematched in one DB transaction — keeps serverless hops under the time budget. */
export const MATCH_ACTIVITY_BATCH_SIZE = 8;

export type CoverageRepository = {
  /**
   * Matches up to {@link MATCH_ACTIVITY_BATCH_SIZE} unmatched runs (optionally for one user)
   * against street segments; returns how many were matched in this batch.
   */
  matchPendingActivities: (scope?: { userId: string }) => Promise<number>;
  /** True when at least one run still needs coverage matching (optionally for one user). */
  hasPendingMatch: (scope?: { userId: string }) => Promise<boolean>;
  /** Forces every run to be matched again, e.g. after a global rules change. */
  markAllActivitiesPending: () => Promise<void>;
  /**
   * Marks runs that already touched this city so they rematch after its streets are replaced.
   * Must run before `replaceArea` while the old segment rows still exist.
   */
  markActivitiesPendingForArea: (areaId: number) => Promise<void>;
  listCityCoverage: (userId: string) => Promise<CityCoverage[]>;
  getCoveredStreets: (userId: string) => Promise<CoveredStreets>;
  /** Strava ids of the athlete's runs whose trace touches the city boundary (cross-city runs included). */
  listActivityIdsInArea: (userId: string, areaId: number) => Promise<Set<number>>;
  /** Still-uncovered street geometry for one city (merged), for conquest map layers. */
  getUncoveredStreets: (userId: string, areaId: number) => Promise<CoveredStreets>;
  /** Centroid of still-uncovered street geometry — a practical “start here” for the next run. */
  getUncoveredFocus: (userId: string, areaId: number) => Promise<[number, number] | null>;
  /** Distance in meters from a point to each of the athlete's city boundaries (0 when inside). */
  listCityDistances: (userId: string, point: LngLat) => Promise<Map<number, number>>;
  /**
   * Continuous run route through unfinished streets (short covered bridges allowed),
   * sized to about `budgetMeters`. `targetMeters` is uncovered length along that path.
   * `salt` diversifies the start when the athlete regenerates; `start` anchors the route there.
   */
  getRunPlanStreets: (
    userId: string,
    areaId: number,
    budgetMeters: number,
    options?: RunPlanRequestOptions,
  ) => Promise<{
    streets: CoveredStreets;
    targetMeters: number;
    pathMeters: number;
    jumpCount: number;
    jumpMeters: number;
    /** True only when the athlete start was requested and successfully used on-network. */
    startsFromPosition: boolean;
  }>;
  /** GPS distance of every run that touched at least one street in the city. */
  sumActivityDistanceInArea: (userId: string, areaId: number) => Promise<number>;
  /** Unique street metres matched by each runner in the city during [from, to). */
  listSeasonCoveredMeters: (areaId: number, from: Date, to: Date) => Promise<{ userId: string; meters: number }[]>;
};

export type RunPlanRequestOptions = { salt?: number; start?: LngLat };

export function createCoverageRepository(
  database: Database,
  rules: CoverageRules = COVERAGE_RULES,
): CoverageRepository {
  /** Hard-covered segment ids (touched share ≥ minCoveredShare) — map layers and strict %. */
  const segmentsHardCoveredBy = (userId: string) => sql`
    SELECT covered.segment_id
    FROM activity_street_segments AS covered
    JOIN activities ON activities.strava_activity_id = covered.activity_id
    WHERE activities.user_id = ${userId}
      AND covered.covered_share >= ${rules.minCoveredShare}
  `;

  /** Best touched share per segment for this runner (soft % / partial credit). */
  const segmentSharesForUser = (userId: string) => sql`
    SELECT covered.segment_id, max(covered.covered_share)::float8 AS covered_share
    FROM activity_street_segments AS covered
    JOIN activities ON activities.strava_activity_id = covered.activity_id
    WHERE activities.user_id = ${userId}
    GROUP BY covered.segment_id
  `;

  // Bound params are typed unknown; ::float8 avoids Postgres 42725 on unknown - unknown.
  const softCreditSql = (shareExpr: ReturnType<typeof sql>) => sql`
    CASE
      WHEN ${shareExpr} >= ${rules.minCoveredShare}::float8 THEN 1.0
      WHEN ${shareExpr} < ${rules.softCreditFloor}::float8 THEN 0.0
      ELSE (${shareExpr} - ${rules.softCreditFloor}::float8)
           / (${rules.minCoveredShare}::float8 - ${rules.softCreditFloor}::float8)
    END
  `;

  return {
    async hasPendingMatch(scope) {
      const [row] = await database.execute<{ pending: boolean }>(sql`
        SELECT EXISTS (
          SELECT 1 FROM activities
          WHERE coverage_matched_at IS NULL ${scope ? sql`AND user_id = ${scope.userId}` : sql``}
        ) AS pending
      `);
      return Boolean(row?.pending);
    },

    async matchPendingActivities(scope) {
      return database.transaction(async (transaction) => {
        const pending = await transaction.execute<{ id: string }>(sql`
          SELECT strava_activity_id AS id FROM activities
          WHERE coverage_matched_at IS NULL ${scope ? sql`AND user_id = ${scope.userId}` : sql``}
          ORDER BY strava_activity_id
          FOR UPDATE SKIP LOCKED
          LIMIT ${MATCH_ACTIVITY_BATCH_SIZE}
        `);
        if (pending.length === 0) return 0;
        const activityIds = sql.join(
          pending.map(({ id }) => sql`${id}::bigint`),
          sql`, `,
        );

        await transaction.execute(sql`DELETE FROM activity_street_segments WHERE activity_id IN (${activityIds})`);
        // MATERIALIZED forces each run's buffer to be computed once instead of once per segment row scanned.
        // Soft floor stores near-miss contact; hard map filter still uses minCoveredShare (ADR 0013).
        await transaction.execute(sql`
          WITH route AS MATERIALIZED (
            SELECT strava_activity_id AS activity_id, ST_LineFromEncodedPolyline(summary_polyline) AS path
            FROM activities WHERE strava_activity_id IN (${activityIds})
          ),
          corridor AS MATERIALIZED (
            SELECT activity_id, ST_Buffer(path::geography, ${rules.matchDistanceMeters})::geometry AS area
            FROM route WHERE ST_NPoints(path) >= 2
          )
          INSERT INTO activity_street_segments (activity_id, segment_id, covered_share)
          SELECT corridor.activity_id, segment.id,
                 least(
                   1.0,
                   ST_Length(ST_Intersection(segment.path, corridor.area)::geography)
                     / nullif(segment.length_meters, 0)
                 )
          FROM corridor
          JOIN street_segments AS segment ON segment.path && corridor.area AND ST_Intersects(segment.path, corridor.area)
          WHERE segment.counts_for_coverage
            AND ST_Length(ST_Intersection(segment.path, corridor.area)::geography)
                >= ${rules.softCreditFloor} * segment.length_meters
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

    async markActivitiesPendingForArea(areaId) {
      await database.execute(sql`
        UPDATE activities
        SET coverage_matched_at = NULL
        WHERE strava_activity_id IN (
          SELECT DISTINCT activity_street_segments.activity_id
          FROM activity_street_segments
          JOIN street_segments ON street_segments.id = activity_street_segments.segment_id
          WHERE street_segments.area_id = ${areaId}
        )
      `);
    },

    async listCityCoverage(userId) {
      const rows = await database.execute<{
        area_id: string;
        name: string;
        status: "pending" | "matching" | "ready";
        covered_meters: number;
        strict_covered_meters: number;
        total_meters: number;
        west: number | null;
        south: number | null;
        east: number | null;
        north: number | null;
      }>(sql`
        WITH shares AS (
          ${segmentSharesForUser(userId)}
        ),
        soft_covered AS (
          SELECT segment.area_id,
                 sum(segment.length_meters * (${softCreditSql(sql`shares.covered_share`)}))::float8 AS covered_meters
          FROM street_segments AS segment
          JOIN shares ON shares.segment_id = segment.id
          WHERE segment.counts_for_coverage
          GROUP BY segment.area_id
        ),
        hard_covered AS (
          SELECT segment.area_id, sum(segment.length_meters)::float8 AS covered_meters
          FROM street_segments AS segment
          WHERE segment.counts_for_coverage
            AND segment.id IN (${segmentsHardCoveredBy(userId)})
          GROUP BY segment.area_id
        )
        SELECT user_cities.osm_relation_id AS area_id,
               user_cities.name,
               CASE
                 WHEN coalesce(area.street_length_meters, 0) <= 0 THEN 'pending'
                 ELSE 'ready'
               END AS status,
               coalesce(soft_covered.covered_meters, 0)::float8 AS covered_meters,
               coalesce(hard_covered.covered_meters, 0)::float8 AS strict_covered_meters,
               coalesce(area.street_length_meters, 0)::float8 AS total_meters,
               ST_XMin(coalesce(area.boundary, catalog.boundary))::float8 AS west,
               ST_YMin(coalesce(area.boundary, catalog.boundary))::float8 AS south,
               ST_XMax(coalesce(area.boundary, catalog.boundary))::float8 AS east,
               ST_YMax(coalesce(area.boundary, catalog.boundary))::float8 AS north
        FROM user_cities
        LEFT JOIN areas AS area ON area.osm_relation_id = user_cities.osm_relation_id
        LEFT JOIN city_catalog AS catalog ON catalog.osm_relation_id = user_cities.osm_relation_id
        LEFT JOIN soft_covered ON soft_covered.area_id = user_cities.osm_relation_id
        LEFT JOIN hard_covered ON hard_covered.area_id = user_cities.osm_relation_id
        WHERE user_cities.user_id = ${userId}
        ORDER BY
          CASE WHEN coalesce(area.street_length_meters, 0) <= 0 THEN 1 ELSE 0 END,
          soft_covered.covered_meters / nullif(area.street_length_meters, 0) DESC NULLS LAST,
          user_cities.name
      `);
      return rows.map((row) => ({
        areaId: Number(row.area_id),
        name: row.name,
        status: row.status,
        coveredMeters: row.covered_meters,
        strictCoveredMeters: row.strict_covered_meters,
        totalMeters: row.total_meters,
        bounds:
          row.west == null || row.south == null || row.east == null || row.north == null
            ? null
            : [
                [row.west, row.south],
                [row.east, row.north],
              ],
      }));
    },

    async getCoveredStreets(userId) {
      // Adjacent hard-covered segments are merged per area to keep the payload small.
      const rows = await database.execute<{ area_id: string; geometry: string }>(sql`
        SELECT segment.area_id, ST_AsGeoJSON(ST_LineMerge(ST_Collect(segment.path)), 6) AS geometry
        FROM street_segments AS segment
        WHERE segment.counts_for_coverage
          AND segment.id IN (${segmentsHardCoveredBy(userId)})
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

    async getUncoveredFocus(userId, areaId) {
      const rows = await database.execute<{ lng: number; lat: number }>(sql`
        SELECT ST_X(focus.pt)::float8 AS lng, ST_Y(focus.pt)::float8 AS lat
        FROM (
          SELECT ST_Centroid(ST_Collect(segment.path)) AS pt
          FROM street_segments AS segment
          WHERE segment.area_id = ${areaId}
            AND segment.counts_for_coverage
            AND segment.id NOT IN (${segmentsHardCoveredBy(userId)})
        ) AS focus
        WHERE focus.pt IS NOT NULL
      `);
      const row = rows[0];
      if (!row || !Number.isFinite(row.lng) || !Number.isFinite(row.lat)) return null;
      return [row.lng, row.lat];
    },

    async listActivityIdsInArea(userId, areaId) {
      const rows = await database.execute<{ id: string }>(sql`
        WITH city AS (
          SELECT coalesce(area.boundary, catalog.boundary) AS boundary
          FROM (SELECT ${areaId}::bigint AS osm_relation_id) AS target
          LEFT JOIN areas AS area ON area.osm_relation_id = target.osm_relation_id
          LEFT JOIN city_catalog AS catalog ON catalog.osm_relation_id = target.osm_relation_id
        )
        SELECT activities.strava_activity_id AS id
        FROM activities
        CROSS JOIN city
        WHERE activities.user_id = ${userId}
          AND city.boundary IS NOT NULL
          AND activities.summary_polyline IS NOT NULL
          AND ST_Intersects(ST_LineFromEncodedPolyline(activities.summary_polyline), city.boundary)
      `);
      return new Set(rows.map((row) => Number(row.id)));
    },

    async getUncoveredStreets(userId, areaId) {
      const rows = await database.execute<{ geometry: string }>(sql`
        SELECT ST_AsGeoJSON(ST_LineMerge(ST_Collect(segment.path)), 6) AS geometry
        FROM street_segments AS segment
        WHERE segment.area_id = ${areaId}
          AND segment.counts_for_coverage
          AND segment.id NOT IN (${segmentsHardCoveredBy(userId)})
      `);
      const geometry = rows[0]?.geometry;
      if (!geometry) {
        return { type: "FeatureCollection", features: [] };
      }
      return {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: JSON.parse(geometry) as CoveredStreets["features"][number]["geometry"],
            properties: { areaId },
          },
        ],
      };
    },

    async listCityDistances(userId, point) {
      const rows = await database.execute<{ area_id: string; distance_meters: number }>(sql`
        SELECT user_cities.osm_relation_id AS area_id,
               ST_Distance(
                 coalesce(area.boundary, catalog.boundary)::geography,
                 ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography
               )::float8 AS distance_meters
        FROM user_cities
        LEFT JOIN areas AS area ON area.osm_relation_id = user_cities.osm_relation_id
        LEFT JOIN city_catalog AS catalog ON catalog.osm_relation_id = user_cities.osm_relation_id
        WHERE user_cities.user_id = ${userId}
          AND coalesce(area.boundary, catalog.boundary) IS NOT NULL
      `);
      return new Map(rows.map((row) => [Number(row.area_id), row.distance_meters]));
    },

    async getRunPlanStreets(userId, areaId, budgetMeters, { salt = 0, start } = {}) {
      const budget = Math.max(500, Math.min(budgetMeters, 40_000));
      // Full city graph — pocket clipping left distance fill short (~2–3 km) on half-conquered towns.
      const rows = await database.execute<{
        id: number;
        geometry: string;
        length_meters: number;
        covered: boolean;
        counts_for_coverage: boolean;
      }>(sql`
        WITH uncovered AS (
          SELECT segment.id
          FROM street_segments AS segment
          WHERE segment.area_id = ${areaId}
            AND segment.counts_for_coverage
            AND segment.id NOT IN (${segmentsHardCoveredBy(userId)})
        )
        SELECT
          segment.id::int AS id,
          ST_AsGeoJSON(segment.path, 6) AS geometry,
          segment.length_meters::float8 AS length_meters,
          (NOT EXISTS (SELECT 1 FROM uncovered WHERE uncovered.id = segment.id)) AS covered,
          segment.counts_for_coverage AS counts_for_coverage
        FROM street_segments AS segment
        WHERE segment.area_id = ${areaId}
      `);

      const segments: PlanSegment[] = rows.flatMap((row) => {
        const geometry = JSON.parse(row.geometry) as { type: string; coordinates: PlanSegment["coordinates"] };
        if (geometry.type !== "LineString" || geometry.coordinates.length < 2) return [];
        return [
          {
            id: row.id,
            coordinates: geometry.coordinates,
            lengthMeters: row.length_meters,
            covered: Boolean(row.covered),
            countsForCoverage: Boolean(row.counts_for_coverage),
          },
        ];
      });

      let route = buildRunPlanRoute(segments, {
        budgetMeters: budget,
        salt,
        start: start ? [start.lng, start.lat] : undefined,
      });
      let startsFromPosition = start != null && route.coordinates.length >= 2;
      // GPS snap / disconnected seed → still offer a city-centered on-network plan.
      if (start && route.coordinates.length < 2) {
        route = buildRunPlanRoute(segments, { budgetMeters: budget, salt });
        startsFromPosition = false;
      }
      return {
        streets: runPlanRouteToGeoJson(route, areaId) as CoveredStreets,
        targetMeters: route.uncoveredMeters,
        pathMeters: route.pathMeters,
        jumpCount: route.jumpCount,
        jumpMeters: route.jumpMeters,
        startsFromPosition,
      };
    },

    async sumActivityDistanceInArea(userId, areaId) {
      const rows = await database.execute<{ meters: number }>(sql`
        SELECT coalesce(sum(activities.distance_meters), 0)::float8 AS meters
        FROM activities
        WHERE activities.user_id = ${userId}
          AND EXISTS (
            SELECT 1
            FROM activity_street_segments AS covered
            JOIN street_segments AS segment ON segment.id = covered.segment_id
            WHERE covered.activity_id = activities.strava_activity_id
              AND segment.area_id = ${areaId}
          )
      `);
      return rows[0]?.meters ?? 0;
    },

    async listSeasonCoveredMeters(areaId, from, to) {
      const rows = await database.execute<{ user_id: string; meters: number }>(sql`
        SELECT activities.user_id,
               coalesce(sum(segment.length_meters), 0)::float8 AS meters
        FROM activities
        JOIN activity_street_segments AS covered ON covered.activity_id = activities.strava_activity_id
        JOIN street_segments AS segment ON segment.id = covered.segment_id
        WHERE segment.area_id = ${areaId}
          AND segment.counts_for_coverage
          AND activities.start_date >= ${from}
          AND activities.start_date < ${to}
        GROUP BY activities.user_id
      `);
      return rows.map((row) => ({ userId: row.user_id, meters: row.meters }));
    },
  };
}
