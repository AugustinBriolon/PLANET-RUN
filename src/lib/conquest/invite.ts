export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type InviteRecord = {
  token: string;
  inviterId: string;
  areaId: number;
  expiresAt: Date;
  acceptedBy: string | null;
};

export type InviteDecision =
  | { status: "accepted"; areaId: number; inviterId: string; alreadyRivals: boolean }
  | { status: "not-found" }
  | { status: "expired" }
  | { status: "own-invite"; areaId: number };

/** Outcome of someone opening an invite link. Does not mutate; the service persists the decision. */
export function decideInvite(invite: InviteRecord | undefined, acceptorId: string, now: Date): InviteDecision {
  if (!invite) return { status: "not-found" };
  if (invite.inviterId === acceptorId) return { status: "own-invite", areaId: invite.areaId };
  if (invite.expiresAt.getTime() <= now.getTime()) return { status: "expired" };
  const alreadyRivals = invite.acceptedBy === acceptorId;
  return { status: "accepted", areaId: invite.areaId, inviterId: invite.inviterId, alreadyRivals };
}

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_MS);
}

/** Tokens are 16 random bytes, hex-encoded. Anything else never hits the database. */
export function isInviteToken(token: string): boolean {
  return /^[a-f0-9]{32}$/.test(token);
}
