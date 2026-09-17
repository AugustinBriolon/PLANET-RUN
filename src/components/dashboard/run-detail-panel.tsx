"use client";

import { AnimatePresence, motion } from "motion/react";

import { panelMotion, PANEL_LAYOUT_TRANSITION, type PanelMotionMode } from "@/lib/motion/panel-motion";
import type { RunFeatureProperties } from "@/lib/runs/run-geojson";
import { cn } from "@/lib/utils";

import { RunDetailView } from "./run-detail-view";

export type RunDetailPanelProps = {
  run: RunFeatureProperties | null;
  onClose: () => void;
  /** `sheet` where the panel owns its corner (desktop), `swap` where it shares the stats slot. */
  motionMode?: PanelMotionMode;
  className?: string;
};

/**
 * Floating panel for a clicked run trace. Desktop mirrors the stats panel at the opposite corner
 * (bottom-right) so both stay visible together; on mobile it takes the exact slot the stats panel
 * sits in, so it reads as one panel changing content rather than a second one stacking on top —
 * the caller hides the stats panel there while this is open.
 */
export function RunDetailPanel({ run, onClose, motionMode = "sheet", className }: RunDetailPanelProps) {
  const { transition, ...motionProps } = panelMotion(motionMode);

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
            {...motionProps}
            transition={{ ...transition, layout: PANEL_LAYOUT_TRANSITION }}
            className="glass-panel pointer-events-auto transform-gpu rounded-xl p-5"
          >
            {/* Crossfades content when a different trace is clicked while the panel stays open,
                while `layout` above springs the panel to its new height (e.g. a longer run name). */}
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
