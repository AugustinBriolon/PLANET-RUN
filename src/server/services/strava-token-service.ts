import type { TokenCipher } from "@/server/crypto/token-cipher";
import type { StravaAccount } from "@/server/db/schema";
import type { StravaAccountRepository, StravaTokens } from "@/server/repositories/strava-account-repository";
import { StravaApiError, type StravaClient } from "@/server/strava/strava-client";

// Refresh slightly before expiry so a token never dies mid-sync.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

export type PlainStravaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAtEpochSeconds: number;
};

export type StravaTokenService = {
  encrypt: (tokens: PlainStravaTokens) => StravaTokens;
  getValidAccessToken: (account: StravaAccount) => Promise<string>;
  isAuthorizationRevoked: (account: StravaAccount) => Promise<boolean>;
};

type Dependencies = {
  accounts: StravaAccountRepository;
  strava: StravaClient;
  cipher: TokenCipher;
  now: () => Date;
};

export function createStravaTokenService({ accounts, strava, cipher, now }: Dependencies): StravaTokenService {
  function encrypt({ accessToken, refreshToken, expiresAtEpochSeconds }: PlainStravaTokens): StravaTokens {
    return {
      accessTokenEncrypted: cipher.encrypt(accessToken),
      refreshTokenEncrypted: cipher.encrypt(refreshToken),
      tokenExpiresAt: new Date(expiresAtEpochSeconds * 1000),
    };
  }

  async function refresh(account: StravaAccount): Promise<string> {
    const response = await strava.refreshAccessToken(cipher.decrypt(account.refreshTokenEncrypted));
    await accounts.updateTokens(
      account.athleteId,
      encrypt({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        expiresAtEpochSeconds: response.expires_at,
      }),
    );
    return response.access_token;
  }

  return {
    encrypt,

    async getValidAccessToken(account) {
      const isFresh = account.tokenExpiresAt.getTime() - now().getTime() > EXPIRY_MARGIN_MS;
      return isFresh ? cipher.decrypt(account.accessTokenEncrypted) : refresh(account);
    },

    // Webhooks are unsigned: confirm revocation with Strava before acting on it.
    async isAuthorizationRevoked(account) {
      try {
        await refresh(account);
        return false;
      } catch (error) {
        if (error instanceof StravaApiError && [400, 401, 403].includes(error.status)) return true;
        throw error;
      }
    },
  };
}
