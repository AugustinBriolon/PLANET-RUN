import type { Metadata } from "next";

import { SettingsPage } from "@/components/settings/settings-page";
import { DEFAULT_PROFILE_VISIBILITY, parseProfileVisibility } from "@/lib/conquest/visibility";
import { requireCurrentUser } from "@/server/session";

import { deleteMyData, signOutFromCityfil, syncRuns } from "../globe/actions";
import { setProfileVisibility } from "./actions";

export const metadata: Metadata = {
  title: "Settings · Cityfil",
  description: "Profile visibility, Strava sync, and account controls.",
};

export default async function SettingsRoute() {
  const user = await requireCurrentUser();
  const visibility = parseProfileVisibility(user.profileVisibility) ?? DEFAULT_PROFILE_VISIBILITY;

  return (
    <SettingsPage
      displayName={user.displayName}
      avatarUrl={user.avatarUrl}
      visibility={visibility}
      setVisibilityAction={setProfileVisibility}
      syncAction={syncRuns}
      signOutAction={signOutFromCityfil}
      deleteDataAction={deleteMyData}
    />
  );
}
