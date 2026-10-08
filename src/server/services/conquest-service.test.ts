import { beforeEach, describe, expect, it } from "vitest";

import type { CityCoverage } from "@/lib/coverage/street-coverage";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";

import { createInMemoryConquestRepository } from "@tests/fakes/in-memory-conquest-repository";
import { createInMemoryCoverageRepository } from "@tests/fakes/in-memory-coverage-repository";
import { createInMemoryRepositories } from "@tests/fakes/in-memory-repositories";

import { CityNotOnProfileError, createConquestService } from "./conquest-service";

const NOW = new Date("2026-10-06T10:00:00Z");
const RENNES = 7;

function city(overrides: Partial<CityCoverage> = {}): CityCoverage {
  return {
    areaId: RENNES,
    name: "Rennes",
    status: "ready",
    coveredMeters: 1_000,
    strictCoveredMeters: 1_000,
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
    harness.coverageRows.set(user.id, [
      city({ coveredMeters: shareMeters, strictCoveredMeters: shareMeters }),
    ]);
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

  it("reuses a live invite and opens the city when the inviter taps their own link", async () => {
    const ada = await addUser("Ada");
    const first = await harness.service.createInvite(ada.id, RENNES);
    const second = await harness.service.createInvite(ada.id, RENNES);
    expect(first.token).toBe("invite-token");
    expect(second.token).toBe(first.token);
    await expect(harness.service.acceptInvite(ada.id, first.token)).resolves.toEqual({ areaId: RENNES });
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
    expect(adaBoard?.rivals).toEqual([expect.objectContaining({ userId: grace.id, displayName: "Grace", share: 1 })]);
    expect(adaBoard?.hall.founder?.displayName).toBe("Grace");
    expect(adaBoard?.you.isFounder).toBe(false);

    const stranger = await addUser("Stranger", 0);
    harness.coverageRows.set(stranger.id, [city({ coveredMeters: 0, strictCoveredMeters: 0 })]);
    const strangerBoard = await harness.service.getCityBoard(stranger.id, RENNES);
    expect(strangerBoard?.hall.founder?.displayName).toBe("Hidden runner");
    expect(strangerBoard?.hall.conquerors).toEqual([]);
  });

  it("cliques each new acceptor into the inviter's existing crew on that city", async () => {
    const ada = await addUser("Ada", 3_000);
    const grace = await addUser("Grace", 4_000);
    const bea = await addUser("Bea", 5_000);
    const { token } = await harness.service.createInvite(ada.id, RENNES);

    await harness.service.acceptInvite(grace.id, token);
    await harness.service.acceptInvite(bea.id, token);

    const graceBoard = await harness.service.getCityBoard(grace.id, RENNES);
    const beaBoard = await harness.service.getCityBoard(bea.id, RENNES);
    const adaBoard = await harness.service.getCityBoard(ada.id, RENNES);

    expect(graceBoard?.rivals.map((rival) => rival.userId).sort()).toEqual([ada.id, bea.id].sort());
    expect(beaBoard?.rivals.map((rival) => rival.userId).sort()).toEqual([ada.id, grace.id].sort());
    expect(adaBoard?.rivals.map((rival) => rival.userId).sort()).toEqual([bea.id, grace.id].sort());
  });

  it("previews coverage and vacant titles without naming holders", async () => {
    const ada = await addUser("Ada", 3_000);
    const { token } = await harness.service.createInvite(ada.id, RENNES);
    await expect(harness.service.previewInvite(token)).resolves.toEqual({
      areaId: RENNES,
      cityName: "Rennes",
      inviterName: "Ada",
      inviterShare: 0.3,
      founderOpen: true,
      conquerorOpen: true,
      keeperOpen: true,
    });

    const grace = await addUser("Grace", 10_000);
    harness.season.set(grace.id, 400);
    await harness.service.refreshForUser(grace.id);

    await expect(harness.service.previewInvite(token)).resolves.toMatchObject({
      inviterShare: 0.3,
      founderOpen: false,
      conquerorOpen: false,
      keeperOpen: false,
    });
  });
});
