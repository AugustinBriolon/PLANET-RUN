import polyline from "@mapbox/polyline";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createActivityRepository } from "@/server/repositories/activity-repository";
import { createAreaRepository, type AreaImport } from "@/server/repositories/area-repository";
import { createCoverageRepository } from "@/server/repositories/coverage-repository";
import { createStravaAccountRepository } from "@/server/repositories/strava-account-repository";
import { toActivityRecord } from "@/server/strava/run-activity";

import { buildStravaActivity } from "../fixtures/strava";

import { createTestDatabase } from "./test-database";

const testDatabase = createTestDatabase();
const accounts = createStravaAccountRepository(testDatabase.database);
const activities = createActivityRepository(testDatabase.database);
const areas = createAreaRepository(testDatabase.database);
const coverage = createCoverageRepository(testDatabase.database);

// A 0.01° square city (~745 m × 1,112 m) whose boundary is split across two ways, like OSM relations.
const MAIN_STREET_LATITUDE = 48.005;
const CROSS_STREET_LONGITUDE = 2.005;
const squareCity: AreaImport = {
  osmRelationId: 1001,
  name: "Squareville",
  adminLevel: 8,
  boundaryLines: [
    [
      [2.0, 48.0],
      [2.01, 48.0],
      [2.01, 48.01],
    ],
    [
      [2.01, 48.01],
      [2.0, 48.01],
      [2.0, 48.0],
    ],
  ],
  streets: [
    // Crosses both city limits: only the ~745 m inside counts.
    {
      osmWayId: 1,
      name: "Main Street",
      highway: "residential",
      coordinates: [
        [1.995, MAIN_STREET_LATITUDE],
        [2.015, MAIN_STREET_LATITUDE],
      ],
    },
    {
      osmWayId: 2,
      name: "Cross Street",
      highway: "tertiary",
      coordinates: [
        [CROSS_STREET_LONGITUDE, 47.998],
        [CROSS_STREET_LONGITUDE, 48.012],
      ],
    },
    {
      osmWayId: 3,
      name: "Elsewhere Road",
      highway: "residential",
      coordinates: [
        [2.02, 48.005],
        [2.03, 48.005],
      ],
    },
  ],
};

const MAIN_STREET_METERS = 745;
const CROSS_STREET_METERS = 1112;

function encodeRoute(latitude: number, fromLongitude: number, toLongitude: number) {
  return polyline.encode([
    [latitude, fromLongitude],
    [latitude, (fromLongitude + toLongitude) / 2],
    [latitude, toLongitude],
  ]);
}

async function recordRun(userId: string, id: number, summaryPolyline: string) {
  const record = toActivityRecord(buildStravaActivity({ id, map: { summary_polyline: summaryPolyline } }), userId);
  await activities.upsertMany([record]);
  return record;
}

async function linkRunner(athleteId: number) {
  return accounts.createWithUser(
    { displayName: `Runner ${athleteId}`, avatarUrl: null },
    { athleteId, accessTokenEncrypted: "a", refreshTokenEncrypted: "r", tokenExpiresAt: new Date() },
  );
}

describe("street coverage in PostGIS", () => {
  beforeEach(async () => {
    await testDatabase.reset();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe("area import", () => {
    it("clips streets to the city and splits them into pieces of at most 50 m", async () => {
      const result = await areas.replaceArea(squareCity);

      expect(result.streetLengthMeters).toBeGreaterThan(MAIN_STREET_METERS + CROSS_STREET_METERS - 10);
      expect(result.streetLengthMeters).toBeLessThan(MAIN_STREET_METERS + CROSS_STREET_METERS + 10);
      expect(result.segmentCount).toBe(15 + 23);

      const [longest] = await testDatabase.database.execute<{ meters: number; ways: number[] }>(
        "SELECT max(length_meters) AS meters, array_agg(DISTINCT osm_way_id)::int[] AS ways FROM street_segments",
      );
      expect(longest!.meters).toBeLessThanOrEqual(50);
      expect(longest!.ways).toEqual([1, 2]);
    });

    it("replaces a city on re-import instead of duplicating its streets", async () => {
      await areas.replaceArea(squareCity);
      const result = await areas.replaceArea({ ...squareCity, streets: squareCity.streets.slice(0, 1) });

      expect(result.segmentCount).toBe(15);
    });
  });

  describe("run matching", () => {
    beforeEach(async () => {
      await areas.replaceArea(squareCity);
    });

    it("covers the pieces a run follows, but not the street it only crosses", async () => {
      const runner = await linkRunner(42);
      await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.009));

      expect(await coverage.matchPendingActivities({ userId: runner.id })).toBe(1);

      const [city] = await coverage.listCityCoverage(runner.id);
      expect(city).toMatchObject({ areaId: 1001, name: "Squareville" });
      // ~595 m of running plus the 20 m corridor at each end covers 13 of the 15 Main Street pieces.
      expect(city!.coveredMeters).toBeGreaterThan(600);
      expect(city!.coveredMeters).toBeLessThan(MAIN_STREET_METERS - 50);
      const coveredWays = await testDatabase.database.execute<{ osm_way_id: number; pieces: number }>(
        `SELECT osm_way_id::int, count(*)::int AS pieces FROM street_segments
         JOIN activity_street_segments ON segment_id = id GROUP BY osm_way_id`,
      );
      expect([...coveredWays]).toEqual([{ osm_way_id: 1, pieces: 13 }]);

      const streets = await coverage.getCoveredStreets(runner.id);
      expect(streets.features).toHaveLength(1);
      expect(streets.features[0]).toMatchObject({ properties: { areaId: 1001 }, geometry: { type: "LineString" } });
    });

    it("ignores a parallel street 60 m away", async () => {
      const runner = await linkRunner(42);
      await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE + 0.00054, 2.001, 2.009));

      await coverage.matchPendingActivities({ userId: runner.id });

      expect(await coverage.listCityCoverage(runner.id)).toEqual([]);
    });

    it("only matches the requested runner and counts each run once", async () => {
      const runner = await linkRunner(42);
      const other = await linkRunner(7);
      await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.009));
      await recordRun(other.id, 2, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.009));

      expect(await coverage.matchPendingActivities({ userId: runner.id })).toBe(1);
      expect(await coverage.matchPendingActivities({ userId: runner.id })).toBe(0);
      expect(await coverage.listCityCoverage(other.id)).toEqual([]);

      expect(await coverage.matchPendingActivities()).toBe(1);
      expect(await coverage.listCityCoverage(other.id)).toHaveLength(1);
    });

    it("re-matches a run whose trace changed, and keeps matches for unchanged ones", async () => {
      const runner = await linkRunner(42);
      const run = await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.009));
      await coverage.matchPendingActivities({ userId: runner.id });

      await activities.upsertMany([{ ...run, name: "Renamed" }]);
      expect(await coverage.matchPendingActivities({ userId: runner.id })).toBe(0);

      await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.004));
      expect(await coverage.matchPendingActivities({ userId: runner.id })).toBe(1);
      const [city] = await coverage.listCityCoverage(runner.id);
      expect(city!.coveredMeters).toBeLessThan(400);
    });

    it("drops coverage with the run, and re-matches everything on demand", async () => {
      const runner = await linkRunner(42);
      await recordRun(runner.id, 1, encodeRoute(MAIN_STREET_LATITUDE, 2.001, 2.009));
      await coverage.matchPendingActivities();

      await coverage.markAllActivitiesPending();
      expect(await coverage.matchPendingActivities()).toBe(1);

      await activities.deleteForUser(runner.id, 1);
      expect(await coverage.listCityCoverage(runner.id)).toEqual([]);
    });
  });
});
