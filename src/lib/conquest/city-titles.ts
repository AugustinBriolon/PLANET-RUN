/** A city is complete when essentially every street is covered (float slack on the last centimetres). */
export const COMPLETE_SHARE = 0.999;

export function isCityComplete(share: number | null | undefined): boolean {
  return share != null && share >= COMPLETE_SHARE;
}

export type ConquestRecord = {
  userId: string;
  completedAt: Date;
  completionDistanceMeters: number;
};

export type SeasonWindow = {
  start: Date;
  end: Date;
  /** Calendar month in UTC, e.g. "2026-10". */
  id: string;
};

/** Keeper crown resets on the first of each UTC month. */
export function keeperSeason(now: Date): SeasonWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return { start, end, id: `${now.getUTCFullYear()}-${month}` };
}

export type CityTitles = {
  founderUserId: string | null;
  keeperUserId: string | null;
  /** Fewest GPS kilometres to reach 100%, then earliest completion. */
  conquerorUserIds: string[];
};

/**
 * Titles for one city. Completing first is Founder (permanent). Later 100%s still
 * compete on efficiency (Conqueror) and on streets re-run this month (Keeper).
 */
export function pickCityTitles(
  conquests: readonly ConquestRecord[],
  seasonMetersByUser: ReadonlyMap<string, number>,
): CityTitles {
  if (conquests.length === 0) {
    return { founderUserId: null, keeperUserId: null, conquerorUserIds: [] };
  }

  const founder = [...conquests].sort(byFounder)[0]!;
  const conquerorUserIds = [...conquests].sort(byConqueror).map((row) => row.userId);

  let keeperUserId: string | null = null;
  let bestMeters = 0;
  for (const { userId } of conquests) {
    const meters = seasonMetersByUser.get(userId) ?? 0;
    if (meters > bestMeters) {
      bestMeters = meters;
      keeperUserId = userId;
    }
  }

  return { founderUserId: founder.userId, keeperUserId, conquerorUserIds };
}

function byFounder(a: ConquestRecord, b: ConquestRecord): number {
  return a.completedAt.getTime() - b.completedAt.getTime() || a.userId.localeCompare(b.userId);
}

function byConqueror(a: ConquestRecord, b: ConquestRecord): number {
  return (
    a.completionDistanceMeters - b.completionDistanceMeters ||
    a.completedAt.getTime() - b.completedAt.getTime() ||
    a.userId.localeCompare(b.userId)
  );
}
