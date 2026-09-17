import { X } from "lucide-react";

import { formatDuration, formatKilometers, formatRunDate } from "@/lib/format";
import type { RunFeatureProperties } from "@/lib/runs/run-geojson";

import { AnimatedNumber } from "./animated-number";

// The panel itself is already moving when these mount: a page-length count-up would still be
// running well after it has settled.
const COUNT_UP_SECONDS = 0.8;

export type RunDetailViewProps = {
  run: RunFeatureProperties;
  onClose: () => void;
};

/** Name, date and totals for a single clicked run trace. */
export function RunDetailView({ run, onClose }: RunDetailViewProps) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold tracking-tight">{run.name}</h3>
          <p className="text-sm text-muted-foreground">{formatRunDate(run.startDate)}</p>
        </div>
        <button
          type="button"
          aria-label="Close run details"
          autoFocus
          onClick={onClose}
          className="-m-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-out outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5">
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Distance</dt>
          <dd className="flex items-baseline gap-1 font-mono text-2xl font-semibold">
            <AnimatedNumber value={run.distanceMeters} format={formatKilometers} duration={COUNT_UP_SECONDS} />
            <span className="text-sm font-normal text-muted-foreground">km</span>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-mono text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Time</dt>
          <dd className="font-mono text-2xl font-semibold">
            <AnimatedNumber value={run.movingTimeSeconds} format={formatDuration} duration={COUNT_UP_SECONDS} />
          </dd>
        </div>
      </dl>
    </div>
  );
}
