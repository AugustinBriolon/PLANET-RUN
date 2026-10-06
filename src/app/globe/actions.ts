"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { signIn, signOut } from "@/auth";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";
import { MANUAL_SYNC_MAX_ATTEMPTS, tryConsumeManualSync } from "@/server/runs/manual-sync-rate-limit";
import { SESSION_EXPIRED_FAILURE, toSyncFailure } from "@/server/runs/to-sync-failure";
import { scheduleCityPipeline, scheduleHistoryThenCities } from "@/server/services/city-pipeline";
import { getServices } from "@/server/services";
import { getCurrentUser } from "@/server/session";

export async function syncRuns(): Promise<RunSyncActionResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", ...SESSION_EXPIRED_FAILURE };

  const slot = tryConsumeManualSync(user.id);
  if (!slot.ok) {
    const retryMinutes = Math.max(1, Math.ceil(slot.retryAfterMs / 60_000));
    return {
      status: "error",
      reason: "rate-limited",
      message: `Sync limit reached (${MANUAL_SYNC_MAX_ATTEMPTS} per 15 minutes). Try again in about ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`,
    };
  }

  try {
    const result = await getServices().runSync.syncRuns(user.id);
    if (result.continues) scheduleHistoryThenCities(user.id);
    scheduleCityPipeline(user.id);
    refresh();
    return { status: "success", syncedRuns: result.syncedRuns };
  } catch (error) {
    console.error("Run sync failed", error);
    return { status: "error", ...toSyncFailure(error) };
  }
}

/**
 * Strava silently reuses a previous grant when `approval_prompt=auto`, even if it lacks activity access.
 * Forcing the consent screen lets the athlete grant the missing scope.
 */
export async function reconnectStrava() {
  await signIn("strava", { redirectTo: "/globe" }, { approval_prompt: "force" });
}

export async function signOutFromCityfil() {
  await signOut({ redirectTo: "/login" });
}

export async function deleteMyData() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await getServices().accountDeletion.deleteAccount(user.id);
  await signOut({ redirectTo: "/login?deleted=1" });
}
