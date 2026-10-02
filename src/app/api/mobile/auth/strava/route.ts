import { NextResponse } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/server/env";
import { publicApiOrigin } from "@/server/mobile/request-auth";
import { signMobileOAuthState } from "@/server/mobile/session-token";
import { completeMobileStravaSignIn } from "@/server/mobile/strava-sign-in";

// `activity:write` lets the app send runs recorded in Planet Run to Strava.
const MOBILE_STRAVA_SCOPE = "read,activity:read_all,activity:write";

/**
 * Starts the mobile Strava OAuth dance.
 * GET /api/mobile/auth/strava → 302 to Strava authorize.
 * `?reauth=1` forces the consent screen: with `approval_prompt=auto` Strava silently reuses an older,
 * narrower grant, so athletes who signed in before `activity:write` could never add it.
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const origin = publicApiOrigin(request);
  const redirectUri = `${origin}/api/mobile/auth/callback`;
  const state = await signMobileOAuthState(env.AUTH_SECRET, crypto.randomUUID());

  const authorize = new URL("https://www.strava.com/oauth/authorize");
  authorize.searchParams.set("client_id", env.STRAVA_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  const reauth = new URL(request.url).searchParams.get("reauth") === "1";
  authorize.searchParams.set("approval_prompt", reauth ? "force" : "auto");
  authorize.searchParams.set("scope", MOBILE_STRAVA_SCOPE);
  authorize.searchParams.set("state", state);

  return NextResponse.redirect(authorize);
}

const bodySchema = z.object({
  code: z.string().min(1),
});

/**
 * Alternate path: mobile POSTs the authorization code (when it already holds it).
 * Prefer the HTTPS callback → deep-link token flow for AuthSession.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const token = await completeMobileStravaSignIn(parsed.data.code);
    return NextResponse.json({ accessToken: token });
  } catch (error) {
    console.error("Mobile Strava exchange failed", error);
    return NextResponse.json({ error: "exchange_failed" }, { status: 502 });
  }
}
