import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { respondWithUpload } from "@/server/runs/upload-response";
import { runUploadBodySchema } from "@/server/runs/upload-body";
import { getServices } from "@/server/services";

/**
 * Sends a run recorded in the app to Strava (needs the `activity:write` scope).
 * POST /api/mobile/runs/upload → 202 `{ upload }` while Strava processes the file.
 */
export async function POST(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = runUploadBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", reason: "This run could not be read." }, { status: 400 });
  }

  return respondWithUpload(userOrError.id, () => getServices().runUpload.uploadRun(userOrError.id, parsed.data));
}
