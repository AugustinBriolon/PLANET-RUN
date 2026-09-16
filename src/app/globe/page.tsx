import type { Metadata } from "next";

import { GlobeDashboard } from "@/components/dashboard/globe-dashboard";
import { getTracesBounds, toRunStartPoints, toRunTraces } from "@/lib/runs/run-geojson";
import { countCountries, summarizeRuns } from "@/lib/runs/run-stats";
import { locateCountry } from "@/server/runs/locate-country";
import { toRunSummary } from "@/server/runs/to-run-summary";
import { getServices } from "@/server/services";
import { requireCurrentUser } from "@/server/session";

import { deleteMyData, reconnectStrava, signOutFromPlanetRun, syncRuns } from "./actions";

export const metadata: Metadata = {
  title: "Your planet · Planet Run",
};

export default async function GlobePage() {
  const user = await requireCurrentUser();
  const { activities, accounts, coverage } = getServices();
  const [activityRecords, stravaAccount, cityCoverage, coveredStreets] = await Promise.all([
    activities.listByUser(user.id),
    accounts.findByUserId(user.id),
    coverage.listCityCoverage(user.id),
    coverage.getCoveredStreets(user.id),
  ]);

  const runs = activityRecords.map(toRunSummary);
  const traces = toRunTraces(runs);
  const startPoints = toRunStartPoints(traces);

  return (
    <GlobeDashboard
      user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }}
      traces={traces}
      startPoints={startPoints}
      bounds={getTracesBounds(traces)}
      stats={summarizeRuns(runs, countCountries(startPoints, locateCountry))}
      cityCoverage={cityCoverage}
      coveredStreets={coveredStreets}
      hasNeverSynced={!stravaAccount?.lastSyncedAt}
      syncAction={syncRuns}
      reconnectAction={reconnectStrava}
      signOutAction={signOutFromPlanetRun}
      deleteDataAction={deleteMyData}
    />
  );
}
