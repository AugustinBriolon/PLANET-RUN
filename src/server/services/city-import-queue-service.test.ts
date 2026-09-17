import { describe, expect, it, vi } from "vitest";

import type { OverpassClient } from "@/server/osm/overpass-client";
import type { AreaRepository } from "@/server/repositories/area-repository";
import type { CityImportQueueRepository } from "@/server/repositories/city-import-queue-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

import { createCityImportQueueService } from "./city-import-queue-service";

describe("createCityImportQueueService", () => {
  it("skips Overpass when the shared street cache already has the city", async () => {
    const importQueue: CityImportQueueRepository = {
      enqueueMissing: vi.fn(),
      claimNext: vi.fn(async () => ({
        osmRelationId: 91738,
        name: "Colombes",
        status: "importing" as const,
        attempts: 1,
      })),
      complete: vi.fn(),
      fail: vi.fn(),
      hasWork: vi.fn(async () => false),
    };
    const areas: AreaRepository = {
      listAll: vi.fn(async () => []),
      hasArea: vi.fn(async () => true),
      findAreasContainingPoints: vi.fn(async () => []),
      filterPointsOutsideAreas: vi.fn(async (points) => points),
      replaceArea: vi.fn(),
    };
    const overpass: OverpassClient = { fetchCity: vi.fn() };
    const coverage: Pick<CoverageRepository, "markAllActivitiesPending" | "matchPendingActivities"> = {
      markAllActivitiesPending: vi.fn(),
      matchPendingActivities: vi.fn(async () => 0),
    };

    const result = await createCityImportQueueService({ areas, importQueue, overpass, coverage }).processNext();

    expect(result).toEqual({ imported: false, cityName: "Colombes", hasMore: false });
    expect(overpass.fetchCity).not.toHaveBeenCalled();
    expect(importQueue.complete).toHaveBeenCalledWith(91738);
  });

  it("imports a missing city into the shared street cache", async () => {
    const importQueue: CityImportQueueRepository = {
      enqueueMissing: vi.fn(),
      claimNext: vi.fn(async () => ({
        osmRelationId: 91738,
        name: "Colombes",
        status: "importing" as const,
        attempts: 1,
      })),
      complete: vi.fn(),
      fail: vi.fn(),
      hasWork: vi.fn(async () => true),
    };
    const areas: AreaRepository = {
      listAll: vi.fn(async () => []),
      hasArea: vi.fn(async () => false),
      findAreasContainingPoints: vi.fn(async () => []),
      filterPointsOutsideAreas: vi.fn(async (points) => points),
      replaceArea: vi.fn(async () => ({ segmentCount: 10, streetLengthMeters: 1000 })),
    };
    const overpass: OverpassClient = {
      fetchCity: vi.fn(async () => ({
        osmRelationId: 91738,
        name: "Colombes",
        adminLevel: 8,
        boundaryLines: [],
        streets: [],
      })),
    };
    const coverage: Pick<CoverageRepository, "markAllActivitiesPending" | "matchPendingActivities"> = {
      markAllActivitiesPending: vi.fn(async () => {}),
      matchPendingActivities: vi.fn(async () => 3),
    };

    const result = await createCityImportQueueService({ areas, importQueue, overpass, coverage }).processNext();

    expect(result).toEqual({ imported: true, cityName: "Colombes", hasMore: true });
    expect(overpass.fetchCity).toHaveBeenCalledWith(91738);
    expect(importQueue.complete).toHaveBeenCalledWith(91738);
  });
});
