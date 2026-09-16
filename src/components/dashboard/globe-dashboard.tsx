"use client";

import { CoveredStreetsLayer } from "@/components/globe/covered-streets-layer";
import { FlyToBounds } from "@/components/globe/fly-to-bounds";
import { GlobeAutoRotate } from "@/components/globe/globe-auto-rotate";
import { RunGlobe } from "@/components/globe/run-globe";
import { RunTracesLayer } from "@/components/globe/run-traces-layer";
import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { useRunSync } from "@/hooks/use-run-sync";
import type { CityCoverage, CoveredStreets } from "@/lib/coverage/street-coverage";
import type { LngLatBounds, RunStartPoints, RunTraces } from "@/lib/runs/run-geojson";
import type { RunStats } from "@/lib/runs/run-stats";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";

import { EmptyRunsState } from "./empty-runs-state";
import { RunStatsPanel } from "./run-stats-panel";
import { SyncButton } from "./sync-button";
import { UserBadge } from "./user-badge";

export type GlobeDashboardProps = {
  user: { displayName: string; avatarUrl: string | null };
  traces: RunTraces;
  startPoints: RunStartPoints;
  bounds: LngLatBounds | null;
  stats: RunStats;
  cityCoverage: CityCoverage[];
  coveredStreets: CoveredStreets;
  hasNeverSynced: boolean;
  syncAction: () => Promise<RunSyncActionResult>;
  reconnectAction: () => Promise<void>;
  signOutAction: () => Promise<void>;
  deleteDataAction: () => Promise<void>;
};

export function GlobeDashboard({
  user,
  traces,
  startPoints,
  bounds,
  stats,
  cityCoverage,
  coveredStreets,
  hasNeverSynced,
  syncAction,
  reconnectAction,
  signOutAction,
  deleteDataAction,
}: GlobeDashboardProps) {
  const { status, failure, sync } = useRunSync({ syncAction, syncOnMount: hasNeverSynced });
  const hasRuns = stats.runCount > 0;

  return (
    <main className="starfield relative h-dvh overflow-hidden">
      <RunGlobe className="absolute inset-0">
        <RunTracesLayer traces={traces} startPoints={startPoints} />
        <CoveredStreetsLayer streets={coveredStreets} />
        {hasRuns ? <FlyToBounds bounds={bounds} /> : <GlobeAutoRotate />}
      </RunGlobe>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-4 sm:p-6">
        <PlanetRunLogo className="pointer-events-auto text-base" />
        <div className="pointer-events-auto flex items-center gap-2">
          <SyncButton isSyncing={status === "syncing"} onSync={sync} />
          <UserBadge displayName={user.displayName} avatarUrl={user.avatarUrl} signOutAction={signOutAction} />
        </div>
      </header>

      {hasRuns ? (
        <RunStatsPanel
          stats={stats}
          cityCoverage={cityCoverage}
          deleteDataAction={deleteDataAction}
          className="absolute inset-x-4 bottom-10 sm:right-auto sm:left-6"
        />
      ) : (
        <div className="pointer-events-none absolute inset-x-4 bottom-10 flex justify-center">
          <EmptyRunsState
            status={status}
            failure={failure}
            onRetry={sync}
            reconnectAction={reconnectAction}
            deleteDataAction={deleteDataAction}
            className="pointer-events-auto"
          />
        </div>
      )}
    </main>
  );
}
