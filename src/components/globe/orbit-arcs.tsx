"use client";

import { MapArc, type MapArcDatum } from "@/components/ui/map";

import { globePalette } from "./globe-palette";

export type OrbitArcsProps = {
  arcs: MapArcDatum[];
};

/** Decorative glowing arcs between cities, used where there is no user data yet. */
export function OrbitArcs({ arcs }: OrbitArcsProps) {
  return (
    <MapArc
      data={arcs}
      curvature={0.35}
      paint={{ "line-color": globePalette.arc, "line-width": 1.5, "line-opacity": 0.75 }}
    />
  );
}
