"use client";

import { AnimatePresence, motion } from "motion/react";

import type { RunFeatureProperties } from "@/lib/runs/run-geojson";
import { cn } from "@/lib/utils";

import { RunDetailView } from "./run-detail-view";

export type RunDetailPanelProps = {
  run: RunFeatureProperties | null;
  onClose: () => void;
  className?: string;
};

/**
 * Floating panel for a clicked run trace. Desktop mirrors the stats panel at the opposite corner
 * (bottom-right) so both stay visible together; on mobile it takes the exact slot the stats panel
 * sits in, so it reads as one panel changing content rather than a second one stacking on top —
 * the caller hides the stats panel there while this is open.
 */
export function RunDetailPanel({ run, onClose, className }: RunDetailPanelProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:inset-x-auto sm:right-6 sm:bottom-4 sm:left-auto sm:max-w-[50vw]",
        className,
      )}
    >
      <AnimatePresence>
        {run && (
          <motion.section
            layout
            aria-label={`${run.name} details`}
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="glass-panel pointer-events-auto rounded-xl p-5"
          >
            {/* Crossfades content when a different trace is clicked while the panel stays open,
                while `layout` above smooths the panel resizing to fit (e.g. a longer run name). */}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={run.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <RunDetailView run={run} onClose={onClose} />
              </motion.div>
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
