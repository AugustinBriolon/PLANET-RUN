"use client";

import { Flag, Flame, Route } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CityMapLayerFlags, CityMapLayerKey } from "@/lib/coverage/city-map-layers";
import { cn } from "@/lib/utils";

const LAYER_SPECS: readonly {
  key: CityMapLayerKey;
  label: string;
  showLabel: string;
  hideLabel: string;
  icon: typeof Flame;
  activeClass: string;
}[] = [
  {
    key: "heatmap",
    label: "Heatmap",
    showLabel: "Show heatmap",
    hideLabel: "Hide heatmap",
    icon: Flame,
    activeClass: "border-ember/50 bg-ember/15 text-ember",
  },
  {
    key: "covered",
    label: "Covered",
    showLabel: "Show covered streets",
    hideLabel: "Hide covered streets",
    icon: Flag,
    activeClass: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  },
  {
    key: "remaining",
    label: "Remaining",
    showLabel: "Show remaining streets",
    hideLabel: "Hide remaining streets",
    icon: Route,
    activeClass: "border-amber-500/50 bg-amber-500/15 text-amber-200",
  },
];

export type CityLayerControlsProps = {
  layers: CityMapLayerFlags;
  onToggle: (key: CityMapLayerKey) => void;
  className?: string;
};

/** Global map-layer toggles — same glass header style as the former Heatmap button. */
export function CityLayerControls({ layers, onToggle, className }: CityLayerControlsProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2", className)} role="group" aria-label="Map layers">
      {LAYER_SPECS.map((spec) => {
        const active = layers[spec.key];
        const Icon = spec.icon;
        return (
          <Button
            key={spec.key}
            type="button"
            variant="outline"
            size="lg"
            aria-pressed={active}
            aria-label={active ? spec.hideLabel : spec.showLabel}
            onClick={() => onToggle(spec.key)}
            className={cn("glass-panel group", active && spec.activeClass)}
          >
            <Icon aria-hidden="true" className={cn(spec.key === "heatmap" && active && "fill-current")} />
            {spec.label}
          </Button>
        );
      })}
    </div>
  );
}
