import "server-only";

import { NextResponse } from "next/server";

import { getServerEnv } from "@/server/env";
import { verifyMobileSessionToken } from "@/server/mobile/session-token";
import { publicApiOrigin } from "@/server/mobile/public-api-origin";
import type { User } from "@/server/db/schema";
import { getServices } from "@/server/services";

export { publicApiOrigin };

export function bearerTokenFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function requireMobileUser(request: Request): Promise<User | NextResponse> {
  const token = bearerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "missing_bearer_token" }, { status: 401 });
  }

  const claims = await verifyMobileSessionToken(token, getServerEnv().AUTH_SECRET);
  if (!claims) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const user = await getServices().users.findById(claims.sub);
  if (!user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 401 });
  }
  return user;
}

export function isNextResponse(value: User | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export const MOBILE_APP_OAUTH_REDIRECT = "planetrun://oauth";
