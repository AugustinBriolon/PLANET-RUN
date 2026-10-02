import { NextResponse } from "next/server";

import { MOBILE_APP_OAUTH_REDIRECT } from "@/server/mobile/request-auth";
import { getServerEnv } from "@/server/env";
import { verifyMobileOAuthState } from "@/server/mobile/session-token";
import { completeMobileStravaSignIn } from "@/server/mobile/strava-sign-in";

/**
 * Strava redirects here after consent. We exchange the code, mint a mobile JWT,
 * then bounce into the app via `planetrun://oauth?token=…` for AuthSession to capture.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`${MOBILE_APP_OAUTH_REDIRECT}?error=${encodeURIComponent(oauthError)}`);
  }

  if (!state || !(await verifyMobileOAuthState(state, getServerEnv().AUTH_SECRET))) {
    return NextResponse.redirect(`${MOBILE_APP_OAUTH_REDIRECT}?error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${MOBILE_APP_OAUTH_REDIRECT}?error=missing_code`);
  }

  try {
    const accessToken = await completeMobileStravaSignIn(code);
    return NextResponse.redirect(`${MOBILE_APP_OAUTH_REDIRECT}?token=${encodeURIComponent(accessToken)}`);
  } catch (error) {
    console.error("Mobile Strava callback failed", error);
    return NextResponse.redirect(`${MOBILE_APP_OAUTH_REDIRECT}?error=exchange_failed`);
  }
}
