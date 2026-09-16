import type { Metadata } from "next";

import { GlobeDashboard } from "@/components/dashboard/globe-dashboard";
import { getTracesBounds, toRunStartPoints, toRunTraces } from "@/lib/runs/run-geojson";
import { summarizeRuns } from "@/lib/runs/run-stats";
import { toRunSummary } from "@/server/runs/to-run-summary";
import { getServices } from "@/server/services";
import { requireCurrentUser } from "@/server/session";

import { reconnectStrava, signOutFromPlanetRun, syncRuns } from "./actions";

export const metadata: Metadata = {
  title: "Your planet · Planet Run",
};

export default async function GlobePage() {
  const user = await requireCurrentUser();
  const { activities, accounts } = getServices();
  const [activityRecords, stravaAccount] = await Promise.all([
    activities.listByUser(user.id),
    accounts.findByUserId(user.id),
  ]);

  const runs = activityRecords.map(toRunSummary);
  const traces = toRunTraces(runs);

  return (
    <GlobeDashboard
      user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
      traces={traces}
      startPoints={toRunStartPoints(traces)}
      bounds={getTracesBounds(traces)}
      stats={summarizeRuns(runs)}
      hasNeverSynced={!stravaAccount?.lastSyncedAt}
      syncAction={syncRuns}
      reconnectAction={reconnectStrava}
      signOutAction={signOutFromPlanetRun}
    />
  );
}
