import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { MANUAL_SYNC_MAX_ATTEMPTS, tryConsumeManualSync } from "@/server/runs/manual-sync-rate-limit";
import { toSyncFailure } from "@/server/runs/to-sync-failure";
import { scheduleCityPipeline } from "@/server/services/city-pipeline";
import { getServices } from "@/server/services";

/** Manual Strava sync for the mobile client (same rate limit as the web globe). */
export async function POST(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const slot = tryConsumeManualSync(userOrError.id);
  if (!slot.ok) {
    const retryMinutes = Math.max(1, Math.ceil(slot.retryAfterMs / 60_000));
    return NextResponse.json(
      {
        status: "error",
        reason: "rate-limited",
        message: `Sync limit reached (${MANUAL_SYNC_MAX_ATTEMPTS} per 15 minutes). Try again in about ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
      },
      { status: 429 },
    );
  }

  try {
    const { syncedRuns } = await getServices().runSync.syncRuns(userOrError.id);
    scheduleCityPipeline(userOrError.id);
    return NextResponse.json({ status: "success", syncedRuns });
  } catch (error) {
    console.error("Mobile run sync failed", error);
    return NextResponse.json({ status: "error", ...toSyncFailure(error) }, { status: 502 });
  }
}
