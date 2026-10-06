import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { getServices } from "@/server/services";

/**
 * Permanently delete the signed-in athlete: revoke Strava, then wipe Cityfil data.
 * Mirrors the web `deleteMyData` server action for the Expo client.
 */
export async function DELETE(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  await getServices().accountDeletion.deleteAccount(userOrError.id);
  return NextResponse.json({ ok: true });
}
