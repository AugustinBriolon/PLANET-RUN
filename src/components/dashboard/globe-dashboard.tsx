"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { getUncoveredStreetsAction } from "@/app/globe/uncovered-streets-action";
import { CoveredStreetsLayer } from "@/components/globe/covered-streets-layer";
import { FlyToBounds } from "@/components/globe/fly-to-bounds";
import { GlobeAutoRotate } from "@/components/globe/globe-auto-rotate";
import { RunGlobe } from "@/components/globe/run-globe";
import { RunHeatmapLayer } from "@/components/globe/run-heatmap-layer";
import { RunTracesLayer } from "@/components/globe/run-traces-layer";
import { UncoveredStreetsLayer } from "@/components/globe/uncovered-streets-layer";
import { CityfilLogo } from "@/components/brand/cityfil-logo";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRunSync } from "@/hooks/use-run-sync";
import {
  CITY_FOCUS_MAP_LAYERS,
  DEFAULT_CITY_MAP_LAYERS,
  toggleCityMapLayer,
  type CityMapLayerFlags,
  type CityMapLayerKey,
} from "@/lib/coverage/city-map-layers";
import {
  getCoveredStreetsBounds,
  NO_COVERED_STREETS,
  type CityCoverage,
  type CoveredStreets,
} from "@/lib/coverage/street-coverage";
import { overlayRelativeToMap, paddingForOverlay, type BoxPadding } from "@/lib/map/fit-padding";
import { panelMotion } from "@/lib/motion/panel-motion";
import {
  clipTracesToBounds,
  toDensityTraces,
  toRunStartPoints,
  type LngLatBounds,
  type RunFeatureProperties,
  type RunStartPoints,
  type RunTraces,
} from "@/lib/runs/run-geojson";
import type { RunStats } from "@/lib/runs/run-stats";
import type { RunSyncActionResult } from "@/lib/runs/run-sync-result";

import { CityDetailPanel } from "./city-detail-panel";
import { CityLayerControls } from "./city-layer-controls";
import { EmptyRunsState } from "./empty-runs-state";
import { RunDetailPanel } from "./run-detail-panel";
import { RunStatsPanel } from "./run-stats-panel";

type Framing = { padding: number | BoxPadding; maxZoom: number };

const ENTRANCE_FRAMING: Framing = { padding: 96, maxZoom: 12 };
const CITY_MAX_ZOOM = 15;
const PENDING_CITY_POLL_MS = 5_000;
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

function filterCoveredByCity(streets: CoveredStreets, areaId: number): CoveredStreets {
  return {
    type: "FeatureCollection",
    features: streets.features.filter((feature) => feature.properties.areaId === areaId),
  };
}

function mergeUncovered(byCity: Record<number, CoveredStreets>): CoveredStreets {
  return {
    type: "FeatureCollection",
    features: Object.values(byCity).flatMap((streets) => streets.features),
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
}: GlobeDashboardProps) {
  const router = useRouter();
  const { status, failure, sync } = useRunSync({ syncAction, syncOnMount: hasNeverSynced });
  const shellRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [focusBounds, setFocusBounds] = useState(bounds);
  const [framing, setFraming] = useState<Framing>(ENTRANCE_FRAMING);
  const [selectedRun, setSelectedRun] = useState<RunFeatureProperties | null>(null);
  const [mapLayers, setMapLayers] = useState<CityMapLayerFlags>(DEFAULT_CITY_MAP_LAYERS);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [uncoveredByCity, setUncoveredByCity] = useState<Record<number, CoveredStreets>>({});
  const [, startUncoveredLoad] = useTransition();
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const hasRuns = stats.runCount > 0;
  const hasPendingCities = cityCoverage.some((city) => city.status === "pending" || city.status === "matching");
  const selectedCity = cityCoverage.find((city) => city.areaId === selectedCityId) ?? null;
  const cityOpen = selectedCity != null;

  // City focus: clip GPS to the city box so heatmap density is in-city only (no approach legs).
  const visibleTraces = useMemo(() => {
    if (!selectedCity?.bounds) return traces;
    return clipTracesToBounds(traces, selectedCity.bounds);
  }, [traces, selectedCity]);

  const visibleStartPoints = useMemo(() => {
    if (!cityOpen) return startPoints;
    return toRunStartPoints(visibleTraces);
  }, [cityOpen, startPoints, visibleTraces]);

  const densityTraces = useMemo(
    () => (mapLayers.heatmap ? toDensityTraces(visibleTraces) : null),
    [mapLayers.heatmap, visibleTraces],
  );

  const visibleCovered = useMemo(() => {
    if (!mapLayers.covered) return NO_COVERED_STREETS;
    if (selectedCityId == null) return coveredStreets;
    return filterCoveredByCity(coveredStreets, selectedCityId);
  }, [mapLayers.covered, coveredStreets, selectedCityId]);

  const visibleUncovered = useMemo(() => {
    if (!mapLayers.remaining) return NO_COVERED_STREETS;
    if (selectedCityId != null) return uncoveredByCity[selectedCityId] ?? NO_COVERED_STREETS;
    return mergeUncovered(uncoveredByCity);
  }, [mapLayers.remaining, selectedCityId, uncoveredByCity]);

  const showStats = isDesktop || (!selectedRun && !cityOpen);
  const panelMode = isDesktop ? "sheet" : "swap";

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

  useEffect(() => {
    if (!cityOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedCityId(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [cityOpen]);

  const loadUncovered = useCallback(
    (areaId: number) => {
      if (uncoveredByCity[areaId]) return;
      startUncoveredLoad(async () => {
        const streets = await getUncoveredStreetsAction(areaId);
        setUncoveredByCity((prev) => (prev[areaId] ? prev : { ...prev, [areaId]: streets }));
      });
    },
    [uncoveredByCity],
  );

  useEffect(() => {
    if (!mapLayers.remaining) return;
    if (selectedCityId != null) {
      loadUncovered(selectedCityId);
      return;
    }
    for (const city of cityCoverage) {
      if (city.status === "ready") loadUncovered(city.areaId);
    }
  }, [mapLayers.remaining, selectedCityId, cityCoverage, loadUncovered]);

  function selectCity(areaId: number) {
    const city = cityCoverage.find((entry) => entry.areaId === areaId);
    if (!city || city.status !== "ready" || !city.bounds) return;
    setSelectedRun(null);
    setSelectedCityId(areaId);
    // Covered = what you've done on the street graph; remaining = what's left. Hide GPS clutter.
    setMapLayers(CITY_FOCUS_MAP_LAYERS);
    setFocusBounds(getCoveredStreetsBounds(coveredStreets, areaId) ?? city.bounds);
    setFraming(cityFraming(shellRef.current, panelRef.current));
  }

  function closeCity() {
    setSelectedCityId(null);
    setFocusBounds(bounds);
    setFraming(ENTRANCE_FRAMING);
  }

  function toggleLayer(key: CityMapLayerKey) {
    setMapLayers((prev) => {
      const next = toggleCityMapLayer(prev, key);
      if (key === "heatmap" && next.heatmap) setSelectedRun(null);
      return next;
    });
  }

  return (
    <main ref={shellRef} className="starfield relative h-dvh overflow-hidden">
      <RunGlobe className="absolute inset-0">
        {mapLayers.heatmap && densityTraces ? (
          <RunHeatmapLayer traces={densityTraces} />
        ) : cityOpen ? null : (
          // Overview: GPS traces. City focus: Covered streets are the "done" layer instead.
          <RunTracesLayer
            traces={visibleTraces}
            startPoints={visibleStartPoints}
            onSelectRun={setSelectedRun}
            onDeselect={() => setSelectedRun(null)}
          />
        )}
        {mapLayers.covered ? <CoveredStreetsLayer streets={visibleCovered} /> : null}
        {mapLayers.remaining ? <UncoveredStreetsLayer streets={visibleUncovered} /> : null}
        {hasRuns ? (
          <FlyToBounds bounds={focusBounds} padding={framing.padding} maxZoom={framing.maxZoom} />
        ) : (
          <GlobeAutoRotate />
        )}
      </RunGlobe>

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4 sm:px-6 sm:pt-[max(1.5rem,env(safe-area-inset-top,0px))] sm:pb-6">
        <CityfilLogo className="pointer-events-auto text-base" />
        {hasRuns ? (
          <div className="pointer-events-auto">
            <CityLayerControls layers={mapLayers} onToggle={toggleLayer} />
          </div>
        ) : null}
      </header>

      {hasRuns ? (
        <>
          <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:inset-x-auto sm:right-auto sm:bottom-4 sm:left-6 sm:max-w-[50vw]">
            <AnimatePresence mode="wait">
              {cityOpen && selectedCity ? (
                <motion.div
                  key={`city-${selectedCity.areaId}`}
                  ref={panelRef}
                  {...panelMotion(panelMode)}
                  className="pointer-events-auto transform-gpu"
                >
                  <CityDetailPanel city={selectedCity} onClose={closeCity} />
                </motion.div>
              ) : showStats ? (
                <motion.div
                  key="stats"
                  ref={panelRef}
                  {...panelMotion(panelMode)}
                  className="pointer-events-auto transform-gpu"
                >
                  <RunStatsPanel
                    stats={stats}
                    cityCoverage={cityCoverage}
                    selectedCityId={selectedCityId}
                    onSelectCity={selectCity}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          <RunDetailPanel run={selectedRun} onClose={() => setSelectedRun(null)} motionMode={panelMode} />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] flex justify-center sm:inset-x-4 sm:bottom-4">
          <EmptyRunsState
            status={status}
            failure={failure}
            onRetry={sync}
            reconnectAction={reconnectAction}
            className="pointer-events-auto"
          />
        </div>
      )}
    </main>
  );
}
