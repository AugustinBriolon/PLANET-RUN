import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import type { UserRepository } from "@/server/repositories/user-repository";

import type { PlainStravaTokens, StravaTokenService } from "./strava-token-service";

export type StravaSignIn = {
  athleteId: number;
  displayName: string;
  avatarUrl: string | null;
  tokens: PlainStravaTokens;
};

export type AccountLinkingService = {
  /** Returns the internal user id bound to the Strava athlete, creating it on first sign-in. */
  linkStravaAthlete: (signIn: StravaSignIn) => Promise<string>;
};

type Dependencies = {
  users: UserRepository;
  accounts: StravaAccountRepository;
  tokens: StravaTokenService;
};

export function createAccountLinkingService({ users, accounts, tokens }: Dependencies): AccountLinkingService {
  return {
    async linkStravaAthlete({ athleteId, displayName, avatarUrl, tokens: plainTokens }) {
      const encryptedTokens = tokens.encrypt(plainTokens);
      const profile = { displayName, avatarUrl };
      const existingAccount = await accounts.findByAthleteId(athleteId);

      if (existingAccount) {
        await accounts.updateTokens(athleteId, encryptedTokens);
        await users.updateProfile(existingAccount.userId, profile);
        return existingAccount.userId;
      }

      const user = await accounts.createWithUser(profile, { athleteId, ...encryptedTokens });
      return user.id;
    },
  };
}
