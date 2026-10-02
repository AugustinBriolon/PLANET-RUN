import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceHarness, HARNESS_ATHLETE_ID } from "@tests/fakes/service-harness";

import { StravaApiError } from "../strava/strava-client";

import {
  createRunUploadService,
  StravaAccountMissingError,
  StravaWritePermissionError,
  toRunUploadState,
} from "./run-upload-service";

const START = Date.UTC(2026, 9, 2, 7, 0, 0);
const RUN = {
  clientRunId: "3f1c",
  name: "Rennes conquest",
  segments: [
    [
      { lat: 48.11, lng: -1.68, time: START },
      { lat: 48.111, lng: -1.681, time: START + 4_000 },
    ],
  ],
};

describe("toRunUploadState", () => {
  it("is processing until Strava created the activity", () => {
    expect(toRunUploadState({ id: 1, error: null, status: "processing", activity_id: null })).toEqual({
      status: "processing",
      uploadId: 1,
    });
  });

  it("is ready once the activity exists", () => {
    expect(toRunUploadState({ id: 1, error: null, status: "ready", activity_id: 99 })).toEqual({
      status: "ready",
      uploadId: 1,
      activityId: 99,
    });
  });

  it("treats a duplicate of an existing activity as ready, even inside a link", () => {
    const error = "x.gpx duplicate of <a href='/activities/21234316' target='_blank'>activity 21234316</a>";
    expect(toRunUploadState({ id: 1, error, status: "error", activity_id: null })).toMatchObject({
      status: "ready",
      activityId: 21234316,
    });
  });

  it("reports other processing errors without HTML", () => {
    expect(
      toRunUploadState({ id: 1, error: "<b>Bad</b> file", status: "There was an error.", activity_id: null }),
    ).toEqual({ status: "failed", uploadId: 1, reason: "Bad file" });
  });
});

describe("createRunUploadService", () => {
  let harness: Awaited<ReturnType<typeof createServiceHarness>>;
  let importActivity: ReturnType<typeof vi.fn<(athleteId: number, activityId: number) => Promise<void>>>;
  let service: ReturnType<typeof createRunUploadService>;

  beforeEach(async () => {
    harness = await createServiceHarness();
    importActivity = vi.fn<(athleteId: number, activityId: number) => Promise<void>>().mockResolvedValue(undefined);
    service = createRunUploadService({ ...harness, importActivity });
  });

  it("uploads the run as GPX under an idempotent external id", async () => {
    await expect(service.uploadRun(harness.user.id, RUN)).resolves.toEqual({ status: "processing", uploadId: 500 });

    const [accessToken, input] = harness.strava.uploadActivity.mock.calls[0]!;
    expect(accessToken).toBe("access");
    expect(input.externalId).toBe("planet-run-3f1c");
    expect(input.gpx).toContain("<trkseg>");
    expect(importActivity).not.toHaveBeenCalled();
  });

  it("imports the activity as soon as Strava finished processing", async () => {
    harness.strava.getUpload.mockResolvedValueOnce({ id: 500, error: null, status: "ready", activity_id: 1234 });

    await expect(service.getUploadState(harness.user.id, 500)).resolves.toMatchObject({ activityId: 1234 });
    expect(importActivity).toHaveBeenCalledWith(HARNESS_ATHLETE_ID, 1234);
  });

  it("asks for a Strava reconnection when the write scope is missing", async () => {
    harness.strava.uploadActivity.mockRejectedValueOnce(new StravaApiError(401, "Authorization Error"));

    await expect(service.uploadRun(harness.user.id, RUN)).rejects.toBeInstanceOf(StravaWritePermissionError);
  });

  it("rejects users without a linked Strava account", async () => {
    await expect(service.uploadRun("someone-else", RUN)).rejects.toBeInstanceOf(StravaAccountMissingError);
  });
});
