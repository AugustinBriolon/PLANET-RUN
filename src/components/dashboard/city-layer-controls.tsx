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
  /** How the icon fills when the layer is on — route only fills its endpoint dots. */
  activeFill: "all" | "circles";
  activeClass: string;
}[] = [
  {
    key: "heatmap",
    label: "Heatmap",
    showLabel: "Show heatmap",
    hideLabel: "Hide heatmap",
    icon: Flame,
    activeFill: "all",
    // Keep tinted text on hover — outline's hover:text-foreground looks like the toggle flipped off.
    activeClass: "border-ember/50 bg-ember/15 text-ember hover:bg-ember/25 hover:text-ember",
  },
  {
    key: "covered",
    label: "Covered",
    showLabel: "Show covered streets",
    hideLabel: "Hide covered streets",
    icon: Flag,
    activeFill: "all",
    activeClass:
      "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-300",
  },
  {
    key: "remaining",
    label: "Remaining",
    showLabel: "Show remaining streets",
    hideLabel: "Hide remaining streets",
    icon: Route,
    activeFill: "circles",
    activeClass:
      "border-amber-500/50 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 hover:text-amber-200",
  },
];

function activeIconClass(fill: "all" | "circles"): string {
  if (fill === "circles") return "[&_circle]:fill-current [&_path]:fill-none";
  return "fill-current";
}

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
            <Icon aria-hidden="true" className={cn(active && activeIconClass(spec.activeFill))} />
            {spec.label}
          </Button>
        );
      })}
    </div>
  );
}
