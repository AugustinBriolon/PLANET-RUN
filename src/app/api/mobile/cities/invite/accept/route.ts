import { NextResponse } from "next/server";
import { z } from "zod";

import { isNextResponse, requireMobileUser } from "@/server/mobile/request-auth";
import { inviteErrorResponse } from "@/server/conquest/invite-error-response";
import { getServices } from "@/server/services";

const bodySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/),
});

/** Accepts a city rivalry invite for the signed-in runner. */
export async function POST(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const result = await getServices().conquest.acceptInvite(userOrError.id, parsed.data.token);
    return NextResponse.json(result);
  } catch (error) {
    return inviteErrorResponse(error) ?? NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }
}
