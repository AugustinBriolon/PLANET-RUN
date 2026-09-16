"use client";

import { motion } from "motion/react";

import { formatHours, formatKilometers, formatWholeNumber } from "@/lib/format";
import type { RunStats } from "@/lib/runs/run-stats";
import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { PanelFooter } from "./panel-footer";

export type RunStatsPanelProps = {
  stats: RunStats;
  deleteDataAction: () => Promise<void>;
  className?: string;
};

type StatDefinition = {
  label: string;
  unit: string;
  value: (stats: RunStats) => number;
  format: (value: number) => string;
};

const STAT_DEFINITIONS: StatDefinition[] = [
  { label: "Runs", unit: "", value: (stats) => stats.runCount, format: formatWholeNumber },
  { label: "Distance", unit: "km", value: (stats) => stats.totalDistanceMeters, format: formatKilometers },
  { label: "Time", unit: "h", value: (stats) => stats.totalMovingTimeSeconds, format: formatHours },
  { label: "Countries", unit: "", value: (stats) => stats.countryCount, format: formatWholeNumber },
];

export function RunStatsPanel({ stats, deleteDataAction, className }: RunStatsPanelProps) {
  return (
    <motion.section
      aria-label="Your running totals"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut", delay: 0.2 }}
      className={cn("glass-panel rounded-xl p-5", className)}
    >
      <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
        {STAT_DEFINITIONS.map((definition) => (
          <div key={definition.label} className="flex flex-col gap-1">
            <dt className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
              {definition.label}
            </dt>
            <dd className="flex items-baseline gap-1 font-mono text-2xl font-semibold">
              <AnimatedNumber value={definition.value(stats)} format={definition.format} />
              {definition.unit && <span className="text-sm font-normal text-muted-foreground">{definition.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <PanelFooter deleteDataAction={deleteDataAction} />
    </motion.section>
  );
}
