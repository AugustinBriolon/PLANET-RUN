import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import type { UserRepository } from "@/server/repositories/user-repository";
import type { StravaClient } from "@/server/strava/strava-client";

import type { StravaTokenService } from "./strava-token-service";

export type AccountDeletionService = {
  /** Revokes Strava access, then permanently deletes the user and every run (database cascade). */
  deleteAccount: (userId: string) => Promise<void>;
};

type Dependencies = {
  users: UserRepository;
  accounts: StravaAccountRepository;
  strava: StravaClient;
  tokens: StravaTokenService;
  reportError: (message: string, error: unknown) => void;
};

export function createAccountDeletionService({
  users,
  accounts,
  strava,
  tokens,
  reportError,
}: Dependencies): AccountDeletionService {
  async function revokeStravaAccess(userId: string) {
    const account = await accounts.findByUserId(userId);
    if (!account) return;
    try {
      await strava.deauthorize(await tokens.getValidAccessToken(account));
    } catch (error) {
      // Deletion must never be blocked by Strava: the athlete can still revoke access from Strava settings.
      reportError("Strava deauthorization failed during account deletion", error);
    }
  }

  return {
    async deleteAccount(userId) {
      await revokeStravaAccess(userId);
      await users.delete(userId);
    },
  };
}
