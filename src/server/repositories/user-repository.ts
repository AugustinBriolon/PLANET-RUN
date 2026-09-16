import { eq } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { users, type User } from "@/server/db/schema";

export type UserRepository = {
  findById: (userId: string) => Promise<User | undefined>;
  updateProfile: (userId: string, profile: Pick<User, "displayName" | "avatarUrl">) => Promise<void>;
  delete: (userId: string) => Promise<void>;
};

export function createUserRepository(database: Database): UserRepository {
  return {
    async findById(userId) {
      return database.query.users.findFirst({ where: eq(users.id, userId) });
    },
    async updateProfile(userId, profile) {
      await database.update(users).set(profile).where(eq(users.id, userId));
    },
    async delete(userId) {
      await database.delete(users).where(eq(users.id, userId));
    },
  };
}
