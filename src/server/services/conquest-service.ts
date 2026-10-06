import { randomBytes } from "node:crypto";

import { isCityComplete, keeperSeason, pickCityTitles } from "@/lib/conquest/city-titles";
import { decideInvite, inviteExpiresAt } from "@/lib/conquest/invite";
import {
  canSeeRunner,
  DEFAULT_PROFILE_VISIBILITY,
  parseProfileVisibility,
  type ProfileVisibility,
} from "@/lib/conquest/visibility";
import { toCoverageShare, type CityCoverage } from "@/lib/coverage/street-coverage";
import type { ConquestRepository } from "@/server/repositories/conquest-repository";
import type { CoverageRepository } from "@/server/repositories/coverage-repository";
import type { UserCityRepository } from "@/server/repositories/user-city-repository";
import type { UserRepository } from "@/server/repositories/user-repository";

export class InviteNotFoundError extends Error {
  constructor() {
    super("Invite not found");
    this.name = "InviteNotFoundError";
  }
}
export class InviteExpiredError extends Error {
  constructor() {
    super("Invite expired");
    this.name = "InviteExpiredError";
  }
}
export class InviteOwnError extends Error {
  constructor() {
    super("Cannot accept your own invite");
    this.name = "InviteOwnError";
  }
}
export class CityNotOnProfileError extends Error {
  constructor() {
    super("This city is not on the runner's profile");
    this.name = "CityNotOnProfileError";
  }
}

export type NamedRunner = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
};

export type RivalOnBoard = NamedRunner & {
  share: number | null;
  coveredMeters: number;
  totalMeters: number;
  completedAt: string | null;
  completionDistanceMeters: number | null;
  keeperMeters: number;
};

export type CityBoard = {
  areaId: number;
  name: string;
  seasonId: string;
  you: RivalOnBoard & { isFounder: boolean; isKeeper: boolean };
  rivals: RivalOnBoard[];
  hall: {
    founder: NamedRunner | null;
    keeper: NamedRunner | null;
    conquerors: Array<NamedRunner & { completionDistanceMeters: number; rank: number }>;
  };
};

export type InvitePreview = {
  areaId: number;
  cityName: string;
  inviterName: string;
  inviterShare: number | null;
  founderOpen: boolean;
  conquerorOpen: boolean;
  keeperOpen: boolean;
};

export type ConquestService = {
  refreshForUser: (userId: string) => Promise<void>;
  setVisibility: (userId: string, visibility: ProfileVisibility) => Promise<void>;
  createInvite: (userId: string, areaId: number) => Promise<{ token: string; expiresAt: Date }>;
  acceptInvite: (userId: string, token: string) => Promise<{ areaId: number }>;
  previewInvite: (token: string) => Promise<InvitePreview | null>;
  getCityBoard: (viewerId: string, areaId: number) => Promise<CityBoard | null>;
};

type Dependencies = {
  users: UserRepository;
  userCities: UserCityRepository;
  coverage: CoverageRepository;
  conquests: ConquestRepository;
  now?: () => Date;
  randomToken?: () => string;
};

export function createConquestService({
  users,
  userCities,
  coverage,
  conquests,
  now = () => new Date(),
  randomToken = () => randomBytes(16).toString("hex"),
}: Dependencies): ConquestService {
  return {
    async refreshForUser(userId) {
      const cities = await coverage.listCityCoverage(userId);
      const at = now();
      for (const city of cities) {
        if (!isCityComplete(toCoverageShare(city))) continue;
        const distance = await coverage.sumActivityDistanceInArea(userId, city.areaId);
        await conquests.insertConquestIfAbsent({
          userId,
          areaId: city.areaId,
          completedAt: at,
          completionDistanceMeters: distance,
        });
      }
    },

    async setVisibility(userId, visibility) {
      await users.updateVisibility(userId, visibility);
    },

    async createInvite(userId, areaId) {
      const cities = await userCities.listByUser(userId);
      if (!cities.some((city) => city.osmRelationId === areaId)) throw new CityNotOnProfileError();
      const existing = await conquests.findReusableInvite(userId, areaId, now());
      if (existing) return { token: existing.token, expiresAt: existing.expiresAt };
      const token = randomToken();
      const expiresAt = inviteExpiresAt(now());
      await conquests.insertInvite({ token, inviterId: userId, areaId, expiresAt });
      return { token, expiresAt };
    },

    async acceptInvite(userId, token) {
      const decision = decideInvite(await conquests.findInvite(token), userId, now());
      if (decision.status === "not-found") throw new InviteNotFoundError();
      if (decision.status === "expired") throw new InviteExpiredError();
      if (decision.status === "own-invite") return { areaId: decision.areaId };
      await conquests.insertRivalry(decision.areaId, decision.inviterId, userId);
      if (!decision.alreadyRivals) await conquests.markInviteAccepted(token, userId);
      const inviterCities = await userCities.listByUser(decision.inviterId);
      const city = inviterCities.find((entry) => entry.osmRelationId === decision.areaId);
      if (city) await userCities.upsertMany(userId, [city]);
      return { areaId: decision.areaId };
    },

    async previewInvite(token) {
      const invite = await conquests.findInvite(token);
      if (!invite || invite.expiresAt.getTime() <= now().getTime()) return null;
      const inviter = await users.findById(invite.inviterId);
      const season = keeperSeason(now());
      const [cities, coverageCities, conquestRows, seasonRows] = await Promise.all([
        inviter ? userCities.listByUser(inviter.id) : Promise.resolve([]),
        inviter ? coverage.listCityCoverage(inviter.id) : Promise.resolve([]),
        conquests.listConquestsForArea(invite.areaId),
        coverage.listSeasonCoveredMeters(invite.areaId, season.start, season.end),
      ]);
      const city = cities.find((entry) => entry.osmRelationId === invite.areaId);
      const coverageCity = coverageCities.find((entry) => entry.areaId === invite.areaId);
      const titles = pickCityTitles(
        conquestRows.map((row) => ({
          userId: row.userId,
          completedAt: row.completedAt,
          completionDistanceMeters: row.completionDistanceMeters,
        })),
        new Map(seasonRows.map((row) => [row.userId, row.meters])),
      );
      return {
        areaId: invite.areaId,
        cityName: city?.name ?? "this city",
        inviterName: inviter?.displayName ?? "A runner",
        inviterShare: coverageCity ? toCoverageShare(coverageCity) : null,
        founderOpen: titles.founderUserId == null,
        conquerorOpen: titles.conquerorUserIds.length === 0,
        keeperOpen: titles.keeperUserId == null,
      };
    },

    async getCityBoard(viewerId, areaId) {
      const viewer = await users.findById(viewerId);
      if (!viewer) return null;
      const cities = await coverage.listCityCoverage(viewerId);
      const city = cities.find((entry) => entry.areaId === areaId);
      if (!city) return null;

      const season = keeperSeason(now());
      const [rivalIds, conquestRows, seasonRows] = await Promise.all([
        conquests.listRivalIds(viewerId, areaId),
        conquests.listConquestsForArea(areaId),
        coverage.listSeasonCoveredMeters(areaId, season.start, season.end),
      ]);
      const seasonMeters = new Map(seasonRows.map((row) => [row.userId, row.meters]));
      const titles = pickCityTitles(
        conquestRows.map((row) => ({
          userId: row.userId,
          completedAt: row.completedAt,
          completionDistanceMeters: row.completionDistanceMeters,
        })),
        seasonMeters,
      );

      const relatedIds = [...new Set([viewerId, ...rivalIds, ...conquestRows.map((row) => row.userId)])];
      const profiles = new Map((await users.findByIds(relatedIds)).map((user) => [user.id, user]));
      const rivalSet = new Set(rivalIds);
      const conquestByUser = new Map(conquestRows.map((row) => [row.userId, row]));

      const coverages = new Map<string, CityCoverage>([[viewerId, city]]);
      await Promise.all(
        rivalIds.map(async (rivalId) => {
          const rivalCities = await coverage.listCityCoverage(rivalId);
          const rivalCity = rivalCities.find((entry) => entry.areaId === areaId);
          if (rivalCity) coverages.set(rivalId, rivalCity);
        }),
      );

      const toNamed = (userId: string, asTitle = false): NamedRunner | null => {
        const profile = profiles.get(userId);
        const visibility = parseProfileVisibility(profile?.profileVisibility) ?? DEFAULT_PROFILE_VISIBILITY;
        if (canSeeRunner({ viewerId, targetId: userId, rivalIds: rivalSet, visibility })) {
          return { userId, displayName: profile?.displayName ?? "Runner", avatarUrl: profile?.avatarUrl ?? null };
        }
        return asTitle ? { userId, displayName: "Hidden runner", avatarUrl: null } : null;
      };

      const toRival = (userId: string, coverageRow: CityCoverage | undefined): RivalOnBoard => {
        const named = toNamed(userId) ?? { userId, displayName: "Runner", avatarUrl: null };
        const conquest = conquestByUser.get(userId);
        return {
          ...named,
          share: coverageRow ? toCoverageShare(coverageRow) : null,
          coveredMeters: coverageRow?.coveredMeters ?? 0,
          totalMeters: coverageRow?.totalMeters ?? 0,
          completedAt: conquest?.completedAt.toISOString() ?? null,
          completionDistanceMeters: conquest?.completionDistanceMeters ?? null,
          keeperMeters: seasonMeters.get(userId) ?? 0,
        };
      };

      const hallConquerors = titles.conquerorUserIds.flatMap((userId, index) => {
        const named = toNamed(userId);
        const conquest = conquestByUser.get(userId);
        if (!named || !conquest) return [];
        return [{ ...named, completionDistanceMeters: conquest.completionDistanceMeters, rank: index + 1 }];
      });

      return {
        areaId,
        name: city.name,
        seasonId: season.id,
        you: {
          ...toRival(viewerId, city),
          isFounder: titles.founderUserId === viewerId,
          isKeeper: titles.keeperUserId === viewerId,
        },
        rivals: rivalIds.map((rivalId) => toRival(rivalId, coverages.get(rivalId))),
        hall: {
          founder: titles.founderUserId ? toNamed(titles.founderUserId, true) : null,
          keeper: titles.keeperUserId ? toNamed(titles.keeperUserId, true) : null,
          conquerors: hallConquerors.slice(0, 5),
        },
      };
    },
  };
}
