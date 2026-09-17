"use client";

import * as MapLibreGL from "maplibre-gl";
import type { ReactNode } from "react";

import { Map } from "@/components/ui/map";

// mapcn's own worker setup points at unpkg, which fails to ever fire "load" on iOS Safari over a
// LAN http:// origin (phone testing). Served same-origin instead; kept here (not in the vendored
// map.tsx) so a `shadcn add @mapcn/map --overwrite` refresh can't silently drop it.
if (typeof window !== "undefined") {
  MapLibreGL.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

const GLOBE_PROJECTION = { type: "globe" } as const;

export type RunGlobeProps = {
  children?: ReactNode;
  interactive?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
};

/**
 * Dark globe canvas; data layers and camera behaviours are composed as children.
 * MapLibre's own attribution control is disabled: the dashboard shows attribution as a plain icon
 * button next to Settings (`AttributionInfo`), which stays in our own layout instead of docking to a
 * map corner that competes with the stats panel.
 */
export function RunGlobe({
  children,
  interactive = true,
  initialCenter = [8, 30],
  initialZoom = 1.6,
  className,
}: RunGlobeProps) {
  return (
    <Map
      theme="dark"
      projection={GLOBE_PROJECTION}
      center={initialCenter}
      zoom={initialZoom}
      interactive={interactive}
      attributionControl={false}
      className={className}
    >
      {children}
    </Map>
  );
}
