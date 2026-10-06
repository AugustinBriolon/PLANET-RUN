import { beforeEach, describe, expect, it } from "vitest";

import type { CityCoverage } from "@/lib/coverage/street-coverage";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";

import { createInMemoryConquestRepository } from "@tests/fakes/in-memory-conquest-repository";
import { createInMemoryCoverageRepository } from "@tests/fakes/in-memory-coverage-repository";
import { createInMemoryRepositories } from "@tests/fakes/in-memory-repositories";

import {
  CityNotOnProfileError,
  createConquestService,
  InviteOwnError,
} from "./conquest-service";

const NOW = new Date("2026-10-06T10:00:00Z");
const RENNES = 7;

function city(overrides: Partial<CityCoverage> = {}): CityCoverage {
  return {
    areaId: RENNES,
    name: "Rennes",
    status: "ready",
    coveredMeters: 1_000,
    totalMeters: 10_000,
    bounds: null,
    ...overrides,
  };
}

describe("createConquestService", () => {
  const memory = () => {
    const repositories = createInMemoryRepositories();
    const coverageRows = new Map<string, CityCoverage[]>();
    const distances = new Map<string, number>();
    const season = new Map<string, number>();
    const { coverage: coverageBase } = createInMemoryCoverageRepository(repositories.activityRows);
    const coverage: CoverageRepository = {
      ...coverageBase,
      async listCityCoverage(userId) {
        return coverageRows.get(userId) ?? [];
      },
      async sumActivityDistanceInArea(userId) {
        return distances.get(userId) ?? 0;
      },
      async listSeasonCoveredMeters() {
        return [...season.entries()].map(([userId, meters]) => ({ userId, meters }));
      },
    };
    const citiesByUser = new Map<string, { osmRelationId: number; name: string }[]>();
    const userCities: UserCityRepository = {
      async upsertMany(userId, cities) {
        const current = citiesByUser.get(userId) ?? [];
        const merged = new Map(current.map((city) => [city.osmRelationId, city]));
        for (const city of cities) merged.set(city.osmRelationId, city);
        citiesByUser.set(userId, [...merged.values()]);
      },
      async listByUser(userId) {
        const stored = citiesByUser.get(userId);
        if (stored) return stored;
        return (coverageRows.get(userId) ?? []).map((entry) => ({
          osmRelationId: entry.areaId,
          name: entry.name,
        }));
      },
      async listGeocodeCells() {
        return new Set();
      },
      async markGeocodeCells() {},
    };
    const conquests = createInMemoryConquestRepository();
    const service = createConquestService({
      users: repositories.users,
      userCities,
      coverage,
      conquests,
      now: () => NOW,
      randomToken: () => "invite-token",
    });
    return { repositories, coverageRows, distances, season, conquests, service };
  };

  let harness: ReturnType<typeof memory>;

  beforeEach(() => {
    harness = memory();
  });

  async function addUser(name: string, shareMeters = 1_000) {
    const user = await harness.repositories.accounts.createWithUser(
      { displayName: name, avatarUrl: null },
      {
        athleteId: harness.repositories.accountRows.size + 1,
        accessTokenEncrypted: "a",
        refreshTokenEncrypted: "r",
        tokenExpiresAt: NOW,
      },
    );
    harness.coverageRows.set(user.id, [city({ coveredMeters: shareMeters })]);
    harness.distances.set(user.id, shareMeters);
    return user;
  }

  it("stamps a 100% city once and ignores later refresh", async () => {
    const ada = await addUser("Ada", 10_000);
    await harness.service.refreshForUser(ada.id);
    await harness.service.refreshForUser(ada.id);
    expect(harness.conquests.conquests).toHaveLength(1);
    expect(harness.conquests.conquests[0]).toMatchObject({
      userId: ada.id,
      areaId: RENNES,
      completionDistanceMeters: 10_000,
    });
  });

  it("reuses a live invite and rejects accepting your own", async () => {
    const ada = await addUser("Ada");
    const first = await harness.service.createInvite(ada.id, RENNES);
    const second = await harness.service.createInvite(ada.id, RENNES);
    expect(first.token).toBe("invite-token");
    expect(second.token).toBe(first.token);
    await expect(harness.service.acceptInvite(ada.id, first.token)).rejects.toBeInstanceOf(InviteOwnError);
  });

  it("refuses to invite a city the runner does not have", async () => {
    const ada = await addUser("Ada");
    await expect(harness.service.createInvite(ada.id, 99)).rejects.toBeInstanceOf(CityNotOnProfileError);
  });

  it("makes two runners rivals and shows the private opponent only to them", async () => {
    const ada = await addUser("Ada", 3_000);
    const grace = await addUser("Grace", 10_000);
    harness.season.set(grace.id, 400);
    await harness.service.refreshForUser(grace.id);

    const { token } = await harness.service.createInvite(ada.id, RENNES);
    await harness.service.acceptInvite(grace.id, token);

    const adaBoard = await harness.service.getCityBoard(ada.id, RENNES);
    expect(adaBoard?.rivals).toEqual([
      expect.objectContaining({ userId: grace.id, displayName: "Grace", share: 1 }),
    ]);
    expect(adaBoard?.hall.founder?.displayName).toBe("Grace");
    expect(adaBoard?.you.isFounder).toBe(false);

    const stranger = await addUser("Stranger", 0);
    harness.coverageRows.set(stranger.id, [city({ coveredMeters: 0 })]);
    const strangerBoard = await harness.service.getCityBoard(stranger.id, RENNES);
    expect(strangerBoard?.hall.founder?.displayName).toBe("Hidden runner");
    expect(strangerBoard?.hall.conquerors).toEqual([]);
  });
});
