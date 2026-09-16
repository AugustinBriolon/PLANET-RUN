import { beforeEach, describe, expect, it } from "vitest";

import { createServiceHarness, HARNESS_ATHLETE_ID, HARNESS_NOW } from "@tests/fakes/service-harness";

import { createRunSyncService } from "./run-sync-service";

describe("createRunSyncService", () => {
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let service: ReturnType<typeof createRunSyncService>;

  beforeEach(async () => {
    harness = await createServiceHarness();
    service = createRunSyncService(harness);
  });

  it("imports only mappable runs and records the sync time", async () => {
    harness.strava.listActivities.mockResolvedValueOnce([
      harness.buildOwnedActivity({ id: 1 }),
      harness.buildOwnedActivity({ id: 2, sport_type: "Ride" }),
      harness.buildOwnedActivity({ id: 3, sport_type: "TrailRun" }),
    ]);

    await expect(service.syncRuns(harness.user.id)).resolves.toEqual({ syncedRuns: 2 });

    expect([...harness.activityRows.keys()]).toEqual([1, 3]);
    expect((await harness.accounts.findByAthleteId(HARNESS_ATHLETE_ID))?.lastSyncedAt).toEqual(HARNESS_NOW);
  });

  it("fetches the whole history page by page on first import", async () => {
    const fullPage = Array.from({ length: 200 }, (_, index) => harness.buildOwnedActivity({ id: index + 1 }));
    harness.strava.listActivities
      .mockResolvedValueOnce(fullPage)
      .mockResolvedValueOnce([harness.buildOwnedActivity({ id: 999 })]);

    await expect(service.syncRuns(harness.user.id)).resolves.toEqual({ syncedRuns: 201 });

    expect(harness.strava.listActivities).toHaveBeenCalledTimes(2);
    expect(harness.strava.listActivities).toHaveBeenNthCalledWith(1, "access", {
      afterEpochSeconds: undefined,
      page: 1,
      perPage: 200,
    });
    expect(harness.strava.listActivities.mock.calls[1]![1].page).toBe(2);
  });

  it("re-scans a one-week window before the previous sync", async () => {
    const lastSyncedAt = new Date("2026-09-10T00:00:00Z");
    await harness.accounts.markSynced(HARNESS_ATHLETE_ID, lastSyncedAt);

    await service.syncRuns(harness.user.id);

    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    expect(harness.strava.listActivities.mock.calls[0]![1].afterEpochSeconds).toBe(
      lastSyncedAt.getTime() / 1000 - sevenDaysInSeconds,
    );
  });

  it("does not mark the account as synced when Strava fails", async () => {
    harness.strava.listActivities.mockRejectedValueOnce(new Error("network down"));

    await expect(service.syncRuns(harness.user.id)).rejects.toThrow("network down");
    expect((await harness.accounts.findByAthleteId(HARNESS_ATHLETE_ID))?.lastSyncedAt).toBeNull();
  });

  it("fails for users without a linked Strava account", async () => {
    await expect(service.syncRuns("unknown-user")).rejects.toThrow(/No Strava account/);
  });
});
