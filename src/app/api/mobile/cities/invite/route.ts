import { NextResponse } from "next/server";
import { z } from "zod";

import { isNextResponse, publicApiOrigin, requireMobileUser } from "@/server/mobile/request-auth";
import { inviteErrorResponse } from "@/server/conquest/invite-error-response";
import { getServices } from "@/server/services";

const bodySchema = z.object({
  areaId: z.number().int().positive(),
});

/** Creates (or reuses) a city rivalry invite. The URL opens the app, or a landing page on the web. */
export async function POST(request: Request) {
  const userOrError = await requireMobileUser(request);
  if (isNextResponse(userOrError)) return userOrError;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  try {
    const invite = await getServices().conquest.createInvite(userOrError.id, parsed.data.areaId);
    const origin = publicApiOrigin(request);
    return NextResponse.json({
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
      url: `${origin}/invite/${invite.token}`,
    });
  } catch (error) {
    return inviteErrorResponse(error) ?? NextResponse.json({ error: "invite_failed" }, { status: 500 });
  }
}
