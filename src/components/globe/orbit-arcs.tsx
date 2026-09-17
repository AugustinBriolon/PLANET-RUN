"use client";

import { MapArc, type MapArcDatum } from "@/components/ui/map";

import { globePalette } from "./globe-palette";

export type OrbitArcsProps = {
  arcs: MapArcDatum[];
};

/**
 * Decorative glowing arcs between cities, used where there is no user data yet. Layered glow +
 * crisp line to match the same treatment real run traces get once a runner has data of their own.
 */
export function OrbitArcs({ arcs }: OrbitArcsProps) {
  return (
    <>
      <MapArc
        id="orbit-arcs-glow"
        data={arcs}
        curvature={0.35}
        paint={{ "line-color": globePalette.traceGlow, "line-blur": 5, "line-width": 6, "line-opacity": 0.35 }}
      />
      <MapArc
        id="orbit-arcs-line"
        data={arcs}
        curvature={0.35}
        paint={{ "line-color": globePalette.arc, "line-width": 1.5, "line-opacity": 0.85 }}
      />
    </>
  );
}
