"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { CoveredStreetsLayer } from "@/components/globe/covered-streets-layer";
import { FlyToBounds } from "@/components/globe/fly-to-bounds";
import { GlobeAutoRotate } from "@/components/globe/globe-auto-rotate";
import { RunGlobe } from "@/components/globe/run-globe";
import { RunTracesLayer } from "@/components/globe/run-traces-layer";
import { PlanetRunLogo } from "@/components/brand/planet-run-logo";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRunSync } from "@/hooks/use-run-sync";
import { getCoveredStreetsBounds, type CityCoverage, type CoveredStreets } from "@/lib/coverage/street-coverage";
import { overlayRelativeToMap, paddingForOverlay, type BoxPadding } from "@/lib/map/fit-padding";
import type { LngLatBounds, RunFeatureProperties, RunStartPoints, RunTraces } from "@/lib/runs/run-geojson";
import type { RunStats } from "@/lib/runs/run-stats";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";

import { EmptyRunsState } from "./empty-runs-state";
import { RunDetailPanel } from "./run-detail-panel";
import { RunStatsPanel } from "./run-stats-panel";
import { SyncButton } from "./sync-button";

type Framing = { padding: number | BoxPadding; maxZoom: number };

const ENTRANCE_FRAMING: Framing = { padding: 96, maxZoom: 12 };
const CITY_MAX_ZOOM = 15;
const PENDING_CITY_POLL_MS = 5_000;
// Keep in sync with Tailwind's `sm` breakpoint used for the mobile panel-swap layout.
const DESKTOP_QUERY = "(min-width: 640px)";

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
  const router = useRouter();
  const { status, failure, sync } = useRunSync({ syncAction, syncOnMount: hasNeverSynced });
  const shellRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [focusBounds, setFocusBounds] = useState(bounds);
  const [framing, setFraming] = useState<Framing>(ENTRANCE_FRAMING);
  const [selectedRun, setSelectedRun] = useState<RunFeatureProperties | null>(null);
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const hasRuns = stats.runCount > 0;
  const hasPendingCities = cityCoverage.some((city) => city.status === "pending");
  // On mobile the detail panel takes the stats panel's own slot, so it swaps out instead of stacking;
  // on desktop the two sit side by side and the stats panel never needs to hide.
  const showStats = isDesktop || !selectedRun;

  useEffect(() => {
    if (!hasPendingCities) return;
    const timer = window.setInterval(() => router.refresh(), PENDING_CITY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasPendingCities, router]);

  useEffect(() => {
    if (!selectedRun) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedRun(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedRun]);

  function selectCity(areaId: number) {
    const city = cityCoverage.find((entry) => entry.areaId === areaId);
    if (!city || city.status === "pending" || !city.bounds) return;
    setFocusBounds(getCoveredStreetsBounds(coveredStreets, areaId) ?? city.bounds);
    setFraming(cityFraming(shellRef.current, panelRef.current));
  }

  return (
    <main ref={shellRef} className="starfield relative h-dvh overflow-hidden">
      <RunGlobe className="absolute inset-0">
        <RunTracesLayer
          traces={traces}
          startPoints={startPoints}
          onSelectRun={setSelectedRun}
          onDeselect={() => setSelectedRun(null)}
        />
        <CoveredStreetsLayer streets={coveredStreets} />
        {hasRuns ? (
          <FlyToBounds bounds={focusBounds} padding={framing.padding} maxZoom={framing.maxZoom} />
        ) : (
          <GlobeAutoRotate />
        )}
      </RunGlobe>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 sm:px-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-6">
        <PlanetRunLogo className="pointer-events-auto text-base" />
        <div className="pointer-events-auto">
          <SyncButton isSyncing={status === "syncing"} onSync={sync} />
        </div>
      </header>

      {hasRuns ? (
        <>
          <div className="pointer-events-none absolute inset-x-4 bottom-4 sm:right-auto sm:left-6 sm:max-w-[50vw]">
            <AnimatePresence>
              {showStats && (
                <motion.div
                  ref={panelRef}
                  initial={{ opacity: 0, y: "100%" }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: "100%" }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="pointer-events-auto"
                >
                  <RunStatsPanel
                    stats={stats}
                    cityCoverage={cityCoverage}
                    onSelectCity={selectCity}
                    signOutAction={signOutAction}
                    deleteDataAction={deleteDataAction}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <RunDetailPanel run={selectedRun} onClose={() => setSelectedRun(null)} />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center">
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
