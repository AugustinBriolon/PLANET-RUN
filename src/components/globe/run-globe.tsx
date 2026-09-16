"use client";

import type { ReactNode } from "react";

import { Map } from "@/components/ui/map";

const GLOBE_PROJECTION = { type: "globe" } as const;

export type RunGlobeProps = {
  children?: ReactNode;
  interactive?: boolean;
  initialCenter?: [number, number];
  initialZoom?: number;
  className?: string;
};

/** Dark globe canvas; data layers and camera behaviours are composed as children. */
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
      attributionControl={interactive ? { compact: true } : false}
      className={className}
    >
      {children}
    </Map>
  );
}
