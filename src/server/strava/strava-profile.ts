import { z } from "zod";

const stravaAthleteSchema = z.object({
  id: z.coerce.number().int().positive(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  profile: z.string().nullish(),
});

export type AthleteIdentity = {
  athleteId: number;
  displayName: string;
  avatarUrl: string | null;
};

function describeKeys(candidate: unknown): string {
  return candidate && typeof candidate === "object" ? `{${Object.keys(candidate).join(", ")}}` : String(candidate);
}

/**
 * Returns the identity from the first candidate that is a valid Strava athlete.
 * Pass the most trustworthy source first: the athlete embedded in the token exchange response.
 */
export function toAthleteIdentity(...candidates: unknown[]): AthleteIdentity {
  for (const candidate of candidates) {
    const parsed = stravaAthleteSchema.safeParse(candidate);
    if (!parsed.success) continue;

    const athlete = parsed.data;
    const displayName = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ").trim();
    return {
      athleteId: athlete.id,
      displayName: displayName || "Runner",
      // Athletes without a photo get a relative placeholder path instead of a URL.
      avatarUrl: athlete.profile?.startsWith("https://") ? athlete.profile : null,
    };
  }

  // Only keys are logged: values may contain personal data.
  throw new Error(
    `No Strava athlete found in sign-in response (received ${candidates.map(describeKeys).join(" and ")})`,
  );
}
