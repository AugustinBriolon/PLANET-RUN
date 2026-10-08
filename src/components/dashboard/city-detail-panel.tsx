"use client";

import { X } from "lucide-react";

import { cityKmLeft } from "@/lib/coverage/city-map-layers";
import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

import { PanelFooter } from "./panel-footer";

export type CityDetailPanelProps = {
  city: CityCoverage;
  onClose: () => void;
  className?: string;
};

function analysisLabel(status: CityCoverage["status"]): string {
  if (status === "pending") return "Importing streets…";
  if (status === "matching") return "Matching runs…";
  return "Street analysis pending…";
}

/** Selected-city sheet: coverage summary only (map layers live in the header). */
export function CityDetailPanel({ city, onClose, className }: CityDetailPanelProps) {
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

      <PanelFooter />
    </section>
  );
}
