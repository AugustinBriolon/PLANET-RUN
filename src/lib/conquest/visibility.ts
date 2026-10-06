export type ProfileVisibility = "private" | "public";

export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = "private";

export function parseProfileVisibility(value: unknown): ProfileVisibility | null {
  return value === "public" || value === "private" ? value : null;
}

/**
 * City stats of someone else: the viewer, their rivals on that city, and public profiles.
 * A private Founder still holds the title; strangers just don't see the name.
 */
export function canSeeRunner(input: {
  viewerId: string;
  targetId: string;
  rivalIds: ReadonlySet<string>;
  visibility: ProfileVisibility;
}): boolean {
  if (input.viewerId === input.targetId) return true;
  if (input.rivalIds.has(input.targetId)) return true;
  return input.visibility === "public";
}

/** Stable pair so (A,B) and (B,A) are the same rivalry row. */
export function orderedUserPair(userA: string, userB: string): { userLow: string; userHigh: string } {
  return userA < userB ? { userLow: userA, userHigh: userB } : { userLow: userB, userHigh: userA };
}
