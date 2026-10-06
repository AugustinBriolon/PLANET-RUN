import { SignJWT, jwtVerify } from "jose";

const MOBILE_TOKEN_TYP = "cityfil-mobile";
const MOBILE_TOKEN_TTL = "30d";

export type MobileSessionClaims = {
  /** Internal Cityfil user id. */
  sub: string;
};

function secretKey(authSecret: string): Uint8Array {
  return new TextEncoder().encode(authSecret);
}

export async function signMobileSessionToken(userId: string, authSecret: string): Promise<string> {
  return new SignJWT({ typ: MOBILE_TOKEN_TYP })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_TTL)
    .sign(secretKey(authSecret));
}

export async function verifyMobileSessionToken(token: string, authSecret: string): Promise<MobileSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(authSecret), { algorithms: ["HS256"] });
    if (payload.typ !== MOBILE_TOKEN_TYP || typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

/** Short-lived CSRF state for the Strava → mobile OAuth round-trip. */
export async function signMobileOAuthState(authSecret: string, nonce: string): Promise<string> {
  return new SignJWT({ typ: "cityfil-mobile-oauth", nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secretKey(authSecret));
}

export async function verifyMobileOAuthState(state: string, authSecret: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(state, secretKey(authSecret), { algorithms: ["HS256"] });
    return payload.typ === "cityfil-mobile-oauth" && typeof payload.nonce === "string";
  } catch {
    return false;
  }
}
