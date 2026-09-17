import type { Transition, Variants } from "motion/react";

/**
 * The dashboard's bottom panels move with two different intents:
 *
 * - `sheet` — the panel owns its corner and arrives from off-frame (desktop). A spring reads as a
 *   physical sheet rather than a timed slide.
 * - `swap` — mobile, where the stats panel and the run detail panel share one slot. Travel is
 *   deliberately tiny: two full-height panels sliding through each other in opposite directions at
 *   the same time reads as a collision, while a near-in-place crossfade reads as one panel whose
 *   content changed, which is what the layout actually means there.
 */
export const SHEET_TRANSITION: Transition = { type: "spring", stiffness: 380, damping: 36, mass: 0.85 };

export const SWAP_TRANSITION: Transition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] };

/** Resizing an already-visible panel (a longer run name wrapping to a second line). */
export const PANEL_LAYOUT_TRANSITION: Transition = { type: "spring", stiffness: 500, damping: 44, mass: 0.7 };

const sheetVariants: Variants = {
  hidden: { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0 },
};

const swapVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export type PanelMotionMode = "sheet" | "swap";

export function panelMotion(mode: PanelMotionMode) {
  const isSheet = mode === "sheet";
  return {
    variants: isSheet ? sheetVariants : swapVariants,
    initial: "hidden" as const,
    animate: "visible" as const,
    exit: "hidden" as const,
    transition: isSheet ? SHEET_TRANSITION : SWAP_TRANSITION,
  };
}
