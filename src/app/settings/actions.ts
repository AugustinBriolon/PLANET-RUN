"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { parseProfileVisibility, type ProfileVisibility } from "@/lib/conquest/visibility";
import { getServices } from "@/server/services";
import { getCurrentUser } from "@/server/session";

import { deleteMyData, signOutFromCityfil, syncRuns } from "../globe/actions";

export { deleteMyData, signOutFromCityfil, syncRuns };

export type SetVisibilityResult = { status: "success"; visibility: ProfileVisibility } | { status: "error"; message: string };

export async function setProfileVisibility(visibility: ProfileVisibility): Promise<SetVisibilityResult> {
  const parsed = parseProfileVisibility(visibility);
  if (!parsed) return { status: "error", message: "Invalid visibility." };

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  await getServices().users.updateVisibility(user.id, parsed);
  refresh();
  return { status: "success", visibility: parsed };
}
