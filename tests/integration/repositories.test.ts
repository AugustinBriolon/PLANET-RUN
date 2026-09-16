import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createActivityRepository } from "@/server/repositories/activity-repository";
import { createStravaAccountRepository } from "@/server/repositories/strava-account-repository";
import { createUserRepository } from "@/server/repositories/user-repository";
import { toActivityRecord } from "@/server/strava/run-activity";

import { buildStravaActivity } from "../fixtures/strava";

import { createTestDatabase } from "./test-database";

const testDatabase = createTestDatabase();
const users = createUserRepository(testDatabase.database);
const accounts = createStravaAccountRepository(testDatabase.database);
const activities = createActivityRepository(testDatabase.database);

const tokens = {
  accessTokenEncrypted: "encrypted-access",
  refreshTokenEncrypted: "encrypted-refresh",
  tokenExpiresAt: new Date("2026-09-16T18:00:00Z"),
};

function linkAthlete(athleteId: number, displayName = "Ada") {
  return accounts.createWithUser({ displayName, avatarUrl: null }, { athleteId, ...tokens });
}

describe("Postgres repositories", () => {
  beforeEach(async () => {
    await testDatabase.reset();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe("strava account ↔ user binding", () => {
    it("creates the user and its Strava account atomically", async () => {
      const user = await linkAthlete(42);

      expect(await users.findById(user.id)).toMatchObject({ displayName: "Ada" });
      expect(await accounts.findByUserId(user.id)).toMatchObject({ athleteId: 42, ...tokens, lastSyncedAt: null });
    });

    it("refuses to bind the same athlete twice and leaves no orphan user", async () => {
      await linkAthlete(42);

      await expect(linkAthlete(42, "Impostor")).rejects.toThrow();

      const orphan = await testDatabase.database.query.users.findFirst({
        where: (table, { eq }) => eq(table.displayName, "Impostor"),
      });
      expect(orphan).toBeUndefined();
    });

    it("rotates tokens and records sync time", async () => {
      await linkAthlete(42);
      const rotated = { ...tokens, accessTokenEncrypted: "rotated" };
      const syncedAt = new Date("2026-09-16T12:00:00Z");

      await accounts.updateTokens(42, rotated);
      await accounts.markSynced(42, syncedAt);

      expect(await accounts.findByAthleteId(42)).toMatchObject({
        accessTokenEncrypted: "rotated",
        lastSyncedAt: syncedAt,
      });
    });
  });

  describe("activities", () => {
    it("upserts runs idempotently and lists them chronologically", async () => {
      const user = await linkAthlete(42);
      const later = toActivityRecord(buildStravaActivity({ id: 2, start_date: "2026-09-02T06:00:00Z" }), user.id);
      const earlier = toActivityRecord(buildStravaActivity({ id: 1, start_date: "2026-09-01T06:00:00Z" }), user.id);

      await activities.upsertMany([later, earlier]);
      await activities.upsertMany([{ ...later, name: "Renamed" }]);

      const runs = await activities.listByUser(user.id);
      expect(runs.map((run) => [run.stravaActivityId, run.name])).toEqual([
        [1, "Morning Run"],
        [2, "Renamed"],
      ]);
    });

    it("never moves an existing activity to another user", async () => {
      const owner = await linkAthlete(42);
      const intruder = await linkAthlete(7, "Grace");
      const record = toActivityRecord(buildStravaActivity({ id: 1 }), owner.id);

      await activities.upsertMany([record]);
      await activities.upsertMany([{ ...record, userId: intruder.id, name: "Hijacked" }]);

      expect(await activities.listByUser(intruder.id)).toEqual([]);
      expect((await activities.listByUser(owner.id))[0]).toMatchObject({ name: "Morning Run" });
    });

    it("only deletes activities belonging to the given user", async () => {
      const owner = await linkAthlete(42);
      const other = await linkAthlete(7, "Grace");
      await activities.upsertMany([toActivityRecord(buildStravaActivity({ id: 1 }), owner.id)]);

      await activities.deleteForUser(other.id, 1);
      expect(await activities.listByUser(owner.id)).toHaveLength(1);

      await activities.deleteForUser(owner.id, 1);
      expect(await activities.listByUser(owner.id)).toHaveLength(0);
    });
  });

  it("deleting a user cascades to its Strava account and activities", async () => {
    const user = await linkAthlete(42);
    await activities.upsertMany([toActivityRecord(buildStravaActivity({ id: 1 }), user.id)]);

    await users.delete(user.id);

    expect(await accounts.findByAthleteId(42)).toBeUndefined();
    expect(await activities.listByUser(user.id)).toEqual([]);
  });
});
