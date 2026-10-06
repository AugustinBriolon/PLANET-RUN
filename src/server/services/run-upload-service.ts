import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import { buildRunGpx, type RecordedRun } from "@/server/strava/gpx";
import { StravaApiError, type StravaClient } from "@/server/strava/strava-client";
import type { StravaUpload } from "@/server/strava/strava-types";

import type { StravaTokenService } from "./strava-token-service";

export type RunUploadState =
  | { status: "processing"; uploadId: number }
  | { status: "ready"; uploadId: number; activityId: number }
  | { status: "failed"; uploadId: number; reason: string };

/** The athlete signed in before Cityfil asked for `activity:write`: they must reconnect Strava. */
export class StravaWritePermissionError extends Error {
  constructor() {
    super("Strava write permission missing");
    this.name = "StravaWritePermissionError";
  }
}

export class StravaAccountMissingError extends Error {
  constructor() {
    super("No Strava account linked");
    this.name = "StravaAccountMissingError";
  }
}

// Strava reports a re-sent file as "<file> duplicate of activity 123" (sometimes wrapped in a link).
const DUPLICATE_PATTERN = /duplicate of\D*(\d+)/i;

/** Maps Strava's upload object to what the app needs; a duplicate counts as the existing activity. */
export function toRunUploadState(upload: StravaUpload): RunUploadState {
  if (upload.activity_id != null) return { status: "ready", uploadId: upload.id, activityId: upload.activity_id };
  if (upload.error) {
    const duplicateOf = DUPLICATE_PATTERN.exec(upload.error)?.[1];
    if (duplicateOf) return { status: "ready", uploadId: upload.id, activityId: Number(duplicateOf) };
    return { status: "failed", uploadId: upload.id, reason: upload.error.replace(/<[^>]*>/g, "") };
  }
  return { status: "processing", uploadId: upload.id };
}

export type UploadRunInput = RecordedRun & {
  /** Generated on the device when the run starts; makes retries idempotent. */
  clientRunId: string;
};

export type RunUploadService = {
  uploadRun: (userId: string, run: UploadRunInput) => Promise<RunUploadState>;
  getUploadState: (userId: string, uploadId: number) => Promise<RunUploadState>;
};

type Dependencies = {
  accounts: Pick<StravaAccountRepository, "findByUserId">;
  strava: Pick<StravaClient, "uploadActivity" | "getUpload">;
  tokens: Pick<StravaTokenService, "getValidAccessToken">;
  /** Imports the activity right away instead of waiting for Strava's webhook. */
  importActivity: (athleteId: number, activityId: number) => Promise<void>;
};

export function createRunUploadService({ accounts, strava, tokens, importActivity }: Dependencies): RunUploadService {
  async function withAccount<T>(userId: string, action: (athleteId: number, accessToken: string) => Promise<T>) {
    const account = await accounts.findByUserId(userId);
    if (!account) throw new StravaAccountMissingError();
    const accessToken = await tokens.getValidAccessToken(account);
    try {
      return await action(account.athleteId, accessToken);
    } catch (error) {
      if (error instanceof StravaApiError && error.isMissingPermission) throw new StravaWritePermissionError();
      throw error;
    }
  }

  async function settle(athleteId: number, upload: StravaUpload): Promise<RunUploadState> {
    const state = toRunUploadState(upload);
    if (state.status === "ready") await importActivity(athleteId, state.activityId);
    return state;
  }

  return {
    uploadRun(userId, { clientRunId, name, segments }) {
      return withAccount(userId, async (athleteId, accessToken) => {
        const upload = await strava.uploadActivity(accessToken, {
          gpx: buildRunGpx({ name, segments }),
          name,
          externalId: `planet-run-${clientRunId}`,
        });
        return settle(athleteId, upload);
      });
    },

    getUploadState(userId, uploadId) {
      return withAccount(userId, async (athleteId, accessToken) =>
        settle(athleteId, await strava.getUpload(accessToken, uploadId)),
      );
    },
  };
}
