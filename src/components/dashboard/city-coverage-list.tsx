"use client";

import { LayoutGroup, motion } from "motion/react";
import { MapPin } from "lucide-react";

import { formatPercent } from "@/lib/format";
import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { PANEL_LAYOUT_TRANSITION } from "@/lib/motion/panel-motion";
import { cn } from "@/lib/utils";

export type CityCoverageListProps = {
  cities: CityCoverage[];
  selectedCityId: number | null;
  onSelectCity: (areaId: number) => void;
};

function analysisLabel(status: CityCoverage["status"]): string {
  if (status === "pending") return "Importing streets";
  if (status === "matching") return "Matching runs";
  return "Street analysis pending";
}

/** Street coverage per city, scrollable (shorter on mobile to leave map room). */
export function CityCoverageList({ cities, selectedCityId, onSelectCity }: CityCoverageListProps) {
  if (cities.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-2.5 sm:mt-4 sm:pt-3">
      <p className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Streets</p>
      <LayoutGroup>
        <ul className="flex max-h-24 scroll-fade flex-col gap-2 overflow-y-auto pr-2 sm:max-h-36">
          {cities.map((city) => {
            const share = toCoverageShare(city);
            const isAnalyzing = city.status === "pending" || city.status === "matching";
            const selected = city.areaId === selectedCityId;
            return (
              <motion.li
                key={city.areaId}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ layout: PANEL_LAYOUT_TRANSITION, duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <button
                  type="button"
                  aria-label={
                    isAnalyzing
                      ? `${city.name} (${analysisLabel(city.status).toLowerCase()})`
                      : `Open details for ${city.name}`
                  }
                  aria-current={selected ? "true" : undefined}
                  disabled={isAnalyzing || city.bounds == null}
                  onClick={() => onSelectCity(city.areaId)}
                  className="group flex min-w-0 flex-1 items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                >
                  <MapPin
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 shrink-0 transition-colors duration-150 ease-out",
                      selected
                        ? "text-ember"
                        : "text-muted-foreground/70 group-hover:text-ember group-focus-visible:text-ember group-disabled:text-muted-foreground/40",
                    )}
                  />
                  <span
                    title={city.name}
                    className={cn(
                      "min-w-0 truncate transition-colors duration-150 ease-out",
                      selected
                        ? "font-semibold text-ember"
                        : "text-foreground group-hover:text-ember group-focus-visible:text-ember group-disabled:text-foreground",
                    )}
                  >
                    {city.name}
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  {isAnalyzing || share == null ? (
                    <span className="font-mono text-xs text-muted-foreground" aria-label={analysisLabel(city.status)}>
                      {city.status === "pending" ? "Importing…" : city.status === "matching" ? "Matching…" : "…"}
                    </span>
                  ) : (
                    <>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <motion.span
                          className="block h-full rounded-full bg-ember"
                          initial={{ width: 0 }}
                          animate={{ width: `${share * 100}%` }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                        />
                      </span>
                      <span className="w-14 text-right font-mono text-xs text-muted-foreground">
                        {formatPercent(share)}
                      </span>
                    </>
                  )}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </LayoutGroup>
    </div>
  );
}
