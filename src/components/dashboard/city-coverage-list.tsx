"use client";

import { LayoutGroup, motion } from "motion/react";

import { formatPercent } from "@/lib/format";
import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { toCoverageShare } from "@/lib/coverage/street-coverage";
import { PANEL_LAYOUT_TRANSITION } from "@/lib/motion/panel-motion";

export type CityCoverageListProps = {
  cities: CityCoverage[];
  onSelectCity: (areaId: number) => void;
};

/** Street coverage per city, scrollable (shorter on mobile to leave map room). */
export function CityCoverageList({ cities, onSelectCity }: CityCoverageListProps) {
  if (cities.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border pt-2.5 sm:mt-4 sm:pt-3">
      <p className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Streets</p>
      <LayoutGroup>
        <ul className="flex max-h-24 scroll-fade flex-col gap-2 overflow-y-auto pr-2 sm:max-h-36">
          {cities.map((city) => {
            const share = toCoverageShare(city);
            const isPending = city.status === "pending";
            return (
              <motion.li
                key={city.areaId}
                layout
                // Fade only: the panel itself already moves, and on mobile it remounts on every
                // swap back from a run's details — rows sliding in again each time reads as noise.
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ layout: PANEL_LAYOUT_TRANSITION, duration: 0.2, ease: "easeOut" }}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <button
                  type="button"
                  aria-label={isPending ? `${city.name} (analyzing streets)` : `Fly to ${city.name}`}
                  disabled={isPending || city.bounds == null}
                  onClick={() => onSelectCity(city.areaId)}
                  className="min-w-0 flex-1 truncate text-left text-foreground transition-colors duration-150 ease-out outline-none hover:text-ember focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:text-foreground"
                >
                  {city.name}
                </button>
                <span className="flex shrink-0 items-center gap-2">
                  {isPending || share == null ? (
                    <span className="font-mono text-xs text-muted-foreground" aria-label="Street analysis pending">
                      …
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
