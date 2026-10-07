import polyline from "@mapbox/polyline";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Activity } from "@/server/db/schema";
import type { NominatimClient } from "@/server/osm/nominatim-client";
import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CityCatalogRepository } from "@/server/repositories/city-catalog-repository";
import type { CityImportQueueRepository } from "@/server/repositories/city-import-queue-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";

import {
  createCityDetectionService,
  extractDiscoveryPoints,
  MAX_NOMINATIM_LOOKUPS_PER_CHUNK,
} from "./city-detection-service";

function encodeStart(lat: number, lon: number) {
  return polyline.encode([
    [lat, lon],
    [lat + 0.001, lon + 0.001],
  ]);
}

function encodeRoute(points: Array<[number, number]>) {
  return polyline.encode(points);
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

describe("extractDiscoveryPoints", () => {
  it("samples start, mid, and end of each polyline", () => {
    const polylineEncoded = encodeRoute([
      [48.9, 2.2],
      [48.91, 2.21],
      [48.92, 2.22],
      [48.93, 2.23],
      [48.94, 2.24],
    ]);
    expect(extractDiscoveryPoints([{ summaryPolyline: polylineEncoded }])).toEqual([
      { lat: 48.9, lon: 2.2 },
      { lat: 48.92, lon: 2.22 },
      { lat: 48.94, lon: 2.24 },
    ]);
  });

  it("dedupes indices on short polylines", () => {
    expect(extractDiscoveryPoints([{ summaryPolyline: encodeStart(48.92, 2.25) }])).toEqual([
      { lat: 48.92, lon: 2.25 },
      { lat: 48.921, lon: 2.251 },
    ]);
  });
});

describe("createCityDetectionService", () => {
  let activities: ActivityRepository;
  let areas: AreaRepository;
  let catalog: CityCatalogRepository;
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
      hasStreetsImported: vi.fn(async () => false),
      findAreasContainingPoints: vi.fn(async () => []),
      filterPointsOutsideAreas: vi.fn(async (points) => points),
      replaceArea: vi.fn(),
    };
    catalog = {
      listAll: vi.fn(async () => []),
      upsertBoundaries: vi.fn(async () => 0),
      findContainingPoints: vi.fn(async () => []),
      filterPointsOutside: vi.fn(async (points) => points),
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
      hasWorkForUser: vi.fn(async () => false),
    };
    coverage = {
      matchPendingActivities: vi.fn(async () => 0),
    };
    nominatim = {
      reverseGeocode: vi.fn(async () => ({ kind: "miss" as const })),
    };
  });

  it("links cities already present in the shared street cache without Nominatim", async () => {
    activityRows = [buildActivity(1, 48.922, 2.252)];
    vi.mocked(areas.findAreasContainingPoints).mockResolvedValue([
      { osmRelationId: 91738, name: "Colombes", pointCount: 2 },
    ]);
    vi.mocked(areas.filterPointsOutsideAreas).mockResolvedValue([]);
    vi.mocked(catalog.filterPointsOutside).mockResolvedValue([]);

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
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
    expect(importQueue.enqueueMissing).toHaveBeenCalledWith([
      { osmRelationId: 91738, name: "Colombes", priority: 2 },
    ]);
    expect(coverage.matchPendingActivities).toHaveBeenCalledWith({ userId: "user-1" });
  });

  it("links cities from the boundary catalog without Nominatim", async () => {
    activityRows = [buildActivity(1, 48.85, 2.35)];
    vi.mocked(catalog.findContainingPoints).mockResolvedValue([
      { osmRelationId: 7444, name: "Paris", pointCount: 3 },
    ]);
    vi.mocked(areas.filterPointsOutsideAreas).mockResolvedValue([{ lat: 48.85, lon: 2.35 }]);
    vi.mocked(catalog.filterPointsOutside).mockResolvedValue([]);

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await expect(service.discoverCitiesForUser("user-1")).resolves.toMatchObject({ linkedCities: 1 });
    expect(nominatim.reverseGeocode).not.toHaveBeenCalled();
    expect(userCities.upsertMany).toHaveBeenCalledWith("user-1", [{ osmRelationId: 7444, name: "Paris" }]);
    expect(importQueue.enqueueMissing).toHaveBeenCalledWith([
      { osmRelationId: 7444, name: "Paris", priority: 3 },
    ]);
  });

  it("geocodes unknown clusters in chunks and enqueues missing street imports", async () => {
    activityRows = Array.from({ length: MAX_NOMINATIM_LOOKUPS_PER_CHUNK + 2 }, (_, index) =>
      buildActivity(index + 1, 48.9 + index * 0.05, 2.2 + index * 0.05),
    );
    vi.mocked(nominatim.reverseGeocode).mockImplementation(async (lat) => ({
      kind: "hit" as const,
      result: {
        name: `City ${lat}`,
        osmRelationId: Math.round(lat * 1000),
        adminLevel: 8,
      },
    }));
    vi.mocked(importQueue.enqueueMissing).mockResolvedValue(2);

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
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

  it("does not mark geocode cells when Nominatim is retryable", async () => {
    activityRows = [buildActivity(1, 48.9, 2.2)];
    vi.mocked(nominatim.reverseGeocode).mockResolvedValue({ kind: "retryable" });

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await service.discoverCitiesForUser("user-1");

    expect(userCities.markGeocodeCells).toHaveBeenCalledWith("user-1", []);
  });

  it("marks cells on miss so permanent non-communes are not retried every chunk", async () => {
    activityRows = [buildActivity(1, 48.9, 2.2)];
    vi.mocked(nominatim.reverseGeocode).mockResolvedValue({ kind: "miss" });

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await service.discoverCitiesForUser("user-1");

    expect(userCities.markGeocodeCells).toHaveBeenCalledWith(
      "user-1",
      expect.arrayContaining([expect.any(String)]),
    );
  });

  it("sets import priority from per-city discovery density, not global run count", async () => {
    activityRows = [
      buildActivity(1, 48.922, 2.252),
      buildActivity(2, 48.922, 2.252),
      buildActivity(3, 48.85, 2.35),
    ];
    vi.mocked(areas.findAreasContainingPoints).mockResolvedValue([
      { osmRelationId: 91738, name: "Colombes", pointCount: 4 },
      { osmRelationId: 7444, name: "Paris", pointCount: 1 },
    ]);
    vi.mocked(areas.filterPointsOutsideAreas).mockResolvedValue([]);
    vi.mocked(catalog.filterPointsOutside).mockResolvedValue([]);

    const service = createCityDetectionService({
      activities,
      areas,
      catalog,
      userCities,
      importQueue,
      coverage,
      nominatim,
    });

    await service.discoverCitiesForUser("user-1");

    expect(importQueue.enqueueMissing).toHaveBeenCalledWith(
      expect.arrayContaining([
        { osmRelationId: 91738, name: "Colombes", priority: 4 },
        { osmRelationId: 7444, name: "Paris", priority: 1 },
      ]),
    );
  });
});
