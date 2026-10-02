import { NextResponse } from "next/server";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { respondWithUpload } from "@/server/runs/upload-response";
import { getServices } from "@/server/services";

/**
 * Polls a run upload. Once Strava created the activity it is imported right away,
 * so coverage updates without waiting for the webhook.
 */
export async function GET(request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const uploadId = Number((await params).uploadId);
  if (!Number.isSafeInteger(uploadId) || uploadId <= 0) {
    return NextResponse.json({ error: "invalid_upload_id" }, { status: 400 });
  }

  return respondWithUpload(userOrError.id, () => getServices().runUpload.getUploadState(userOrError.id, uploadId));
}
