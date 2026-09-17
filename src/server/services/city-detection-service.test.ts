import polyline from "@mapbox/polyline";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Activity } from "@/server/db/schema";
import type { NominatimClient } from "@/server/osm/nominatim-client";
import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CityImportQueueRepository } from "@/server/repositories/city-import-queue-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";

import { createCityDetectionService, MAX_NOMINATIM_LOOKUPS_PER_CHUNK } from "./city-detection-service";

function encodeStart(lat: number, lon: number) {
  return polyline.encode([
    [lat, lon],
    [lat + 0.001, lon + 0.001],
  ]);
}

function buildActivity(id: number, lat: number, lon: number): Activity {
  const now = new Date("2026-09-16T12:00:00Z");
  return {
    stravaActivityId: id,
    userId: "user-1",
    name: `Run ${id}`,
    sportType: "Run",
    distanceMeters: 5000,
    movingTimeSeconds: 1800,
    elevationGainMeters: 10,
    startDate: now,
    summaryPolyline: encodeStart(lat, lon),
    coverageMatchedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("createCityDetectionService", () => {
  let activities: ActivityRepository;
  let areas: AreaRepository;
  let userCities: UserCityRepository;
  let importQueue: CityImportQueueRepository;
  let coverage: Pick<CoverageRepository, "matchPendingActivities">;
  let nominatim: NominatimClient;
  let activityRows: Activity[];
  let linked: Array<{ osmRelationId: number; name: string }>;

  beforeEach(() => {
    activityRows = [];
    linked = [];
    activities = {
      listByUser: vi.fn(async () => activityRows),
      upsertMany: vi.fn(),
      deleteForUser: vi.fn(),
    };
    areas = {
      listAll: vi.fn(async () => []),
      hasArea: vi.fn(async () => false),
      findAreasContainingPoints: vi.fn(async () => []),
      filterPointsOutsideAreas: vi.fn(async (points) => points),
      replaceArea: vi.fn(),
    };
    userCities = {
      upsertMany: vi.fn(async (_userId, cities) => {
        linked = [...linked, ...cities];
      }),
      listByUser: vi.fn(async () => linked),
      listGeocodeCells: vi.fn(async (): Promise<Set<string>> => new Set()),
      markGeocodeCells: vi.fn(async () => {}),
    };
    importQueue = {
      enqueueMissing: vi.fn(async () => 0),
      claimNext: vi.fn(async () => null),
      complete: vi.fn(),
      fail: vi.fn(),
      hasWork: vi.fn(async () => false),
    };
    coverage = {
      matchPendingActivities: vi.fn(async () => 0),
    };
    nominatim = {
      reverseGeocode: vi.fn(async () => null),
    };
  });

  it("links cities already present in the shared street cache without Nominatim", async () => {
    activityRows = [buildActivity(1, 48.922, 2.252)];
    vi.mocked(areas.findAreasContainingPoints).mockResolvedValue([{ osmRelationId: 91738, name: "Colombes" }]);
    vi.mocked(areas.filterPointsOutsideAreas).mockResolvedValue([]);

    const service = createCityDetectionService({
      activities,
      areas,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await expect(service.discoverCitiesForUser("user-1")).resolves.toEqual({
      linkedCities: 1,
      queuedImports: 0,
      continues: false,
    });

    expect(nominatim.reverseGeocode).not.toHaveBeenCalled();
    expect(userCities.upsertMany).toHaveBeenCalledWith("user-1", [{ osmRelationId: 91738, name: "Colombes" }]);
    expect(coverage.matchPendingActivities).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("geocodes unknown clusters in chunks and enqueues missing street imports", async () => {
    activityRows = Array.from({ length: MAX_NOMINATIM_LOOKUPS_PER_CHUNK + 2 }, (_, index) =>
      buildActivity(index + 1, 48.9 + index * 0.05, 2.2 + index * 0.05),
    );
    vi.mocked(nominatim.reverseGeocode).mockImplementation(async (lat) => ({
      name: `City ${lat}`,
      osmRelationId: Math.round(lat * 1000),
      adminLevel: 8,
    }));
    vi.mocked(importQueue.enqueueMissing).mockResolvedValue(2);

    const service = createCityDetectionService({
      activities,
      areas,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await expect(service.discoverCitiesForUser("user-1")).resolves.toMatchObject({
      continues: true,
      queuedImports: 2,
    });

    expect(nominatim.reverseGeocode).toHaveBeenCalledTimes(MAX_NOMINATIM_LOOKUPS_PER_CHUNK);
    expect(importQueue.enqueueMissing).toHaveBeenCalled();
  });
});
