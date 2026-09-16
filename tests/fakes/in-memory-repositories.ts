import type { Activity, NewActivity, StravaAccount, User } from "@/server/db/schema";
import type { ActivityRepository } from "@/server/repositories/activity-repository";
import type { StravaAccountRepository } from "@/server/repositories/strava-account-repository";
import type { UserRepository } from "@/server/repositories/user-repository";

/** In-memory stand-ins mirroring the Postgres repositories, cascade deletes included. */
export function createInMemoryRepositories() {
  const userRows = new Map<string, User>();
  const accountRows = new Map<number, StravaAccount>();
  const activityRows = new Map<number, Activity>();
  let nextUserNumber = 1;

  const users: UserRepository = {
    async findById(userId) {
      return userRows.get(userId);
    },
    async updateProfile(userId, profile) {
      const user = userRows.get(userId);
      if (user) userRows.set(userId, { ...user, ...profile });
    },
    async delete(userId) {
      userRows.delete(userId);
      for (const [athleteId, account] of accountRows) if (account.userId === userId) accountRows.delete(athleteId);
      for (const [id, activity] of activityRows) if (activity.userId === userId) activityRows.delete(id);
    },
  };

  const accounts: StravaAccountRepository = {
    async findByAthleteId(athleteId) {
      return accountRows.get(athleteId);
    },
    async findByUserId(userId) {
      return [...accountRows.values()].find((account) => account.userId === userId);
    },
    async createWithUser(profile, account) {
      const now = new Date();
      const user: User = { id: `user-${nextUserNumber++}`, ...profile, createdAt: now, updatedAt: now };
      userRows.set(user.id, user);
      accountRows.set(account.athleteId, {
        ...account,
        userId: user.id,
        lastSyncedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      return user;
    },
    async updateTokens(athleteId, tokens) {
      const account = accountRows.get(athleteId);
      if (account) accountRows.set(athleteId, { ...account, ...tokens });
    },
    async markSynced(athleteId, syncedAt) {
      const account = accountRows.get(athleteId);
      if (account) accountRows.set(athleteId, { ...account, lastSyncedAt: syncedAt });
    },
  };

  const activities: ActivityRepository = {
    async listByUser(userId) {
      return [...activityRows.values()].filter((activity) => activity.userId === userId);
    },
    async upsertMany(records: NewActivity[]) {
      const now = new Date();
      for (const record of records) {
        const existing = activityRows.get(record.stravaActivityId);
        if (existing && existing.userId !== record.userId) continue;
        activityRows.set(record.stravaActivityId, {
          createdAt: now,
          updatedAt: now,
          ...existing,
          ...record,
        } as Activity);
      }
    },
    async deleteForUser(userId, stravaActivityId) {
      if (activityRows.get(stravaActivityId)?.userId === userId) activityRows.delete(stravaActivityId);
    },
  };

  return { users, accounts, activities, userRows, accountRows, activityRows };
}
