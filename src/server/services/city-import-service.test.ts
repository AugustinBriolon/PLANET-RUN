import { describe, expect, it, vi } from "vitest";

import type { OverpassClient } from "@/server/osm/overpass-client";
import type { AreaImport, AreaRepository } from "@/server/repositories/area-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";

import { createCityImportService } from "./city-import-service";

const city: AreaImport = {
  osmRelationId: 91738,
  name: "Colombes",
  adminLevel: 8,
  boundaryLines: [],
  streets: [],
};

describe("createCityImportService", () => {
  it("replaces the city's streets, then re-matches every run against them", async () => {
    const calls: string[] = [];
    const overpass: OverpassClient = { fetchCity: vi.fn().mockResolvedValue(city) };
    const areas: AreaRepository = {
      replaceArea: vi.fn(async () => {
        calls.push("replaceArea");
        return { segmentCount: 3000, streetLengthMeters: 110_000 };
      }),
    };
    const coverage: Pick<CoverageRepository, "markAllActivitiesPending" | "matchPendingActivities"> = {
      markAllActivitiesPending: vi.fn(async () => {
        calls.push("markAllActivitiesPending");
      }),
      matchPendingActivities: vi.fn(async () => {
        calls.push("matchPendingActivities");
        return 116;
      }),
    };

    const result = await createCityImportService({ overpass, areas, coverage }).importCity(91738);

    expect(overpass.fetchCity).toHaveBeenCalledWith(91738);
    expect(areas.replaceArea).toHaveBeenCalledWith(city);
    expect(coverage.matchPendingActivities).toHaveBeenCalledWith();
    expect(calls).toEqual(["replaceArea", "markAllActivitiesPending", "matchPendingActivities"]);
    expect(result).toEqual({ name: "Colombes", segmentCount: 3000, streetLengthMeters: 110_000, matchedRuns: 116 });
  });
});
