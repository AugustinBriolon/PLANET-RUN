"use client";

import { Flame } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeatmapToggleProps = {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
};

export function HeatmapToggle({ active, onToggle, disabled = false, className }: HeatmapToggleProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={active}
      aria-label={active ? "Hide heatmap" : "Show heatmap"}
      className={cn("glass-panel group", active && "border-ember/50 bg-ember/15 text-ember", className)}
    >
      <Flame aria-hidden="true" className={cn(active && "fill-current")} />
      Heatmap
    </Button>
  );
}
