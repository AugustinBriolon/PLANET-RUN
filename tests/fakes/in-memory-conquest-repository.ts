import { orderedUserPair } from "@/lib/conquest/visibility";
import type { CityConquest, CityInvite } from "@/server/db/schema";
import type { ConquestRepository } from "@/server/repositories/conquest-repository";

export function createInMemoryConquestRepository(): ConquestRepository & {
  conquests: CityConquest[];
  invites: CityInvite[];
} {
  const conquests: CityConquest[] = [];
  const invites: CityInvite[] = [];
  const rivalries: Array<{ areaId: number; userLow: string; userHigh: string }> = [];

  return {
    conquests,
    invites,
    async insertConquestIfAbsent(row) {
      if (conquests.some((entry) => entry.userId === row.userId && entry.areaId === row.areaId)) return;
      conquests.push(row);
    },
    async listConquestsForArea(areaId) {
      return conquests.filter((row) => row.areaId === areaId);
    },
    async findInvite(token) {
      return invites.find((row) => row.token === token);
    },
    async findReusableInvite(inviterId, areaId, now) {
      return invites.find(
        (row) => row.inviterId === inviterId && row.areaId === areaId && row.expiresAt.getTime() > now.getTime(),
      );
    },
    async insertInvite(row) {
      invites.push({ ...row, acceptedBy: null, createdAt: new Date() });
    },
    async markInviteAccepted(token, acceptedBy) {
      const invite = invites.find((row) => row.token === token);
      if (invite) invite.acceptedBy = acceptedBy;
    },
    async insertRivalry(areaId, userA, userB) {
      const pair = orderedUserPair(userA, userB);
      if (
        rivalries.some((row) => row.areaId === areaId && row.userLow === pair.userLow && row.userHigh === pair.userHigh)
      ) {
        return;
      }
      rivalries.push({ areaId, ...pair });
    },
    async listRivalIds(userId, areaId) {
      return rivalries
        .filter((row) => row.areaId === areaId && (row.userLow === userId || row.userHigh === userId))
        .map((row) => (row.userLow === userId ? row.userHigh : row.userLow));
    },
  };
}
