"use client";

import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { useMap } from "@/components/ui/map";
import type { LngLatBounds } from "@/lib/runs/run-geojson";

export type FlyToBoundsProps = {
  bounds: LngLatBounds | null;
  padding?: number;
  maxZoom?: number;
};

/** Signature entrance: dive from orbit down to the area the user has run in. */
export function FlyToBounds({ bounds, padding = 96, maxZoom = 12 }: FlyToBoundsProps) {
  const { map, isLoaded } = useMap();
  const prefersReducedMotion = useReducedMotion();
  const boundsKey = bounds ? bounds.flat().join(",") : null;

  useEffect(() => {
    if (!map || !isLoaded || !bounds) return;
    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration: prefersReducedMotion ? 0 : 3200,
      essential: false,
    });
    // `boundsKey` avoids re-flying when an equal bounds array is re-created on refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, boundsKey, padding, maxZoom, prefersReducedMotion]);

  return null;
}
