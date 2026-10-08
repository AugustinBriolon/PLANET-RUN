"use client";

import { Flag, Flame, Route } from "lucide-react";
import { motion } from "motion/react";

import type { CityMapLayerFlags, CityMapLayerKey } from "@/lib/coverage/city-map-layers";
import { cn } from "@/lib/utils";

const LAYER_SPECS: readonly {
  key: CityMapLayerKey;
  label: string;
  icon: typeof Flame;
  activeClass: string;
}[] = [
  { key: "heatmap", label: "Heatmap", icon: Flame, activeClass: "bg-orange-500/20 text-orange-300 ring-orange-400/40" },
  { key: "remaining", label: "Remaining", icon: Route, activeClass: "bg-amber-500/20 text-amber-200 ring-amber-400/40" },
  { key: "covered", label: "Covered", icon: Flag, activeClass: "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40" },
];

export type CityLayerControlsProps = {
  layers: CityMapLayerFlags;
  onToggle: (key: CityMapLayerKey) => void;
};

/** Three map-layer toggles that stagger in when a city opens. */
export function CityLayerControls({ layers, onToggle }: CityLayerControlsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Map layers">
      {LAYER_SPECS.map((spec, index) => {
        const active = layers[spec.key];
        const Icon = spec.icon;
        return (
          <motion.button
            key={spec.key}
            type="button"
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.05 + index * 0.045, duration: 0.22, ease: "easeOut" }}
            aria-pressed={active}
            aria-label={spec.label}
            onClick={() => onToggle(spec.key)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold outline-none transition-colors duration-150",
              "ring-1 focus-visible:ring-2 focus-visible:ring-ring",
              active ? spec.activeClass : "bg-muted/60 text-muted-foreground ring-transparent hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {spec.label}
          </motion.button>
        );
      })}
    </div>
  );
}
