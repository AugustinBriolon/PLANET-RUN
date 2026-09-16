"use client";

import { useEffect } from "react";

import { useMap } from "@/components/ui/map";
import { getGlobeZoomToFit } from "@/lib/globe-zoom";

export type FitGlobeToContainerProps = {
  /** Share of the container's smallest side the globe should cover. */
  fill?: number;
};

/** Keeps the whole planet in frame whatever the viewport size. */
export function FitGlobeToContainer({ fill }: FitGlobeToContainerProps) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;
    const fit = () => {
      const { clientWidth, clientHeight } = map.getContainer();
      map.setZoom(getGlobeZoomToFit(clientWidth, clientHeight, fill));
    };
    fit();
    map.on("resize", fit);
    return () => {
      map.off("resize", fit);
    };
  }, [map, isLoaded, fill]);

  return null;
}
