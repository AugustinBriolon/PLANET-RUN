"use client";

import { motion } from "motion/react";

import { formatPercent } from "@/lib/format";
import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { toCoverageShare } from "@/lib/coverage/street-coverage";

export type CityCoverageListProps = {
  cities: CityCoverage[];
};

/** Street coverage per city, scrollable with max 5 visible. */
export function CityCoverageList({ cities }: CityCoverageListProps) {
  if (cities.length === 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4">
      <p className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Streets</p>
      <ul className="flex flex-col gap-2.5 overflow-y-auto pr-2" style={{ maxHeight: "calc(100dvh - 420px)" }}>
        {cities.map((city, index) => {
          const share = toCoverageShare(city);
          return (
            <motion.li
              key={city.areaId}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 * Math.min(index, 4) }}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-foreground">{city.name}</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full rounded-full bg-ember" style={{ width: `${share * 100}%` }} />
                </span>
                <span className="w-14 text-right font-mono text-xs text-muted-foreground">{formatPercent(share)}</span>
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
