import "server-only";

import { getServerEnv } from "@/server/env";
import { signMobileSessionToken } from "@/server/mobile/session-token";
import { getServices } from "@/server/services";
import { toAthleteIdentity } from "@/server/strava/strava-profile";

/** Exchanges a Strava authorization code, links the athlete, returns a mobile JWT. */
export async function completeMobileStravaSignIn(code: string): Promise<string> {
  const env = getServerEnv();
  const services = getServices();
  const tokenResponse = await services.strava.exchangeAuthorizationCode(code);
  const identity = toAthleteIdentity(tokenResponse.athlete);
  const userId = await services.accountLinking.linkStravaAthlete({
    ...identity,
    tokens: {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAtEpochSeconds: tokenResponse.expires_at,
    },
  });
  return signMobileSessionToken(userId, env.AUTH_SECRET);
}
