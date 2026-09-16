import { eq } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { stravaAccounts, users, type StravaAccount, type User } from "@/server/db/schema";

export type StravaTokens = Pick<StravaAccount, "accessTokenEncrypted" | "refreshTokenEncrypted" | "tokenExpiresAt">;

export type StravaAccountRepository = {
  findByAthleteId: (athleteId: number) => Promise<StravaAccount | undefined>;
  findByUserId: (userId: string) => Promise<StravaAccount | undefined>;
  createWithUser: (
    profile: Pick<User, "displayName" | "avatarUrl">,
    account: Pick<StravaAccount, "athleteId"> & StravaTokens,
  ) => Promise<User>;
  updateTokens: (athleteId: number, tokens: StravaTokens) => Promise<void>;
  markSynced: (athleteId: number, syncedAt: Date) => Promise<void>;
};

export function createStravaAccountRepository(database: Database): StravaAccountRepository {
  return {
    async findByAthleteId(athleteId) {
      return database.query.stravaAccounts.findFirst({ where: eq(stravaAccounts.athleteId, athleteId) });
    },
    async findByUserId(userId) {
      return database.query.stravaAccounts.findFirst({ where: eq(stravaAccounts.userId, userId) });
    },
    async createWithUser(profile, account) {
      return database.transaction(async (transaction) => {
        const [user] = await transaction.insert(users).values(profile).returning();
        await transaction.insert(stravaAccounts).values({ ...account, userId: user!.id });
        return user!;
      });
    },
    async updateTokens(athleteId, tokens) {
      await database.update(stravaAccounts).set(tokens).where(eq(stravaAccounts.athleteId, athleteId));
    },
    async markSynced(athleteId, syncedAt) {
      await database
        .update(stravaAccounts)
        .set({ lastSyncedAt: syncedAt })
        .where(eq(stravaAccounts.athleteId, athleteId));
    },
  };
}
