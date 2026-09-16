"use server";

import { refresh } from "next/cache";

import { signIn, signOut } from "@/auth";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";
import { SESSION_EXPIRED_FAILURE, toSyncFailure } from "@/server/runs/to-sync-failure";
import { getServices } from "@/server/services";
import { getCurrentUser } from "@/server/session";

export async function syncRuns(): Promise<RunSyncActionResult> {
  const user = await getCurrentUser();
  if (!user) return { status: "error", ...SESSION_EXPIRED_FAILURE };

  try {
    const { syncedRuns } = await getServices().runSync.syncRuns(user.id);
    refresh();
    return { status: "success", syncedRuns };
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

export async function signOutFromPlanetRun() {
  await signOut({ redirectTo: "/login" });
}
