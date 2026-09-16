import { beforeEach, describe, expect, it } from "vitest";

import { createServiceHarness, HARNESS_ATHLETE_ID } from "@tests/fakes/service-harness";

import { StravaApiError } from "../strava/strava-client";
import type { StravaWebhookEvent } from "../strava/strava-types";

import { createStravaWebhookService } from "./strava-webhook-service";

function activityEvent(overrides: Partial<StravaWebhookEvent> = {}): StravaWebhookEvent {
  return {
    object_type: "activity",
    object_id: 1001,
    aspect_type: "create",
    owner_id: HARNESS_ATHLETE_ID,
    subscription_id: 1,
    event_time: 1_758_000_000,
    ...overrides,
  };
}

describe("createStravaWebhookService", () => {
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let service: ReturnType<typeof createStravaWebhookService>;

  beforeEach(async () => {
    harness = await createServiceHarness();
    service = createStravaWebhookService(harness);
  });

  it("imports a newly created run", async () => {
    harness.strava.getActivity.mockResolvedValueOnce(harness.buildOwnedActivity({ id: 1001 }));

    await service.handleEvent(activityEvent());

    expect(harness.activityRows.get(1001)).toMatchObject({ userId: harness.user.id, name: "Morning Run" });
  });

  it("removes a run that Strava no longer returns", async () => {
    harness.strava.getActivity.mockResolvedValueOnce(harness.buildOwnedActivity({ id: 1001 }));
    await service.handleEvent(activityEvent());

    await service.handleEvent(activityEvent({ aspect_type: "delete" }));

    expect(harness.activityRows.has(1001)).toBe(false);
  });

  it("keeps a run when a forged delete event targets an activity that still exists", async () => {
    harness.strava.getActivity.mockResolvedValue(harness.buildOwnedActivity({ id: 1001 }));
    await service.handleEvent(activityEvent());

    await service.handleEvent(activityEvent({ aspect_type: "delete" }));

    expect(harness.activityRows.has(1001)).toBe(true);
  });

  it("removes a run whose sport type changed to something else", async () => {
    harness.strava.getActivity.mockResolvedValueOnce(harness.buildOwnedActivity({ id: 1001 }));
    await service.handleEvent(activityEvent());
    harness.strava.getActivity.mockResolvedValueOnce(harness.buildOwnedActivity({ id: 1001, sport_type: "Ride" }));

    await service.handleEvent(activityEvent({ aspect_type: "update" }));

    expect(harness.activityRows.has(1001)).toBe(false);
  });

  it("never imports another athlete's public activity", async () => {
    harness.strava.getActivity.mockResolvedValueOnce(harness.buildOwnedActivity({ athlete: { id: 999 } }));

    await service.handleEvent(activityEvent());

    expect(harness.activityRows.size).toBe(0);
  });

  it("ignores events for athletes that are not linked", async () => {
    await service.handleEvent(activityEvent({ owner_id: 12345 }));
    expect(harness.strava.getActivity).not.toHaveBeenCalled();
  });

  it("deletes the user when Strava confirms the deauthorization", async () => {
    harness.strava.refreshAccessToken.mockRejectedValueOnce(new StravaApiError(401, "Unauthorized"));

    await service.handleEvent(
      activityEvent({ object_type: "athlete", aspect_type: "update", updates: { authorized: "false" } }),
    );

    expect(await harness.users.findById(harness.user.id)).toBeUndefined();
    expect(await harness.accounts.findByAthleteId(HARNESS_ATHLETE_ID)).toBeUndefined();
  });

  it("keeps the user when a forged deauthorization is contradicted by Strava", async () => {
    await service.handleEvent(
      activityEvent({ object_type: "athlete", aspect_type: "update", updates: { authorized: "false" } }),
    );

    expect(await harness.users.findById(harness.user.id)).toBeDefined();
  });
});
