"use client";

import { X } from "lucide-react";

import type { CityMapLayerFlags, CityMapLayerKey } from "@/lib/coverage/city-map-layers";
import { cityKmLeft } from "@/lib/coverage/city-map-layers";
import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CityLayerControls } from "./city-layer-controls";
import { PanelFooter } from "./panel-footer";

export type CityDetailPanelProps = {
  city: CityCoverage;
  layers: CityMapLayerFlags;
  uncoveredLoading: boolean;
  onToggleLayer: (key: CityMapLayerKey) => void;
  onClose: () => void;
  className?: string;
};

function analysisLabel(status: CityCoverage["status"]): string {
  if (status === "pending") return "Importing streets…";
  if (status === "matching") return "Matching runs…";
  return "Street analysis pending…";
}

/** Selected-city sheet: coverage summary + independent map layer toggles. */
export function CityDetailPanel({
  city,
  layers,
  uncoveredLoading,
  onToggleLayer,
  onClose,
  className,
}: CityDetailPanelProps) {
  const share = toCoverageShare(city);
  const analyzing = city.status === "pending" || city.status === "matching";

  return (
    <section aria-label={`${city.name} details`} className={cn("glass-panel rounded-xl p-3 sm:p-4", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-1">
          <p className="font-mono text-[0.7rem] tracking-[0.18em] text-ember uppercase">City</p>
          <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{city.name}</h2>
          {analyzing ? (
            <p className="text-sm text-muted-foreground">{analysisLabel(city.status)}</p>
          ) : (
            <p className="font-mono text-sm text-muted-foreground">
              {share == null ? "—" : formatPercent(share)}
              <span className="text-muted-foreground/70"> · </span>
              {cityKmLeft(city)} km left
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close city"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:mt-4">
        <p className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Layers</p>
        <CityLayerControls layers={layers} onToggle={onToggleLayer} />
        {uncoveredLoading && layers.remaining ? (
          <p className="text-xs text-muted-foreground">Loading remaining streets…</p>
        ) : null}
      </div>

      <PanelFooter />
    </section>
  );
}
