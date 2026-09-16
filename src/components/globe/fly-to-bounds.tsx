"use client";

import { useReducedMotion } from "motion/react";
import { useEffect } from "react";

import { useMap } from "@/components/ui/map";
import type { BoxPadding } from "@/lib/map/fit-padding";
import { angularDistanceDegrees, boundsCenter, flyDurationMs } from "@/lib/map/fly-duration";
import type { LngLatBounds } from "@/lib/runs/run-geojson";

export type FlyToBoundsProps = {
  bounds: LngLatBounds | null;
  padding?: number | BoxPadding;
  maxZoom?: number;
};

function paddingKey(padding: number | BoxPadding): string {
  return typeof padding === "number"
    ? String(padding)
    : `${padding.top},${padding.right},${padding.bottom},${padding.left}`;
}

/** Fits the map to bounds from the current camera; duration grows with hop distance. */
export function FlyToBounds({ bounds, padding = 96, maxZoom = 12 }: FlyToBoundsProps) {
  const { map, isLoaded } = useMap();
  const prefersReducedMotion = useReducedMotion();
  const boundsKey = bounds ? bounds.flat().join(",") : null;
  const padKey = paddingKey(padding);

  useEffect(() => {
    if (!map || !isLoaded || !bounds) return;

    const center = map.getCenter();
    const distance = angularDistanceDegrees(
      { lng: center.lng, lat: center.lat },
      boundsCenter(bounds),
    );

    map.fitBounds(bounds, {
      padding,
      maxZoom,
      duration: flyDurationMs(distance, { reducedMotion: Boolean(prefersReducedMotion) }),
      essential: false,
    });
    // Keys avoid re-flying when equal padding/bounds objects are re-created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, boundsKey, padKey, maxZoom, prefersReducedMotion]);

  return null;
}
