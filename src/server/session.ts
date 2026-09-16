import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { auth } from "@/auth";
import type { User } from "@/server/db/schema";
import { getServices } from "@/server/services";

/**
 * Resolves the signed-in user from the session cookie AND the database, so a user
 * deleted after a Strava deauthorization is treated as signed out.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return (await getServices().users.findById(userId)) ?? null;
});

export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
