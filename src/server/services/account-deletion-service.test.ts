import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceHarness, HARNESS_ATHLETE_ID } from "@tests/fakes/service-harness";

import { StravaApiError } from "../strava/strava-client";
import { toActivityRecord } from "../strava/run-activity";

import { createAccountDeletionService } from "./account-deletion-service";

describe("createAccountDeletionService", () => {
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let reportError: ReturnType<typeof vi.fn<(message: string, error: unknown) => void>>;
  let service: ReturnType<typeof createAccountDeletionService>;

  beforeEach(async () => {
    harness = await createServiceHarness();
    reportError = vi.fn<(message: string, error: unknown) => void>();
    service = createAccountDeletionService({ ...harness, reportError });
    await harness.activities.upsertMany([toActivityRecord(harness.buildOwnedActivity({ id: 1 }), harness.user.id)]);
  });

  it("revokes Strava access and deletes the user, account and runs", async () => {
    await service.deleteAccount(harness.user.id);

    expect(harness.strava.deauthorize).toHaveBeenCalledWith("access");
    expect(await harness.users.findById(harness.user.id)).toBeUndefined();
    expect(await harness.accounts.findByAthleteId(HARNESS_ATHLETE_ID)).toBeUndefined();
    expect(harness.activityRows.size).toBe(0);
  });

  it("still deletes everything when Strava refuses the revocation", async () => {
    harness.strava.deauthorize.mockRejectedValueOnce(new StravaApiError(503, "Unavailable"));

    await service.deleteAccount(harness.user.id);

    expect(await harness.users.findById(harness.user.id)).toBeUndefined();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it("deletes a user whose Strava account is already gone", async () => {
    await harness.users.delete(harness.user.id);
    await expect(service.deleteAccount(harness.user.id)).resolves.toBeUndefined();
    expect(harness.strava.deauthorize).not.toHaveBeenCalled();
  });
});
