import { NextResponse } from "next/server";
import { z } from "zod";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { respondWithUpload } from "@/server/runs/upload-response";
import { getServices } from "@/server/services";

// ~11 h at one fix per second: far beyond any run, small enough for a serverless body.
const MAX_POINTS = 40_000;

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  time: z.number().int().positive(),
  altitude: z.number().finite().nullish(),
});

const bodySchema = z
  .object({
    clientRunId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
    name: z.string().trim().min(1).max(120),
    segments: z.array(z.array(pointSchema)).min(1),
  })
  .refine(({ segments }) => {
    const count = segments.reduce((total, segment) => total + segment.length, 0);
    return count >= 2 && count <= MAX_POINTS;
  }, "segments must hold between 2 and 40000 points");

/**
 * Sends a run recorded in the app to Strava (needs the `activity:write` scope).
 * POST /api/mobile/runs/upload → 202 `{ upload }` while Strava processes the file.
 */
export async function POST(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  return respondWithUpload(userOrError.id, () => getServices().runUpload.uploadRun(userOrError.id, parsed.data));
}
