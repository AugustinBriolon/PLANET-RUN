import "server-only";

import { NextResponse } from "next/server";

import {
  StravaAccountMissingError,
  StravaWritePermissionError,
  type RunUploadState,
} from "@/server/services/run-upload-service";
import { scheduleCityPipeline } from "@/server/services/city-pipeline";
import { StravaApiError } from "@/server/strava/strava-client";

const NO_STORE = { "Cache-Control": "no-store" };

/** Shared response for starting and polling a run upload. */
export async function respondWithUpload(userId: string, run: () => Promise<RunUploadState>) {
  try {
    const upload = await run();
    // New streets or a new city may need analysing for this run.
    if (upload.status === "ready") scheduleCityPipeline(userId);
    return NextResponse.json({ upload }, { status: upload.status === "processing" ? 202 : 200, headers: NO_STORE });
  } catch (error) {
    if (error instanceof StravaWritePermissionError) {
      return NextResponse.json({ error: "strava_write_permission_required" }, { status: 403, headers: NO_STORE });
    }
    if (error instanceof StravaAccountMissingError) {
      return NextResponse.json({ error: "strava_account_missing" }, { status: 409, headers: NO_STORE });
    }
    if (error instanceof StravaApiError && error.isRateLimited) {
      return NextResponse.json({ error: "strava_rate_limited" }, { status: 429, headers: NO_STORE });
    }
    if (error instanceof StravaApiError && error.isNotFound) {
      return NextResponse.json({ error: "upload_not_found" }, { status: 404, headers: NO_STORE });
    }
    console.error("Run upload failed", error);
    return NextResponse.json({ error: "upload_failed" }, { status: 502, headers: NO_STORE });
  }
}
