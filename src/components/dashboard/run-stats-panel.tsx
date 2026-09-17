import type { CityCoverage } from "@/lib/coverage/street-coverage";
import { formatHours, formatKilometers, formatWholeNumber } from "@/lib/format";
import type { RunStats } from "@/lib/runs/run-stats";
import { cn } from "@/lib/utils";

import { AnimatedNumber } from "./animated-number";
import { CityCoverageList } from "./city-coverage-list";
import { PanelFooter } from "./panel-footer";

export type RunStatsPanelProps = {
  stats: RunStats;
  cityCoverage: CityCoverage[];
  onSelectCity: (areaId: number) => void;
  signOutAction: () => Promise<void>;
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

export function RunStatsPanel({
  stats,
  cityCoverage,
  onSelectCity,
  signOutAction,
  deleteDataAction,
  className,
}: RunStatsPanelProps) {
  return (
    <section aria-label="Your running totals" className={cn("glass-panel rounded-xl p-3 sm:p-4", className)}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-4">
        {STAT_DEFINITIONS.map((definition) => (
          <div key={definition.label} className="flex flex-col gap-0.5 sm:gap-1">
            <dt className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
              {definition.label}
            </dt>
            <dd className="flex items-baseline gap-1 font-mono text-xl font-semibold sm:text-2xl">
              <AnimatedNumber value={definition.value(stats)} format={definition.format} />
              {definition.unit && <span className="text-sm font-normal text-muted-foreground">{definition.unit}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <CityCoverageList cities={cityCoverage} onSelectCity={onSelectCity} />
      <PanelFooter signOutAction={signOutAction} deleteDataAction={deleteDataAction} />
    </section>
  );
}
