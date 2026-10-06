import { and, eq, gt, sql } from "drizzle-orm";

import { orderedUserPair } from "@/lib/conquest/visibility";
import type { Database } from "@/server/db/client";
import { cityConquests, cityInvites, cityRivalries, type CityConquest, type CityInvite } from "@/server/db/schema";

export type ConquestRepository = {
  insertConquestIfAbsent: (row: {
    userId: string;
    areaId: number;
    completedAt: Date;
    completionDistanceMeters: number;
  }) => Promise<void>;
  listConquestsForArea: (areaId: number) => Promise<CityConquest[]>;
  findInvite: (token: string) => Promise<CityInvite | undefined>;
  findReusableInvite: (inviterId: string, areaId: number, now: Date) => Promise<CityInvite | undefined>;
  insertInvite: (row: { token: string; inviterId: string; areaId: number; expiresAt: Date }) => Promise<void>;
  markInviteAccepted: (token: string, acceptedBy: string) => Promise<void>;
  insertRivalry: (areaId: number, userA: string, userB: string) => Promise<void>;
  listRivalIds: (userId: string, areaId: number) => Promise<string[]>;
};

export function createConquestRepository(database: Database): ConquestRepository {
  return {
    async insertConquestIfAbsent(row) {
      await database
        .insert(cityConquests)
        .values(row)
        .onConflictDoNothing({ target: [cityConquests.userId, cityConquests.areaId] });
    },
    async listConquestsForArea(areaId) {
      return database.query.cityConquests.findMany({ where: eq(cityConquests.areaId, areaId) });
    },
    async findInvite(token) {
      return database.query.cityInvites.findFirst({ where: eq(cityInvites.token, token) });
    },
    async findReusableInvite(inviterId, areaId, now) {
      return database.query.cityInvites.findFirst({
        where: and(
          eq(cityInvites.inviterId, inviterId),
          eq(cityInvites.areaId, areaId),
          gt(cityInvites.expiresAt, now),
        ),
      });
    },
    async insertInvite(row) {
      await database.insert(cityInvites).values(row);
    },
    async markInviteAccepted(token, acceptedBy) {
      await database.update(cityInvites).set({ acceptedBy }).where(eq(cityInvites.token, token));
    },
    async insertRivalry(areaId, userA, userB) {
      const pair = orderedUserPair(userA, userB);
      await database
        .insert(cityRivalries)
        .values({ areaId, ...pair })
        .onConflictDoNothing();
    },
    async listRivalIds(userId, areaId) {
      const rows = await database.execute<{ other_id: string }>(sql`
        SELECT CASE WHEN user_low = ${userId} THEN user_high ELSE user_low END AS other_id
        FROM city_rivalries
        WHERE area_id = ${areaId} AND (user_low = ${userId} OR user_high = ${userId})
      `);
      return rows.map((row) => row.other_id);
    },
  };
}
