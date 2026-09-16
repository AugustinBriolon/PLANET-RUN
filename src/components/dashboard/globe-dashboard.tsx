"use client";

import { useRef, useState } from "react";

import { CoveredStreetsLayer } from "@/components/globe/covered-streets-layer";
import { FlyToBounds } from "@/components/globe/fly-to-bounds";
import { GlobeAutoRotate } from "@/components/globe/globe-auto-rotate";
import { RunGlobe } from "@/components/globe/run-globe";
import { RunTracesLayer } from "@/components/globe/run-traces-layer";
import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { useRunSync } from "@/hooks/use-run-sync";
import { getCoveredStreetsBounds, type CityCoverage, type CoveredStreets } from "@/lib/coverage/street-coverage";
import { overlayRelativeToMap, paddingForOverlay, type BoxPadding } from "@/lib/map/fit-padding";
import type { LngLatBounds, RunStartPoints, RunTraces } from "@/lib/runs/run-geojson";
import type { RunStats } from "@/lib/runs/run-stats";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";

import { EmptyRunsState } from "./empty-runs-state";
import { RunStatsPanel } from "./run-stats-panel";
import { SyncButton } from "./sync-button";

type Framing = { padding: number | BoxPadding; maxZoom: number };

const ENTRANCE_FRAMING: Framing = { padding: 96, maxZoom: 12 };
const CITY_MAX_ZOOM = 15;

export type GlobeDashboardProps = {
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

function cityFraming(mapEl: HTMLElement | null, panelEl: HTMLElement | null): Framing {
  if (!mapEl || !panelEl) return { padding: 64, maxZoom: CITY_MAX_ZOOM };
  const mapRect = mapEl.getBoundingClientRect();
  const panelRect = panelEl.getBoundingClientRect();
  return {
    padding: paddingForOverlay(
      { width: mapRect.width, height: mapRect.height },
      overlayRelativeToMap(mapRect, panelRect),
    ),
    maxZoom: CITY_MAX_ZOOM,
  };
}

export function GlobeDashboard({
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
  const shellRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [focusBounds, setFocusBounds] = useState(bounds);
  const [framing, setFraming] = useState<Framing>(ENTRANCE_FRAMING);
  const hasRuns = stats.runCount > 0;

  function selectCity(areaId: number) {
    const city = cityCoverage.find((entry) => entry.areaId === areaId);
    if (!city) return;
    setFocusBounds(getCoveredStreetsBounds(coveredStreets, areaId) ?? city.bounds);
    setFraming(cityFraming(shellRef.current, panelRef.current));
  }

  return (
    <main ref={shellRef} className="starfield relative h-dvh overflow-hidden">
      <RunGlobe className="absolute inset-0">
        <RunTracesLayer traces={traces} startPoints={startPoints} />
        <CoveredStreetsLayer streets={coveredStreets} />
        {hasRuns ? (
          <FlyToBounds bounds={focusBounds} padding={framing.padding} maxZoom={framing.maxZoom} />
        ) : (
          <GlobeAutoRotate />
        )}
      </RunGlobe>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 p-4 sm:p-6">
        <PlanetRunLogo className="pointer-events-auto text-base" />
        <div className="pointer-events-auto">
          <SyncButton isSyncing={status === "syncing"} onSync={sync} />
        </div>
      </header>

      {hasRuns ? (
        <div
          ref={panelRef}
          className="pointer-events-auto absolute inset-x-4 bottom-10 sm:right-auto sm:left-6"
        >
          <RunStatsPanel
            stats={stats}
            cityCoverage={cityCoverage}
            onSelectCity={selectCity}
            signOutAction={signOutAction}
            deleteDataAction={deleteDataAction}
          />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-4 bottom-10 flex justify-center">
          <EmptyRunsState
            status={status}
            failure={failure}
            onRetry={sync}
            reconnectAction={reconnectAction}
            signOutAction={signOutAction}
            deleteDataAction={deleteDataAction}
            className="pointer-events-auto"
          />
        </div>
      )}
    </main>
  );
}
